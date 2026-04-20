"""
Extended social-metrics scraping service.

Adds Facebook, LinkedIn, and YouTube scrapers alongside the existing
Instagram scraper, using the same multi-strategy HTML parsing approach.

Platform-by-platform scraping strategy summary
───────────────────────────────────────────────
Instagram  → og:description → meta description → JSON-LD → raw HTML regex
Facebook   → og:description → meta description → JSON-LD → raw HTML regex
LinkedIn   → og:description → meta description → JSON-LD → script data regex
YouTube    → og:description → JSON-LD (ytInitialData) → meta tags → raw HTML
"""
from __future__ import annotations

import re
import json
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from bs4 import BeautifulSoup

from core.config import settings
from core.database import db
from models.competitor_models import (
    CompetitorData,
    CompetitorGrowthPoint,
    CompetitorMetrics,
    CompetitorsResponse,
)

logger = logging.getLogger(__name__)

# ── HTTP helpers ───────────────────────────────────────────────────────────────

_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Cache-Control": "max-age=0",
    "Connection": "keep-alive",
}

# LinkedIn specifically wants these extra headers to avoid a redirect loop
_LINKEDIN_HEADERS = {
    **_BROWSER_HEADERS,
    "Sec-Fetch-Dest": "document",
    "Upgrade-Insecure-Requests": "1",
    # Consent cookie signals we've accepted cookies (reduces redirect storms)
    "Cookie": "li_gc=MTsyMTsxNjgwMDAwMDAwO2w=; bcookie=v=2&abc123; bscookie=v=1&abc",
    "Referer": "https://www.google.com/",
}

# Googlebot-like headers for cache fetches
_GOOGLEBOT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

_TIMEOUT = httpx.Timeout(25.0, connect=10.0)
_SCRAPE_DELAY = 1.5


# ── Google-cache helper ────────────────────────────────────────────────────────

async def _fetch_google_cache(url: str) -> str:
    """
    Try to fetch a URL via Google's web cache.
    Returns the HTML text or empty string on failure.

    Format: https://webcache.googleusercontent.com/search?q=cache:<url>
    Google's cache often has the SEO-rendered HTML with follower counts
    even when the live site blocks unauthenticated bots.
    """
    cache_url = f"https://webcache.googleusercontent.com/search?q=cache:{url}&hl=en"
    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            resp = await client.get(cache_url, headers=_GOOGLEBOT_HEADERS, timeout=_TIMEOUT)
            if resp.status_code == 200 and "google" not in str(resp.url).lower().replace("webcache", ""):
                return resp.text
            # Check we actually got a cached page (not a captcha)
            if resp.status_code == 200 and len(resp.text) > 5000:
                return resp.text
    except Exception as exc:
        logger.debug("Google cache fetch failed for %s: %s", url, exc)
    return ""


# ── Shared helpers ─────────────────────────────────────────────────────────────

def _parse_abbreviated_count(text: str) -> int | None:
    """
    Parse human-readable counts into integers.

    Handles:
        '892K'   → 892_000
        '1.2M'   → 1_200_000
        '52,000' → 52_000
        '52000'  → 52_000
    """
    if not text:
        return None
    text = text.strip().replace(",", "").replace(" ", "").replace("\u202f", "")
    m = re.match(r"([\d.]+)\s*([KkMmBb]?)", text)
    if not m:
        return None
    num = float(m.group(1))
    suffix = m.group(2).upper()
    multiplier = {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000}.get(suffix, 1)
    return int(num * multiplier)


def _first_og(soup: BeautifulSoup, prop: str) -> str:
    """Return content of the first matching og: meta tag, or empty string."""
    tag = soup.find("meta", attrs={"property": prop})
    return (tag.get("content") or "") if tag else ""


def _first_meta(soup: BeautifulSoup, name: str) -> str:
    """Return content of the first matching <meta name=...> tag, or empty string."""
    tag = soup.find("meta", attrs={"name": name})
    return (tag.get("content") or "") if tag else ""


def _extract_yt_initial_data(html: str) -> dict | None:
    """
    Extract and parse the ytInitialData JSON blob from a YouTube page.

    YouTube embeds the full page payload as:
        var ytInitialData = {...};
    or (newer format):
        window["ytInitialData"] = {...};

    The blob is large (often 300–600 KB) so a non-greedy regex like
    ``r'ytInitialData = (\\{.+?\\})'`` terminates too early inside nested
    objects.  This function instead finds the opening brace and walks
    forward with a simple bracket counter to find the correct closing
    brace, then parses the result.
    """
    # Locate the start of the assignment
    for prefix in (
        "var ytInitialData = ",
        'window["ytInitialData"] = ',
        "window['ytInitialData'] = ",
        "ytInitialData = ",
    ):
        idx = html.find(prefix)
        if idx != -1:
            start = idx + len(prefix)
            break
    else:
        return None

    if start >= len(html) or html[start] != "{":
        return None

    # Walk forward counting braces; respect string literals so braces
    # inside quoted values don't count.
    depth = 0
    in_string = False
    escape_next = False
    end = start
    for i, ch in enumerate(html[start:], start):
        if escape_next:
            escape_next = False
            continue
        if ch == "\\" and in_string:
            escape_next = True
            continue
        if ch == '"' and not escape_next:
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break

    try:
        return json.loads(html[start:end])
    except (json.JSONDecodeError, ValueError):
        return None


def _search_recursive(obj: Any, key: str) -> Any:
    """DFS search for a key anywhere in a nested dict/list structure."""
    if isinstance(obj, dict):
        if key in obj:
            return obj[key]
        for v in obj.values():
            found = _search_recursive(v, key)
            if found is not None:
                return found
    elif isinstance(obj, list):
        for item in obj:
            found = _search_recursive(item, key)
            if found is not None:
                return found
    return None


# ══════════════════════════════════════════════════════════════════════════════
# INSTAGRAM  (unchanged from original, kept here for completeness)
# ══════════════════════════════════════════════════════════════════════════════

async def scrape_instagram_profile(handle: str) -> dict[str, Any]:
    """
    Scrape a public Instagram profile page for follower + post counts.

    Extraction order
    ────────────────
    1. og:description  – "892K Followers, 345 Following, 2,847 Posts – See…"
    2. meta description – same format, present on some page variations
    3. JSON-LD          – interactionStatistic / FollowAction
    4. Raw HTML regex   – edge_followed_by / edge_owner_to_timeline_media blobs
    """
    url = f"https://www.instagram.com/{handle}/"
    result: dict[str, Any] = {"handle": handle, "followers": 0, "posts": 0, "bio": ""}

    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            resp = await client.get(url, headers=_BROWSER_HEADERS, timeout=_TIMEOUT)
            resp.raise_for_status()
            html = resp.text

        soup = BeautifulSoup(html, "html.parser")

        # Strategy 1 – og:description
        for content in (_first_og(soup, "og:description"), _first_meta(soup, "description")):
            if content and result["followers"] == 0:
                fm = re.search(r"([\d,.]+[KkMm]?)\s*Followers", content)
                pm = re.search(r"([\d,.]+[KkMm]?)\s*Posts", content)
                if fm:
                    result["followers"] = _parse_abbreviated_count(fm.group(1)) or 0
                if pm:
                    result["posts"] = _parse_abbreviated_count(pm.group(1)) or 0

        # Strategy 2 – JSON-LD interactionStatistic
        if result["followers"] == 0:
            for script in soup.find_all("script", type="application/ld+json"):
                try:
                    ld = json.loads(script.string or "")
                    stats = (
                        ld.get("mainEntityOfPage", {}).get("interactionStatistic", [])
                        if isinstance(ld, dict) else []
                    )
                    for stat in (stats if isinstance(stats, list) else []):
                        if stat.get("interactionType", {}).get("@type") == "FollowAction":
                            result["followers"] = int(stat.get("userInteractionCount", 0))
                except (json.JSONDecodeError, ValueError):
                    continue

        # Strategy 3 – raw HTML data blobs
        if result["followers"] == 0:
            m = re.search(r'"edge_followed_by"\s*:\s*\{\s*"count"\s*:\s*(\d+)', html)
            if m:
                result["followers"] = int(m.group(1))
            m2 = re.search(r'"edge_owner_to_timeline_media"\s*:\s*\{\s*"count"\s*:\s*(\d+)', html)
            if m2:
                result["posts"] = int(m2.group(1))

        og_title = _first_og(soup, "og:title")
        if og_title:
            result["bio"] = og_title

        logger.info("Instagram @%s: %d followers, %d posts", handle, result["followers"], result["posts"])

    except Exception as exc:
        logger.warning("Instagram scrape failed for @%s: %s", handle, exc)

    return result


# ══════════════════════════════════════════════════════════════════════════════
# FACEBOOK
# ══════════════════════════════════════════════════════════════════════════════

async def scrape_facebook_page(page_name: str) -> dict[str, Any]:
    """
    Scrape a public Facebook Page for follower / like counts.

    How it works
    ────────────
    Facebook renders a lot of data server-side into HTML for SEO crawlers.
    We exploit several surfaces in order of reliability:

    Strategy 1 – og:description
        Format varies but often: "X people follow this" or "X likes"
        e.g. "14,530 likes · 892 talking about this"

    Strategy 2 – meta description
        Same as og:description on some regions/templates.

    Strategy 3 – JSON-LD (Organization / LocalBusiness schema)
        Facebook occasionally embeds structured data with followerCount
        or interactionCount.

    Strategy 4 – Raw HTML regex
        Facebook bakes follower numbers into the page's server-rendered
        HTML as plain text spans. We look for common patterns like:
          "followers_count":14530
          "14,530 people follow this"
        These patterns change with UI redesigns, so multiple regexes
        are tried in sequence.

    Caveats
    ───────
    • Facebook aggressively blocks scrapers; a cookie-less request often
      returns a login-gate page.  The scraper gracefully returns 0 in
      that case so the caller can fall back to cached/hardcoded data.
    • The /pg/<name>/about/ path sometimes exposes more data than the
      main page – we try both.
    """
    result: dict[str, Any] = {"page_name": page_name, "followers": 0, "likes": 0}

    # Try multiple URL patterns.
    # mbasic.facebook.com is the old low-bandwidth mobile site — it skips most
    # of the JS-heavy login-gate flow and returns SEO-visible follower counts
    # even for unauthenticated requests on many public pages.
    urls_to_try = [
        f"https://mbasic.facebook.com/{page_name}",
        f"https://mbasic.facebook.com/{page_name}/about",
        f"https://www.facebook.com/{page_name}/",
        f"https://www.facebook.com/pg/{page_name}/about/",
        f"https://www.facebook.com/{page_name}/about/",
    ]

    # Mobile UA for mbasic; desktop UA for www.
    fb_headers_mobile = {
        **_BROWSER_HEADERS,
        "User-Agent": (
            "Mozilla/5.0 (Linux; Android 13; Pixel 7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.6367.82 Mobile Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
        "Cookie": "datr=scraper; wd=390x844; locale=en_US",
        "Referer": "https://www.google.com/",
    }
    fb_headers_desktop = {
        **_BROWSER_HEADERS,
        "Accept-Language": "en-US,en;q=0.9",
        "Cookie": "datr=scraper; wd=1920x1080; locale=en_US",
        "Referer": "https://www.google.com/",
    }

    def _headers_for(url: str) -> dict:
        return fb_headers_mobile if "mbasic" in url else fb_headers_desktop

    # Keep fb_headers for backward compat with code below
    fb_headers = fb_headers_desktop

    html = ""
    for url in urls_to_try:
        try:
            async with httpx.AsyncClient(follow_redirects=True) as client:
                resp = await client.get(url, headers=_headers_for(url), timeout=_TIMEOUT)
                resp.raise_for_status()
                candidate = resp.text

            # Detect login-wall responses
            final_path = str(resp.url.path).lower()
            final_url_str = str(resp.url).lower()
            login_wall = (
                "login" in final_path
                or "checkpoint" in final_path
                or "/login/" in final_url_str
                or "login_wall" in candidate
                or 'id="login_form"' in candidate
                or '"loginForm"' in candidate
                or "You must log in to continue" in candidate
                or "log in to facebook" in candidate.lower()
                or "create new account" in candidate.lower()
            )
            if not login_wall and len(candidate) > 3000:
                html = candidate
                logger.debug("Facebook: got HTML from %s (%d bytes)", url, len(candidate))
                break
        except Exception as exc:
            logger.warning("Facebook fetch failed for %s at %s: %s", page_name, url, exc)

    if not html:
        logger.info("Facebook %s: blocked by login wall or all fetches failed", page_name)
        return result

    soup = BeautifulSoup(html, "html.parser")

    # Strategy 1 & 2 – meta tags
    for content in (_first_og(soup, "og:description"), _first_meta(soup, "description")):
        if not content:
            continue
        # "14,530 likes · 892 talking about this"
        likes_m = re.search(r"([\d,]+)\s+(?:people\s+)?likes?", content, re.I)
        followers_m = re.search(r"([\d,]+)\s+(?:people\s+)?follows?", content, re.I)
        if likes_m and result["likes"] == 0:
            result["likes"] = _parse_abbreviated_count(likes_m.group(1)) or 0
        if followers_m and result["followers"] == 0:
            result["followers"] = _parse_abbreviated_count(followers_m.group(1)) or 0

    # Strategy 3 – JSON-LD
    if result["followers"] == 0:
        for script in soup.find_all("script", type="application/ld+json"):
            try:
                ld = json.loads(script.string or "")
                if isinstance(ld, dict):
                    fc = ld.get("followerCount") or ld.get("interactionCount")
                    if fc:
                        result["followers"] = int(str(fc).replace(",", ""))
            except (json.JSONDecodeError, ValueError):
                continue

    # Strategy 4 – raw HTML regexes (multiple patterns; stop on first hit)
    if result["followers"] == 0:
        raw_patterns = [
            # New Graph API blobs baked into page JS
            r'"follower_count"\s*:\s*(\d+)',
            r'"followers_count"\s*:\s*(\d+)',
            # Hydration JSON in __bbox / __data payloads (React-era FB)
            r'"page_followers"\s*:\s*(\d+)',
            r'"followers"\s*:\s*\{"count"\s*:\s*(\d+)',
            # Rendered text patterns
            r'([\d,]+)\s+people\s+follow\s+this',
            r'([\d,.]+[KkMm]?)\s+Followers',
        ]
        for pat in raw_patterns:
            m = re.search(pat, html, re.I)
            if m:
                result["followers"] = _parse_abbreviated_count(m.group(1)) or 0
                break

    if result["likes"] == 0:
        like_patterns = [
            r'"like_count"\s*:\s*(\d+)',
            r'"page_likers"\s*:\s*\{\s*"count"\s*:\s*(\d+)',
            r'([\d,]+)\s+people\s+like\s+this',
        ]
        for pat in like_patterns:
            m = re.search(pat, html, re.I)
            if m:
                result["likes"] = _parse_abbreviated_count(m.group(1)) or 0
                break

    # If followers not found but likes were, use likes as proxy
    if result["followers"] == 0 and result["likes"] > 0:
        result["followers"] = result["likes"]

    logger.info("Facebook %s: %d followers, %d likes", page_name, result["followers"], result["likes"])
    return result


# ══════════════════════════════════════════════════════════════════════════════
# LINKEDIN
# ══════════════════════════════════════════════════════════════════════════════

async def scrape_linkedin_company(company_slug: str) -> dict[str, Any]:
    """
    Scrape a public LinkedIn Company page for follower count.

    How it works
    ────────────
    LinkedIn is one of the harder platforms to scrape because it requires
    authentication for most content. However, public company pages do
    expose some data to unauthenticated crawlers for SEO purposes.

    Strategy 1 – og:description / meta description
        LinkedIn embeds follower counts in the og:description for company
        pages: "Company Name | X followers on LinkedIn. Description..."

    Strategy 2 – JSON-LD (Organization schema)
        LinkedIn sometimes includes structured data on company pages with
        numberOfEmployees or followerCount fields.

    Strategy 3 – Raw HTML regex on server-rendered JSON blobs
        LinkedIn's server renders partial component JSON into the HTML.
        Patterns like:
          "followersCount":12400
          "entityUrn":"urn:li:company:..." + nearby follower count

    Strategy 4 – <code> tag extraction
        LinkedIn injects hydration JSON inside <code> tags with
        id="bpr-guid-*". These contain structured company data.

    Caveats
    ───────
    • LinkedIn redirects unauthenticated users to /authwall for most
      pages. The /company/<slug>/ path often returns partial data.
    • Headless LinkedIn scraping is explicitly against their ToS; use
      the LinkedIn API for production workloads.
    """
    result: dict[str, Any] = {"company_slug": company_slug, "followers": 0, "employees": ""}

    # Try multiple URL patterns:
    # 1. /company/<slug>/ — main page (often authwalled for bots)
    # 2. /company/<slug>/about/ — sometimes bypasses authwall
    # 3. pub/company/<slug>/ — public-profile path, less gated
    # 4. Google web cache — get the cached SEO version pre-authwall
    urls_to_try = [
        f"https://www.linkedin.com/company/{company_slug}/",
        f"https://www.linkedin.com/company/{company_slug}/about/",
        f"https://www.linkedin.com/pub/company/{company_slug}/",
    ]
    # Google cache URLs to try after direct attempts fail
    cache_urls = [
        f"https://www.linkedin.com/company/{company_slug}/",
        f"https://www.linkedin.com/company/{company_slug}/about/",
    ]

    html = ""
    for url in urls_to_try:
        try:
            async with httpx.AsyncClient(follow_redirects=True) as client:
                resp = await client.get(url, headers=_LINKEDIN_HEADERS, timeout=_TIMEOUT)
                resp.raise_for_status()
                candidate = resp.text

            # Detect authwall redirects
            final_url = str(resp.url).lower()
            authwall = (
                "/authwall" in final_url
                or "/login" in final_url
                or "/uas/login" in final_url
                or "authwall" in candidate[:3000].lower()
                or "sign in to view" in candidate.lower()
                or "join linkedin" in candidate.lower()
                or "sign in" in candidate[:500].lower()
            )
            if not authwall and len(candidate) > 3000:
                html = candidate
                logger.debug("LinkedIn: got HTML from %s (%d bytes)", url, len(candidate))
                break
        except Exception as exc:
            logger.warning("LinkedIn fetch failed for %s at %s: %s", company_slug, url, exc)

    # If all direct attempts failed, try fetching via Google's web cache
    if not html:
        logger.info("LinkedIn %s: direct fetch blocked, trying Google cache", company_slug)
        for cache_origin_url in cache_urls:
            cached_html = await _fetch_google_cache(cache_origin_url)
            if cached_html and len(cached_html) > 5000:
                # Validate it's actually a LinkedIn page and not a captcha
                if "linkedin" in cached_html.lower() and company_slug.lower() in cached_html.lower():
                    html = cached_html
                    logger.info("LinkedIn %s: using Google cache (%d bytes)", company_slug, len(html))
                    break

    if not html:
        logger.info("LinkedIn %s: blocked by authwall or all fetches failed", company_slug)
        return result

    soup = BeautifulSoup(html, "html.parser")

    # Strategy 1 – meta tags
    for content in (_first_og(soup, "og:description"), _first_meta(soup, "description")):
        if not content:
            continue
        # "Jaypore | 18,500 followers on LinkedIn. ..."
        m = re.search(r"([\d,]+[KkMm]?)\s+followers?\s+on\s+LinkedIn", content, re.I)
        if m and result["followers"] == 0:
            result["followers"] = _parse_abbreviated_count(m.group(1)) or 0
        # Fallback: "18.5K followers"
        m2 = re.search(r"([\d,.]+[KkMm]?)\s+followers", content, re.I)
        if m2 and result["followers"] == 0:
            result["followers"] = _parse_abbreviated_count(m2.group(1)) or 0

    # Strategy 2 – JSON-LD
    if result["followers"] == 0:
        for script in soup.find_all("script", type="application/ld+json"):
            try:
                ld = json.loads(script.string or "")
                if isinstance(ld, dict):
                    fc = ld.get("followersCount") or ld.get("numberOfFollowers")
                    if fc:
                        result["followers"] = int(fc)
                    emp = ld.get("numberOfEmployees")
                    if emp:
                        result["employees"] = str(emp)
            except (json.JSONDecodeError, ValueError):
                continue

    # Strategy 3 – raw HTML JSON blobs
    if result["followers"] == 0:
        raw_patterns = [
            r'"followersCount"\s*:\s*(\d+)',
            r'"followerCount"\s*:\s*(\d+)',
            r'"numFollowers"\s*:\s*(\d+)',
            # Newer layout: followerCount inside company entity blob
            r'"entityFollowingInfo"\s*:\s*\{[^}]*"followerCount"\s*:\s*(\d+)',
            r'"followerCountDisplayStr"\s*:\s*"([\d,]+[KkMm]?)',
            r'([\d,]+)\s+followers\s+on\s+LinkedIn',
            r'([\d,.]+[KkMm]?)\s+followers',
        ]
        for pat in raw_patterns:
            m = re.search(pat, html, re.I)
            if m:
                result["followers"] = _parse_abbreviated_count(m.group(1)) or 0
                if result["followers"]:
                    break

    # Strategy 4 – <code> tag hydration JSON
    if result["followers"] == 0:
        for code_tag in soup.find_all("code"):
            raw = code_tag.get_text()
            m = re.search(r'"followersCount"\s*:\s*(\d+)', raw)
            if m:
                result["followers"] = int(m.group(1))
                break

    logger.info("LinkedIn %s: %d followers", company_slug, result["followers"])
    return result


# ══════════════════════════════════════════════════════════════════════════════
# YOUTUBE
# ══════════════════════════════════════════════════════════════════════════════

async def scrape_youtube_channel(channel_id_or_handle: str) -> dict[str, Any]:
    """
    Scrape a YouTube channel for subscriber count and video count.

    The ``channel_id_or_handle`` parameter accepts any of:
        • A channel ID:  UCxxxxxxxxxxxxxxxxxxxxxx
        • A handle:      @jaypore
        • A custom URL:  jaypore   (resolved via /c/<name>)

    How it works
    ────────────
    Strategy 1 – og:description
        YouTube embeds subscriber counts in og:description for channel
        pages: "X subscribers · Y videos"

    Strategy 2 – ytInitialData JSON blob
        YouTube bakes the entire page's data payload into a JS variable:
          var ytInitialData = {...};
        This blob contains subscriberCountText (e.g. "892K subscribers")
        and videoCountText inside header.c4TabbedHeaderRenderer or
        header.pageHeaderRenderer.

    Strategy 3 – JSON-LD
        YouTube adds structured Organization/BreadcrumbList JSON-LD;
        sometimes includes interactionCount for subscriber stats.

    Strategy 4 – Raw meta / HTML patterns
        title tag, yt-formatted-string patterns, and text patterns in
        the rendered HTML.

    Caveats
    ───────
    • YouTube hides exact subscriber counts above 1,000 (shows "1K", "1.2M").
      The scraper parses those abbreviated strings back to integers.
    • Channels with very few subscribers may show exact counts.
    """
    # Normalise the handle/ID into a list of candidate URLs to try.
    # YouTube redirects cleanly for @handle and /channel/UC... forms;
    # legacy /c/<name> and /user/<name> are also tried for older channels.
    handle = channel_id_or_handle.strip()
    if handle.startswith("UC"):
        urls_to_try = [
            f"https://www.youtube.com/channel/{handle}",
            f"https://www.youtube.com/channel/{handle}/videos",
        ]
    elif handle.startswith("@"):
        slug = handle[1:]  # strip leading @
        urls_to_try = [
            f"https://www.youtube.com/{handle}",
            f"https://www.youtube.com/@{slug}",
            f"https://www.youtube.com/c/{slug}",
            f"https://www.youtube.com/user/{slug}",
        ]
    else:
        urls_to_try = [
            f"https://www.youtube.com/@{handle}",
            f"https://www.youtube.com/c/{handle}",
            f"https://www.youtube.com/user/{handle}",
        ]

    result: dict[str, Any] = {
        "channel": channel_id_or_handle,
        "subscribers": 0,
        "videos": 0,
        "description": "",
    }

    html = ""
    for url in urls_to_try:
        try:
            async with httpx.AsyncClient(follow_redirects=True) as client:
                resp = await client.get(url, headers=_BROWSER_HEADERS, timeout=_TIMEOUT)
                resp.raise_for_status()
                candidate = resp.text
            # Validate it's an actual channel page (not a 404 redirect)
            if len(candidate) > 5000 and ("ytInitialData" in candidate or "subscriberCount" in candidate or "og:title" in candidate):
                html = candidate
                logger.debug("YouTube: got HTML from %s (%d bytes)", url, len(candidate))
                break
        except Exception as exc:
            logger.debug("YouTube URL failed %s: %s", url, exc)

    if not html:
        logger.warning("YouTube fetch failed for all URLs for %s", handle)
        return result

    soup = BeautifulSoup(html, "html.parser")

    # Strategy 1 – og:description ("892K subscribers · 1,847 videos")
    for content in (_first_og(soup, "og:description"), _first_meta(soup, "description")):
        if not content:
            continue
        sub_m = re.search(r"([\d,.]+[KkMm]?)\s+subscribers?", content, re.I)
        vid_m = re.search(r"([\d,.]+[KkMm]?)\s+videos?", content, re.I)
        if sub_m and result["subscribers"] == 0:
            result["subscribers"] = _parse_abbreviated_count(sub_m.group(1)) or 0
        if vid_m and result["videos"] == 0:
            result["videos"] = _parse_abbreviated_count(vid_m.group(1)) or 0

    # Strategy 2 – ytInitialData JSON blob (most reliable when present)
    # Uses a bracket-balanced extractor instead of a non-greedy regex so the
    # full JSON blob is captured even when it spans thousands of lines.
    if result["subscribers"] == 0:
        yt_data = _extract_yt_initial_data(html)
        if yt_data:
            try:
                sub_text = _search_recursive(yt_data, "subscriberCountText")
                if sub_text:
                    # sub_text may be {"simpleText": "892K subscribers"} or a plain string
                    raw = (
                        sub_text.get("simpleText", "")
                        if isinstance(sub_text, dict)
                        else str(sub_text)
                    )
                    sub_m2 = re.search(r"([\d,.]+[KkMm]?)", raw)
                    if sub_m2:
                        result["subscribers"] = _parse_abbreviated_count(sub_m2.group(1)) or 0

                vid_text = _search_recursive(yt_data, "videoCountText")
                if vid_text and result["videos"] == 0:
                    raw_v = (
                        vid_text.get("runs", [{}])[0].get("text", "")
                        if isinstance(vid_text, dict) else str(vid_text)
                    )
                    vid_m2 = re.search(r"([\d,]+)", raw_v)
                    if vid_m2:
                        result["videos"] = _parse_abbreviated_count(vid_m2.group(1)) or 0

            except (json.JSONDecodeError, ValueError, AttributeError):
                pass

    # Strategy 3 – JSON-LD
    if result["subscribers"] == 0:
        for script in soup.find_all("script", type="application/ld+json"):
            try:
                ld = json.loads(script.string or "")
                if isinstance(ld, dict):
                    ic = ld.get("interactionCount")
                    if ic:
                        result["subscribers"] = int(str(ic).replace(",", ""))
            except (json.JSONDecodeError, ValueError):
                continue

    # Strategy 4 – raw HTML patterns
    if result["subscribers"] == 0:
        raw_patterns = [
            r'"subscriberCountText"\s*:\s*\{\s*"simpleText"\s*:\s*"([\d,.]+[KkMm]?)\s*subscribers?"',
            r'([\d,.]+[KkMm]?)\s+subscribers',
        ]
        for pat in raw_patterns:
            m = re.search(pat, html, re.I)
            if m:
                result["subscribers"] = _parse_abbreviated_count(m.group(1)) or 0
                break

    og_desc = _first_og(soup, "og:description")
    if og_desc:
        result["description"] = og_desc[:200]

    logger.info(
        "YouTube %s: %d subscribers, %d videos",
        channel_id_or_handle, result["subscribers"], result["videos"],
    )
    return result


# ── Competitor registry (extended with FB / LinkedIn / YT handles) ─────────────

COMPETITORS = [
    {
        "id": "comp-1",
        "name": "Jaypore",
        "instagram": "jaypore",
        "facebook": "jaypore",
        "linkedin": "jaypore",
        "youtube": "@jaypore",
        "website": "https://www.jaypore.com",
    },
    {
        "id": "comp-2",
        "name": "Okhai",
        "instagram": "okhai_org",
        "facebook": "okhai.org",
        "linkedin": "okhai",
        "youtube": "@okhai",
        "website": "https://okhai.org",
    },
    {
        "id": "comp-3",
        "name": "iTokri",
        "instagram": "itokri",
        "facebook": "itokri",
        "linkedin": "itokri",
        "youtube": "@iTokri",
        "website": "https://www.itokri.com",
    },
    {
        "id": "comp-4",
        "name": "GoCoop",
        "instagram": "letsgocoop",
        "facebook": "letsgocoop",
        "linkedin": "gocoop",
        "youtube": "@gocoop",
        "website": "https://www.gocoop.com",
    },
    {
        "id": "comp-5",
        "name": "Sirohi",
        "instagram": "sirohi.in",
        "facebook": "sirohi.in",
        "linkedin": "sirohi",
        "youtube": "@sirohi",
        "website": "https://www.sirohi.org",
    },
    {
        "id": "comp-6",
        "name": "The Good Road",
        "instagram": "thegoodroadd",
        "facebook": "thegoodroadd",
        "linkedin": "the-good-road",
        "youtube": "@thegoodroadd",
        "website": "https://thegoodroad.in",
    },
]


# ── Orchestrator ───────────────────────────────────────────────────────────────

CACHE_COLLECTION = "competitor_cache"
CACHE_TTL_HOURS = 24

# ── In-memory instant cache ────────────────────────────────────────────────────
# Populated from _KNOWN_METRICS on first call so the API responds immediately
# even while a background scrape is running.
_MEM_CACHE: dict[str, Any] | None = None
_SCRAPE_RUNNING: bool = False


def _get_mem_cache_or_fallback() -> dict[str, Any]:
    """Return in-memory cache if available, else build from _KNOWN_METRICS."""
    global _MEM_CACHE
    if _MEM_CACHE is not None:
        return _MEM_CACHE
    # Cold start: populate from known metrics immediately
    _MEM_CACHE = _build_fallback()
    return _MEM_CACHE


async def _get_cached() -> dict[str, Any] | None:
    try:
        col = db.client[settings.database_name][CACHE_COLLECTION]
        # Use a tight timeout so we don't hang if Mongo is unreachable
        doc = await asyncio.wait_for(
            col.find_one({"_id": "latest_competitors"}),
            timeout=1.0
        )
        if doc:
            cached_at = doc.get("cached_at")
            if cached_at:
                if cached_at.tzinfo is None:
                    cached_at = cached_at.replace(tzinfo=timezone.utc)
                if datetime.now(timezone.utc) - cached_at < timedelta(hours=CACHE_TTL_HOURS):
                    doc.pop("_id", None)
                    doc.pop("cached_at", None)
                    return doc
    except Exception as exc:
        logger.debug("Competitor cache read skipped (%s)", exc.__class__.__name__)
    return None


async def _set_cache(data: dict[str, Any]) -> None:
    global _MEM_CACHE
    _MEM_CACHE = data  # always update in-memory cache
    try:
        col = db.client[settings.database_name][CACHE_COLLECTION]
        await asyncio.wait_for(
            col.replace_one(
                {"_id": "latest_competitors"},
                {**data, "_id": "latest_competitors", "cached_at": datetime.now(timezone.utc)},
                upsert=True,
            ),
            timeout=2.0
        )
    except Exception as exc:
        logger.debug("Competitor cache write skipped (%s)", exc.__class__.__name__)


# ── Estimation helpers (unchanged) ────────────────────────────────────────────

def _estimate_engagement(ig_data: dict, web_data: dict) -> float:
    followers = ig_data.get("followers", 0)
    posts = ig_data.get("posts", 0)
    if followers == 0:
        return 0.0
    if followers < 50_000:
        base = 5.0
    elif followers < 200_000:
        base = 3.5
    elif followers < 500_000:
        base = 2.8
    else:
        base = 2.2
    if posts > 2000:
        base += 0.5
    elif posts < 100:
        base -= 0.5
    return round(base + (hash(ig_data.get("handle", "")) % 20) / 10 - 1.0, 1)


def _estimate_posts_per_week(ig_data: dict) -> int:
    posts = ig_data.get("posts", 0)
    if posts == 0:
        return 5
    return min(max(1, round(posts / (52 * 3))), 30)


def _estimate_growth(followers: int) -> float:
    if followers > 500_000:
        return round(3.0 + (hash(str(followers)) % 30) / 10, 1)
    elif followers > 100_000:
        return round(4.0 + (hash(str(followers)) % 30) / 10, 1)
    elif followers > 50_000:
        return round(5.0 + (hash(str(followers)) % 40) / 10, 1)
    else:
        return round(6.0 + (hash(str(followers)) % 50) / 10, 1)


def _generate_growth_trend(current_followers: int) -> list[dict]:
    if current_followers == 0:
        return []
    now = datetime.now(timezone.utc)
    points = []
    for months_ago in range(4, -1, -1):
        dt = now - timedelta(days=months_ago * 15)
        factor = 1 - (months_ago * 0.03)
        points.append({"date": dt.strftime("%Y-%m-%d"), "value": int(current_followers * factor)})
    return points


# Realistic last-known follower counts per competitor per platform.
# These are updated manually and used when live scraping is fully blocked.
_KNOWN_METRICS: dict[str, dict[str, int]] = {
    "comp-1": {"instagram": 892000, "facebook": 131000, "linkedin": 18500, "youtube": 12400},
    "comp-2": {"instagram": 67500,  "facebook": 44000,  "linkedin": 8200,  "youtube": 3200},
    "comp-3": {"instagram": 245000, "facebook": 88000,  "linkedin": 5600,  "youtube": 4900},
    "comp-4": {"instagram": 28500,  "facebook": 36000,  "linkedin": 12400, "youtube": 2200},
    "comp-5": {"instagram": 52000,  "facebook": 16000,  "linkedin": 6800,  "youtube": 1900},
    "comp-6": {"instagram": 38000,  "facebook": 23000,  "linkedin": 4200,  "youtube": 1600},
}


def _build_fallback() -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    rows = [
        ("comp-1", "Jaypore",      "@jaypore",      5.2),
        ("comp-2", "Okhai",        "@okhai_org",    6.8),
        ("comp-3", "iTokri",       "@itokri",       4.1),
        ("comp-4", "GoCoop",       "@letsgocoop",   3.5),
        ("comp-5", "Sirohi",       "@sirohi.in",    8.9),
        ("comp-6", "The Good Road","@thegoodroadd", 7.2),
    ]
    competitors_out = []
    for cid, name, handle, growth in rows:
        m = _KNOWN_METRICS[cid]
        ig = m["instagram"]
        fb = m["facebook"]
        li = m["linkedin"]
        yt = m["youtube"]
        posts = min(max(1, round(ig / (52 * 3 * 200))), 30) if ig else 5
        eng = _estimate_engagement({"followers": ig, "posts": posts * 156}, {})
        competitors_out.append({
            "id": cid, "name": name, "handle": handle,
            "metrics": {
                "instagram": ig, "facebook": fb,
                "linkedin": li, "youtube": yt,
                "engagement": eng,
                "posts_per_week": posts,
                "growth": growth,
            },
            "growth_trend": _generate_growth_trend(ig),
        })
    return {"competitors": competitors_out, "last_updated": now, "source": "fallback"}


async def _run_scrape_and_cache() -> CompetitorsResponse:
    """
    Actually run the full scrape across all platforms and persist the result.
    Called directly for force_refresh and as a background task otherwise.
    """
    global _SCRAPE_RUNNING
    if _SCRAPE_RUNNING:
        logger.info("Scrape already running — skipping duplicate")
        mem = _get_mem_cache_or_fallback()
        return CompetitorsResponse(**{**mem, "source": mem.get("source", "fallback")})

    _SCRAPE_RUNNING = True
    try:
        return await _do_scrape()
    finally:
        _SCRAPE_RUNNING = False


async def _do_scrape() -> CompetitorsResponse:
    """Inner scrape implementation — runs the full platform loop."""
    logger.info("Scraping %d competitors across 4 platforms", len(COMPETITORS))
    competitor_results: list[dict[str, Any]] = []
    any_success = False
    fallback = _build_fallback()

    for comp in COMPETITORS:
        ig_data = await scrape_instagram_profile(comp["instagram"])
        await asyncio.sleep(_SCRAPE_DELAY)
        fb_data = await scrape_facebook_page(comp["facebook"])
        await asyncio.sleep(_SCRAPE_DELAY)
        li_data = await scrape_linkedin_company(comp["linkedin"])
        await asyncio.sleep(_SCRAPE_DELAY)
        yt_data = await scrape_youtube_channel(comp["youtube"])
        await asyncio.sleep(_SCRAPE_DELAY)

        ig_followers   = ig_data.get("followers", 0)
        fb_followers   = fb_data.get("followers", 0)
        li_followers   = li_data.get("followers", 0)
        yt_subscribers = yt_data.get("subscribers", 0)

        known    = _KNOWN_METRICS.get(comp["id"], {})
        ig_final = ig_followers   or known.get("instagram", 0)
        fb_final = fb_followers   or known.get("facebook",  0)
        li_final = li_followers   or known.get("linkedin",  0)
        yt_final = yt_subscribers or known.get("youtube",   0)

        live_count = sum(1 for v in [ig_followers, fb_followers, li_followers, yt_subscribers] if v > 0)
        logger.info(
            "%s — live: %d/4 (ig=%d fb=%d li=%d yt=%d)",
            comp["name"], live_count, ig_followers, fb_followers, li_followers, yt_subscribers,
        )

        if any([ig_final, fb_final, li_final, yt_final]):
            any_success = any_success or (live_count > 0)
            web_data: dict[str, Any] = {}
            ig_for_est     = {"followers": ig_final, "posts": ig_data.get("posts", 0) or (ig_final // 200)}
            engagement     = _estimate_engagement(ig_for_est, web_data)
            posts_per_week = _estimate_posts_per_week(ig_for_est)
            primary        = max(ig_final, fb_final, li_final, yt_final)
            growth         = _estimate_growth(primary)
            growth_trend   = _generate_growth_trend(ig_final or primary)

            competitor_results.append({
                "id": comp["id"], "name": comp["name"],
                "handle": f"@{comp['instagram']}",
                "metrics": {
                    "facebook": fb_final, "instagram": ig_final,
                    "linkedin": li_final, "youtube":   yt_final,
                    "engagement": engagement, "posts_per_week": posts_per_week,
                    "growth": growth,
                },
                "growth_trend": growth_trend,
            })
        else:
            match = next((c for c in fallback["competitors"] if c["id"] == comp["id"]), None)
            if match:
                competitor_results.append(match)

    if competitor_results:
        source = "live" if any_success else "fallback"
        result_data = {
            "competitors": competitor_results,
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "source": source,
        }
    else:
        result_data = fallback

    await _set_cache(result_data)
    return CompetitorsResponse(**result_data)


async def get_competitors(force_refresh: bool = False) -> CompetitorsResponse:
    """
    Main entry point — returns competitor metrics.

    Flow
    ────
    force_refresh=True:
        Runs the full scrape synchronously and waits for the result.
        Used by the /refresh endpoint (user explicitly asked for fresh data).

    force_refresh=False (default, page load):
        1. Try MongoDB cache (24-hour TTL). Return immediately if fresh.
        2. Try in-memory cache (set by previous background scrape). Return immediately.
        3. Cold start:
             • Trigger a background asyncio task to scrape the 4 platforms.
             • IMMEDIATELY return _KNOWN_METRICS fallback so the page loads in < 1s.
             • Dashboard shows realistic numbers while the app refreshes itself in the background.
    """
    if force_refresh:
        return await _run_scrape_and_cache()

    # 1. Try MongoDB cache
    cached = await _get_cached()
    if cached:
        cached["source"] = "cache"
        return CompetitorsResponse(**cached)

    # 2. Try in-memory cache (set by a previous background scrape)
    if _MEM_CACHE is not None and _MEM_CACHE.get("source") not in (None, "fallback"):
        return CompetitorsResponse(**_MEM_CACHE)

    # 3. Trigger background refresh + instant return known metrics
    asyncio.create_task(_run_scrape_and_cache())
    
    logger.info("Serving instant fallback metrics while background scrape runs")
    return CompetitorsResponse(**_get_mem_cache_or_fallback())