"""
Dashboard summary service.

Computes channel health scores, KPI change deltas, engagement trend,
alerts, and top posts by pulling from the same MongoDB collections
used by the CSV-upload insights endpoints.

Falls back to stub values for channels that have no CSV data yet
(WhatsApp, YouTube) or when MongoDB is unavailable.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Any

from core.config import settings
from core.database import db

# ── Stub fallbacks (kept here, not in the frontend) ──────────────────────────

STUB_CHANNEL_HEALTH: dict[str, int] = {
    "instagram": 82,
    "facebook":  76,
    "linkedin":  68,
    "whatsapp":  90,
    "youtube":   79,
}

STUB_KPI_CHANGES: dict[str, float] = {
    "followers":   5.2,
    "engagement":  1.8,
    "impressions": 12.4,
    "ctr":         -0.3,
}

# 30-day daily stub engagement trend (deterministic — no Math.random)
_BASE_ENGAGEMENT = 2850
_DAILY_GROWTH = 14
STUB_ENGAGEMENT_TREND = [
    {
        "date": (datetime(2026, 2, 1, tzinfo=timezone.utc) + timedelta(days=i)).strftime("%Y-%m-%d"),
        "value": _BASE_ENGAGEMENT + _DAILY_GROWTH * i + (i % 7) * 45,
    }
    for i in range(30)
]

STUB_ALERTS = [
    {
        "id": "alert-1",
        "title": "Instagram Engagement Drop",
        "description": "Engagement rate dropped below 3% threshold for 3 consecutive days.",
        "channel": "instagram",
        "severity": "high",
        "status": "active",
        "metric": "Engagement Rate",
        "threshold": 3.0,
        "currentValue": 2.4,
        "createdAt": "2026-03-04T10:00:00Z",
    },
    {
        "id": "alert-2",
        "title": "LinkedIn Impressions Spike",
        "description": "Post impressions exceeded 150% of weekly average. Viral content detected.",
        "channel": "linkedin",
        "severity": "low",
        "status": "active",
        "metric": "Impressions",
        "threshold": 15000,
        "currentValue": 28000,
        "createdAt": "2026-03-04T08:00:00Z",
    },
    {
        "id": "alert-3",
        "title": "WhatsApp Delivery Rate Warning",
        "description": "Message delivery rate fell below 90% threshold.",
        "channel": "whatsapp",
        "severity": "medium",
        "status": "active",
        "metric": "Delivery Rate",
        "threshold": 90,
        "currentValue": 84,
        "createdAt": "2026-03-03T14:30:00Z",
    },
    {
        "id": "alert-4",
        "title": "Instagram Follower Milestone",
        "description": "Reached 28,000 followers — 12% growth this quarter.",
        "channel": "instagram",
        "severity": "low",
        "status": "resolved",
        "metric": "Followers",
        "threshold": 28000,
        "currentValue": 28400,
        "createdAt": "2026-03-02T09:00:00Z",
        "resolvedAt": "2026-03-02T09:15:00Z",
    },
    {
        "id": "alert-5",
        "title": "LinkedIn CTR Below Target",
        "description": "Click-through rate on LinkedIn posts is below 1.5% target.",
        "channel": "linkedin",
        "severity": "medium",
        "status": "active",
        "metric": "CTR",
        "threshold": 1.5,
        "currentValue": 1.1,
        "createdAt": "2026-03-01T11:00:00Z",
    },
    {
        "id": "alert-6",
        "title": "WhatsApp Response Time Alert",
        "description": "Average response time exceeded 30 minute threshold.",
        "channel": "whatsapp",
        "severity": "high",
        "status": "resolved",
        "metric": "Response Time",
        "threshold": 30,
        "currentValue": 42,
        "createdAt": "2026-02-28T16:00:00Z",
        "resolvedAt": "2026-03-01T08:00:00Z",
    },
    {
        "id": "alert-7",
        "title": "YouTube Views Surge",
        "description": "Video views exceeded 200% of weekly average. Viral content on Shorts.",
        "channel": "youtube",
        "severity": "low",
        "status": "active",
        "metric": "Views",
        "threshold": 50000,
        "currentValue": 128000,
        "createdAt": "2026-03-04T12:00:00Z",
    },
    {
        "id": "alert-8",
        "title": "YouTube Watch Time Drop",
        "description": "Average view duration dropped below 3 minute threshold for long-form videos.",
        "channel": "youtube",
        "severity": "medium",
        "status": "active",
        "metric": "Avg View Duration",
        "threshold": 180,
        "currentValue": 145,
        "createdAt": "2026-03-03T09:00:00Z",
    },
]

STUB_TOP_POSTS = [
    {
        "title": "Behind the scenes of our latest mural installation",
        "engagement": 2700,
        "type": "Reel",
        "channel": "instagram",
    },
    {
        "title": "60 seconds of pure creativity 🎨",
        "engagement": 3453,
        "type": "Reel",
        "channel": "instagram",
    },
    {
        "title": "Our top 5 art collections this season",
        "engagement": 2055,
        "type": "Carousel",
        "channel": "instagram",
    },
]

# ── Health score computation ──────────────────────────────────────────────────

# Baseline reference values per platform for normalisation
_PLATFORM_BASELINES: dict[str, dict[str, float]] = {
    "instagram": {"engagementRate": 4.5, "ctr": 2.0, "reachPerFollower": 3.0},
    "facebook":  {"engagementRate": 3.5, "ctr": 1.8, "reachPerFollower": 2.5},
    "linkedin":  {"engagementRate": 3.0, "ctr": 1.5, "reachPerFollower": 3.5},
    "whatsapp":  {"engagementRate": 75.0, "ctr": 12.0, "reachPerFollower": 1.0},
    "youtube":   {"engagementRate": 5.0, "ctr": 4.0, "reachPerFollower": 20.0},
}

def compute_channel_health(
    *,
    platform: str,
    engagement_rate: float,
    ctr: float,
    followers: int,
    reach: int,
    has_live_data: bool,
) -> int:
    """
    Compute a 0-100 health score for a channel using a weighted formula.

    Weights:
      - Engagement rate vs platform baseline: 40 pts
      - CTR vs platform baseline:             25 pts
      - Reach-per-follower vs baseline:       25 pts
      - Penalty if no live CSV data present:  -10 pts
    """
    baseline = _PLATFORM_BASELINES.get(platform, _PLATFORM_BASELINES["instagram"])

    def _score(actual: float, reference: float, weight: float) -> float:
        if reference <= 0:
            return weight * 0.5
        ratio = actual / reference
        # sigmoid-like cap: score rises steeply up to 2× baseline, plateaus after
        normalised = min(ratio, 2.0) / 2.0
        return weight * normalised

    engagement_score = _score(engagement_rate, baseline["engagementRate"], 40)
    ctr_score        = _score(ctr, baseline["ctr"], 25)
    reach_per_follower = (reach / max(followers, 1))
    reach_score      = _score(reach_per_follower, baseline["reachPerFollower"], 25)

    raw = engagement_score + ctr_score + reach_score
    if not has_live_data:
        raw = max(raw - 10, 0)

    return max(0, min(100, round(raw)))


# ── MongoDB helpers ───────────────────────────────────────────────────────────

def _collection(name: str):
    """Return a MongoDB collection, or None if DB is not connected."""
    if db.client is None:
        return None
    return db.client[settings.database_name][name]


async def _aggregate_channel_metrics(
    collection_name: str,
    user_id: str,
    metric_keys: list[str],
    days: int = 30,
) -> dict[str, float]:
    """
    Sum the given metric_keys over the last `days` days for `user_id`.
    Returns a dict of {metric_key: total}.
    """
    coll = _collection(collection_name)
    if coll is None:
        return {}

    since = datetime.now(tz=timezone.utc) - timedelta(days=days)
    try:
        cursor = coll.find(
            {"ig_user_id": user_id, "date": {"$gte": since}},
            {"_id": 0, "metrics": 1, "date": 1},
        )
        totals: dict[str, float] = {k: 0.0 for k in metric_keys}
        count = 0
        async for doc in cursor:
            metrics: dict[str, Any] = doc.get("metrics", {})
            for key in metric_keys:
                val = metrics.get(key, 0)
                if isinstance(val, (int, float)):
                    totals[key] += val
            count += 1
        return totals if count > 0 else {}
    except Exception:  # noqa: BLE001
        return {}


async def _aggregate_fb_metrics(
    user_id: str,
    metric_keys: list[str],
    days: int = 30,
) -> dict[str, float]:
    """Same as above but for the Facebook collection."""
    coll = _collection(settings.facebook_collection_name)
    if coll is None:
        return {}

    since = datetime.now(tz=timezone.utc) - timedelta(days=days)
    try:
        cursor = coll.find(
            {"fb_user_id": user_id, "date": {"$gte": since}},
            {"_id": 0, "metrics": 1},
        )
        totals: dict[str, float] = {k: 0.0 for k in metric_keys}
        count = 0
        async for doc in cursor:
            metrics = doc.get("metrics", {})
            for key in metric_keys:
                val = metrics.get(key, 0)
                if isinstance(val, (int, float)):
                    totals[key] += val
            count += 1
        return totals if count > 0 else {}
    except Exception:  # noqa: BLE001
        return {}


async def _aggregate_li_metrics(
    org_id: str,
    metric_keys: list[str],
    days: int = 30,
) -> dict[str, float]:
    """Same but for the LinkedIn collection (keyed by li_org_id)."""
    coll = _collection(settings.linkedin_collection_name)
    if coll is None:
        return {}

    since = datetime.now(tz=timezone.utc) - timedelta(days=days)
    try:
        cursor = coll.find(
            {"li_org_id": org_id, "date": {"$gte": since}},
            {"_id": 0, "metrics": 1},
        )
        totals: dict[str, float] = {k: 0.0 for k in metric_keys}
        count = 0
        async for doc in cursor:
            metrics = doc.get("metrics", {})
            for key in metric_keys:
                val = metrics.get(key, 0)
                if isinstance(val, (int, float)):
                    totals[key] += val
            count += 1
        return totals if count > 0 else {}
    except Exception:  # noqa: BLE001
        return {}


async def _get_engagement_trend(days: int = 30) -> list[dict[str, Any]]:
    """
    Build a daily combined-engagement series from Instagram + Facebook data.
    Falls back to the deterministic stub when no data is present.
    """
    ig_coll = _collection(settings.instagram_collection_name)
    fb_coll = _collection(settings.facebook_collection_name)

    if ig_coll is None and fb_coll is None:
        return STUB_ENGAGEMENT_TREND

    since = datetime.now(tz=timezone.utc) - timedelta(days=days)
    daily: dict[str, float] = {}

    for coll, key in [(ig_coll, "content_interactions"), (fb_coll, "content_interactions")]:
        if coll is None:
            continue
        try:
            cursor = coll.find(
                {"date": {"$gte": since}},
                {"_id": 0, "metrics": 1, "date": 1},
            )
            async for doc in cursor:
                date_val = doc.get("date")
                if isinstance(date_val, datetime):
                    date_str = date_val.strftime("%Y-%m-%d")
                else:
                    continue
                val = doc.get("metrics", {}).get(key, 0)
                if isinstance(val, (int, float)):
                    daily[date_str] = daily.get(date_str, 0) + val
        except Exception:  # noqa: BLE001
            pass

    if not daily:
        return STUB_ENGAGEMENT_TREND

    return [{"date": d, "value": round(v)} for d, v in sorted(daily.items())]


async def _get_top_posts_from_db(ig_user_id: str, limit: int = 3) -> list[dict[str, Any]]:
    """
    Fetch top Instagram posts by total_interactions from the posts collection.
    Falls back to stubs if nothing is in the DB.
    """
    coll = _collection(settings.instagram_posts_collection_name)
    if coll is None:
        return STUB_TOP_POSTS

    try:
        cursor = coll.find(
            {"ig_user_id": ig_user_id},
            {"_id": 0, "title": 1, "media_product_type": 1, "metrics": 1},
        ).sort("metrics.total_interactions", -1).limit(limit)

        posts = []
        async for doc in cursor:
            metrics = doc.get("metrics", {})
            interactions = metrics.get("total_interactions", 0)
            if not isinstance(interactions, (int, float)):
                interactions = 0
            title = doc.get("title") or "Untitled post"
            post_type = doc.get("media_product_type") or "Post"
            posts.append({
                "title": title,
                "engagement": round(interactions),
                "type": post_type.title(),
                "channel": "instagram",
            })
        return posts if posts else STUB_TOP_POSTS
    except Exception:  # noqa: BLE001
        return STUB_TOP_POSTS


async def _compute_kpi_changes(
    ig_user_id: str,
    fb_user_id: str,
) -> dict[str, float]:
    """
    Compare this period (last 30 days) vs prior period (31-60 days ago)
    for combined followers, engagement, impressions, and CTR.

    Returns % change values rounded to 1 decimal place.
    Falls back to stub changes where data is insufficient.
    """
    ig_coll = _collection(settings.instagram_collection_name)
    fb_coll = _collection(settings.facebook_collection_name)

    if ig_coll is None and fb_coll is None:
        return STUB_KPI_CHANGES

    now = datetime.now(tz=timezone.utc)
    period_end   = now
    period_start = now - timedelta(days=30)
    prior_end    = period_start
    prior_start  = now - timedelta(days=60)

    def _pct_change(current: float, prior: float) -> float:
        if prior == 0:
            return 0.0
        return round((current - prior) / prior * 100, 1)

    async def _sum_metric(coll, id_field: str, id_val: str, metric: str, start: datetime, end: datetime) -> float:
        if coll is None:
            return 0.0
        total = 0.0
        try:
            cursor = coll.find(
                {id_field: id_val, "date": {"$gte": start, "$lt": end}},
                {"_id": 0, "metrics": 1},
            )
            async for doc in cursor:
                val = doc.get("metrics", {}).get(metric, 0)
                if isinstance(val, (int, float)):
                    total += val
        except Exception:  # noqa: BLE001
            pass
        return total

    # followers (follows metric)
    ig_follows_curr  = await _sum_metric(ig_coll, "ig_user_id",  ig_user_id, "instagram_follows",  period_start, period_end)
    ig_follows_prior = await _sum_metric(ig_coll, "ig_user_id",  ig_user_id, "instagram_follows",  prior_start,  prior_end)
    fb_follows_curr  = await _sum_metric(fb_coll, "fb_user_id",  fb_user_id, "facebook_follows",   period_start, period_end)
    fb_follows_prior = await _sum_metric(fb_coll, "fb_user_id",  fb_user_id, "facebook_follows",   prior_start,  prior_end)

    followers_curr  = ig_follows_curr  + fb_follows_curr
    followers_prior = ig_follows_prior + fb_follows_prior

    # engagement (content_interactions)
    ig_eng_curr  = await _sum_metric(ig_coll, "ig_user_id", ig_user_id, "content_interactions", period_start, period_end)
    ig_eng_prior = await _sum_metric(ig_coll, "ig_user_id", ig_user_id, "content_interactions", prior_start,  prior_end)
    fb_eng_curr  = await _sum_metric(fb_coll, "fb_user_id", fb_user_id, "content_interactions", period_start, period_end)
    fb_eng_prior = await _sum_metric(fb_coll, "fb_user_id", fb_user_id, "content_interactions", prior_start,  prior_end)

    engagement_curr  = ig_eng_curr  + fb_eng_curr
    engagement_prior = ig_eng_prior + fb_eng_prior

    # impressions (views)
    ig_imp_curr  = await _sum_metric(ig_coll, "ig_user_id", ig_user_id, "views", period_start, period_end)
    ig_imp_prior = await _sum_metric(ig_coll, "ig_user_id", ig_user_id, "views", prior_start,  prior_end)
    fb_imp_curr  = await _sum_metric(fb_coll, "fb_user_id", fb_user_id, "views", period_start, period_end)
    fb_imp_prior = await _sum_metric(fb_coll, "fb_user_id", fb_user_id, "views", prior_start,  prior_end)

    impressions_curr  = ig_imp_curr  + fb_imp_curr
    impressions_prior = ig_imp_prior + fb_imp_prior

    # CTR (link clicks / views)
    ig_clicks_curr  = await _sum_metric(ig_coll, "ig_user_id", ig_user_id, "instagram_link_clicks", period_start, period_end)
    ig_clicks_prior = await _sum_metric(ig_coll, "ig_user_id", ig_user_id, "instagram_link_clicks", prior_start,  prior_end)
    fb_clicks_curr  = await _sum_metric(fb_coll, "fb_user_id", fb_user_id, "facebook_link_clicks",  period_start, period_end)
    fb_clicks_prior = await _sum_metric(fb_coll, "fb_user_id", fb_user_id, "facebook_link_clicks",  prior_start,  prior_end)

    ctr_curr  = (ig_clicks_curr  + fb_clicks_curr)  / max(ig_imp_curr  + fb_imp_curr,  1) * 100
    ctr_prior = (ig_clicks_prior + fb_clicks_prior) / max(ig_imp_prior + fb_imp_prior, 1) * 100

    # Use stubs for any metric where both periods returned 0 (no data)
    result: dict[str, float] = {}
    result["followers"]   = _pct_change(followers_curr,  followers_prior)  if (followers_curr  or followers_prior)  else STUB_KPI_CHANGES["followers"]
    result["engagement"]  = _pct_change(engagement_curr, engagement_prior) if (engagement_curr or engagement_prior) else STUB_KPI_CHANGES["engagement"]
    result["impressions"] = _pct_change(impressions_curr, impressions_prior) if (impressions_curr or impressions_prior) else STUB_KPI_CHANGES["impressions"]
    result["ctr"]         = _pct_change(ctr_curr, ctr_prior)               if (ig_imp_curr     or fb_imp_curr)      else STUB_KPI_CHANGES["ctr"]

    return result


# ── Main summary function ─────────────────────────────────────────────────────

_IG_USER_ID = "ClubArtizen"
_FB_USER_ID = "ClubArtizen"
_LI_ORG_ID  = "ClubArtizen"


async def get_dashboard_summary() -> dict[str, Any]:
    """
    Assemble and return the full dashboard summary payload.
    """
    # ── 1. Aggregate raw metrics for health score computation ─────────────
    ig_metrics = await _aggregate_channel_metrics(
        settings.instagram_collection_name,
        _IG_USER_ID,
        ["views", "reach", "content_interactions", "instagram_link_clicks", "instagram_follows"],
    )
    fb_metrics = await _aggregate_fb_metrics(
        _FB_USER_ID,
        ["views", "viewers", "content_interactions", "facebook_link_clicks", "facebook_follows"],
    )
    li_metrics = await _aggregate_li_metrics(
        _LI_ORG_ID,
        ["impressions_total", "clicks_total", "reactions_total", "unique_impressions_organic"],
    )

    # ── 2. Compute health scores ──────────────────────────────────────────
    has_ig = bool(ig_metrics)
    has_fb = bool(fb_metrics)
    has_li = bool(li_metrics)

    ig_views       = ig_metrics.get("views", 0) or 1
    ig_eng_rate    = (ig_metrics.get("content_interactions", 0) / ig_views * 100) if has_ig else 0
    ig_ctr         = (ig_metrics.get("instagram_link_clicks", 0) / ig_views * 100) if has_ig else 0
    ig_followers   = int(ig_metrics.get("instagram_follows", 0)) if has_ig else 28400
    ig_reach       = int(ig_metrics.get("reach", 0)) if has_ig else 89000

    fb_views       = fb_metrics.get("views", 0) or 1
    fb_eng_rate    = (fb_metrics.get("content_interactions", 0) / fb_views * 100) if has_fb else 0
    fb_ctr         = (fb_metrics.get("facebook_link_clicks", 0) / fb_views * 100) if has_fb else 0
    fb_followers   = int(fb_metrics.get("facebook_follows", 0)) if has_fb else 22800
    fb_reach       = int(fb_metrics.get("viewers", 0)) if has_fb else 71000

    li_impressions = li_metrics.get("impressions_total", 0) or 1
    li_clicks      = li_metrics.get("clicks_total", 0)
    li_reactions   = li_metrics.get("reactions_total", 0)
    li_eng_rate    = ((li_clicks + li_reactions) / li_impressions * 100) if has_li else 0
    li_ctr         = (li_clicks / li_impressions * 100) if has_li else 0
    li_followers   = int(li_metrics.get("unique_impressions_organic", 0)) if has_li else 12300
    li_reach       = int(li_impressions) if has_li else 45000

    channel_health = {
        "instagram": compute_channel_health(
            platform="instagram",
            engagement_rate=ig_eng_rate if has_ig else STUB_CHANNEL_HEALTH["instagram"] / 15,
            ctr=ig_ctr if has_ig else STUB_CHANNEL_HEALTH["instagram"] / 25,
            followers=ig_followers,
            reach=ig_reach,
            has_live_data=has_ig,
        ) if has_ig else STUB_CHANNEL_HEALTH["instagram"],

        "facebook": compute_channel_health(
            platform="facebook",
            engagement_rate=fb_eng_rate if has_fb else STUB_CHANNEL_HEALTH["facebook"] / 15,
            ctr=fb_ctr if has_fb else STUB_CHANNEL_HEALTH["facebook"] / 25,
            followers=fb_followers,
            reach=fb_reach,
            has_live_data=has_fb,
        ) if has_fb else STUB_CHANNEL_HEALTH["facebook"],

        "linkedin": compute_channel_health(
            platform="linkedin",
            engagement_rate=li_eng_rate if has_li else STUB_CHANNEL_HEALTH["linkedin"] / 15,
            ctr=li_ctr if has_li else STUB_CHANNEL_HEALTH["linkedin"] / 25,
            followers=li_followers,
            reach=li_reach,
            has_live_data=has_li,
        ) if has_li else STUB_CHANNEL_HEALTH["linkedin"],

        # WhatsApp and YouTube: no CSV pipeline yet, use named stubs
        "whatsapp": STUB_CHANNEL_HEALTH["whatsapp"],
        "youtube":  STUB_CHANNEL_HEALTH["youtube"],
    }

    # ── 3. KPI change percentages ──────────────────────────────────────────
    kpi_changes = await _compute_kpi_changes(_IG_USER_ID, _FB_USER_ID)

    # ── 4. Engagement trend ────────────────────────────────────────────────
    engagement_trend = await _get_engagement_trend(days=30)

    # ── 5. Top posts ───────────────────────────────────────────────────────
    top_posts = await _get_top_posts_from_db(_IG_USER_ID, limit=3)

    return {
        "channelHealth": channel_health,
        "kpiChanges": kpi_changes,
        "engagementTrend": engagement_trend,
        "alerts": STUB_ALERTS,
        "topPosts": top_posts,
    }
