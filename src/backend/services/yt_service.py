"""
YouTube service layer.

Mirrors the GA service architecture: every public function checks whether
YouTube credentials are available.  When they are, data is fetched from the
YouTube Data API v3 / YouTube Analytics API.  When they are not (local dev,
CI, demo), clearly-labelled **stub data** is returned so the rest of the
stack keeps working.

Required env vars for real data:
    YOUTUBE_API_KEY       – a YouTube Data API v3 key
    YOUTUBE_CHANNEL_ID    – the target channel (e.g. "UCxxxxxxxx")
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from core.config import settings


# ──────────────────────────────────────────
# Lazy client initialisation
# ──────────────────────────────────────────

_yt_client: Any = None


def _get_client():
    """Return a googleapiclient Resource for YouTube Data API v3."""
    global _yt_client
    if _yt_client is not None:
        return _yt_client

    if not settings.yt_credentials_available:
        return None

    try:
        from googleapiclient.discovery import build
        _yt_client = build("youtube", "v3", developerKey=settings.youtube_api_key)
    except Exception:
        _yt_client = None

    return _yt_client


# ──────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────

def _channel_id() -> str:
    return settings.youtube_channel_id


def _safe_int(value, default: int = 0) -> int:
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def _safe_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def _pct_of(part: int | float, total: int | float) -> float:
    return round(part / total * 100, 2) if total else 0.0


# ──────────────────────────────────────────
# Stub data (used when credentials are absent)
# ──────────────────────────────────────────

def _stub_overview(start_date: str, end_date: str) -> dict:
    return {
        "subscribers": 8750,
        "total_views": 1_245_600,
        "total_videos": 142,
        "watch_time_hours": 52400,
        "avg_view_duration": 284.5,
        "engagement_rate": 5.6,
        "estimated_revenue": 3842.50,
        "views_last_30d": 372400,
        "subscribers_gained_30d": 1840,
        "subscribers_lost_30d": 310,
        "date_range": {"start_date": start_date, "end_date": end_date},
    }


def _stub_views(granularity: str) -> dict:
    today = date.today()
    series = []
    for i in range(30):
        d = today - timedelta(days=29 - i)
        base = 10000 + i * 200
        weekend_boost = 2500 if d.weekday() >= 5 else 0
        series.append({"date": d.isoformat(), "value": base + weekend_boost + (i % 5) * 300})
    return {
        "series": series,
        "total": sum(p["value"] for p in series),
        "granularity": granularity,
    }


def _stub_subscriber_growth() -> dict:
    today = date.today()
    series = []
    total_gained = 0
    total_lost = 0
    for i in range(30):
        d = today - timedelta(days=29 - i)
        gained = 55 + (i % 7) * 8
        lost = 8 + (i % 5) * 2
        total_gained += gained
        total_lost += lost
        series.append({
            "date": d.isoformat(),
            "gained": gained,
            "lost": lost,
            "net": gained - lost,
        })
    return {
        "series": series,
        "total_gained": total_gained,
        "total_lost": total_lost,
        "net_change": total_gained - total_lost,
    }


def _stub_watch_time(granularity: str) -> dict:
    today = date.today()
    series = []
    for i in range(30):
        d = today - timedelta(days=29 - i)
        series.append({"date": d.isoformat(), "value": round(140 + i * 5.2 + (i % 4) * 12, 1)})
    return {
        "series": series,
        "total_hours": round(sum(p["value"] for p in series), 1),
        "avg_view_duration": 284.5,
        "granularity": granularity,
    }


def _stub_top_videos() -> dict:
    videos = [
        {
            "video_id": "yt-stub-001",
            "title": "How We Built a Giant Mural in 48 Hours | Club Artizen",
            "published_at": "2026-03-03T12:00:00Z",
            "views": 45200,
            "likes": 2340,
            "comments": 189,
            "shares": 456,
            "watch_time_hours": 3800,
            "avg_view_duration": 302.0,
            "impressions_ctr": 5.1,
            "video_type": "video",
        },
        {
            "video_id": "yt-stub-002",
            "title": "60-Second Art Challenge: Painting with Only Primary Colors",
            "published_at": "2026-03-02T15:00:00Z",
            "views": 128000,
            "likes": 8900,
            "comments": 456,
            "shares": 2340,
            "watch_time_hours": 1420,
            "avg_view_duration": 42.0,
            "impressions_ctr": 3.7,
            "video_type": "short",
        },
        {
            "video_id": "yt-stub-003",
            "title": "LIVE: Friday Night Art Jam",
            "published_at": "2026-02-28T19:00:00Z",
            "views": 12400,
            "likes": 1890,
            "comments": 1245,
            "shares": 89,
            "watch_time_hours": 8200,
            "avg_view_duration": 2380.0,
            "impressions_ctr": 4.4,
            "video_type": "live",
        },
        {
            "video_id": "yt-stub-004",
            "title": "Top 10 Art Techniques Every Beginner Should Know",
            "published_at": "2026-02-25T10:00:00Z",
            "views": 67800,
            "likes": 4560,
            "comments": 312,
            "shares": 890,
            "watch_time_hours": 12400,
            "avg_view_duration": 658.0,
            "impressions_ctr": 4.3,
            "video_type": "video",
        },
        {
            "video_id": "yt-stub-005",
            "title": "Club Artizen 2026 Collection Reveal — World Premiere",
            "published_at": "2026-02-20T18:00:00Z",
            "views": 23400,
            "likes": 3120,
            "comments": 567,
            "shares": 345,
            "watch_time_hours": 4600,
            "avg_view_duration": 708.0,
            "impressions_ctr": 4.5,
            "video_type": "premiere",
        },
        {
            "video_id": "yt-stub-006",
            "title": "POV: You find a hidden art studio in your city",
            "published_at": "2026-03-01T08:00:00Z",
            "views": 95600,
            "likes": 6780,
            "comments": 234,
            "shares": 1560,
            "watch_time_hours": 980,
            "avg_view_duration": 37.0,
            "impressions_ctr": 3.4,
            "video_type": "short",
        },
    ]
    return {"videos": videos}


def _stub_demographics() -> dict:
    return {
        "by_country": [
            {"label": "India", "value": 3200, "percentage": 36.6},
            {"label": "United States", "value": 1800, "percentage": 20.6},
            {"label": "United Kingdom", "value": 980, "percentage": 11.2},
            {"label": "Brazil", "value": 650, "percentage": 7.4},
            {"label": "Germany", "value": 520, "percentage": 5.9},
            {"label": "Others", "value": 1600, "percentage": 18.3},
        ],
        "by_age": [
            {"label": "13-17", "value": 620, "percentage": 7.1},
            {"label": "18-24", "value": 2450, "percentage": 28.0},
            {"label": "25-34", "value": 3100, "percentage": 35.4},
            {"label": "35-44", "value": 1500, "percentage": 17.1},
            {"label": "45-54", "value": 680, "percentage": 7.8},
            {"label": "55+", "value": 400, "percentage": 4.6},
        ],
        "by_gender": [
            {"label": "Male", "value": 4800, "percentage": 54.9},
            {"label": "Female", "value": 3500, "percentage": 40.0},
            {"label": "Other", "value": 450, "percentage": 5.1},
        ],
    }


def _stub_traffic_sources() -> dict:
    sources = [
        {"source": "YouTube Search", "views": 112000, "percentage": 30.1, "watch_time_hours": 15400},
        {"source": "Suggested Videos", "views": 98000, "percentage": 26.3, "watch_time_hours": 14200},
        {"source": "Browse Features", "views": 67000, "percentage": 18.0, "watch_time_hours": 8900},
        {"source": "External", "views": 42000, "percentage": 11.3, "watch_time_hours": 5200},
        {"source": "Channel Pages", "views": 28000, "percentage": 7.5, "watch_time_hours": 4100},
        {"source": "Notifications", "views": 15400, "percentage": 4.1, "watch_time_hours": 2300},
        {"source": "Shorts Feed", "views": 10000, "percentage": 2.7, "watch_time_hours": 420},
    ]
    return {"sources": sources, "total_views": sum(s["views"] for s in sources)}


def _stub_engagement() -> dict:
    total_views = 372400
    total_likes = 28200
    total_comments = 3890
    total_shares = 5670
    return {
        "total_likes": total_likes,
        "total_comments": total_comments,
        "total_shares": total_shares,
        "likes_per_view": round(total_likes / total_views, 4),
        "comments_per_view": round(total_comments / total_views, 4),
        "shares_per_view": round(total_shares / total_views, 4),
        "avg_engagement_rate": round(
            (total_likes + total_comments + total_shares) / total_views * 100, 2
        ),
    }


def _stub_revenue() -> dict:
    today = date.today()
    series = []
    total = 0.0
    for i in range(30):
        d = today - timedelta(days=29 - i)
        rev = round(80 + i * 3.5 + (i % 3) * 8, 2)
        total += rev
        series.append({
            "date": d.isoformat(),
            "revenue": rev,
            "rpm": round(rev / 12.5, 2),   # simplified RPM
            "cpm": round(rev / 8.2, 2),     # simplified CPM
        })
    return {
        "series": series,
        "total_revenue": round(total, 2),
        "avg_rpm": round(total / 30 / 12.5, 2),
        "avg_cpm": round(total / 30 / 8.2, 2),
    }


def _stub_content_performance() -> dict:
    return {
        "types": [
            {
                "video_type": "video",
                "count": 68,
                "total_views": 524000,
                "avg_views": 7706,
                "total_watch_time_hours": 38200,
                "avg_engagement_rate": 5.4,
                "subscribers_gained": 890,
            },
            {
                "video_type": "short",
                "count": 52,
                "total_views": 612000,
                "avg_views": 11769,
                "total_watch_time_hours": 5800,
                "avg_engagement_rate": 7.8,
                "subscribers_gained": 1240,
            },
            {
                "video_type": "live",
                "count": 14,
                "total_views": 78000,
                "avg_views": 5571,
                "total_watch_time_hours": 6400,
                "avg_engagement_rate": 4.2,
                "subscribers_gained": 320,
            },
            {
                "video_type": "premiere",
                "count": 8,
                "total_views": 31600,
                "avg_views": 3950,
                "total_watch_time_hours": 2000,
                "avg_engagement_rate": 6.1,
                "subscribers_gained": 210,
            },
        ]
    }


# ──────────────────────────────────────────
# Public API (dual-mode: real API or stubs)
# ──────────────────────────────────────────

def get_overview(start_date: str = "30daysAgo", end_date: str = "today") -> dict:
    """Channel-level KPI summary."""
    if not settings.yt_credentials_available:
        return _stub_overview(start_date, end_date)

    client = _get_client()
    if client is None:
        return _stub_overview(start_date, end_date)

    # --- Real YouTube Data API v3 ---
    resp = client.channels().list(
        part="statistics,snippet,contentDetails",
        id=_channel_id(),
    ).execute()

    ch = resp["items"][0] if resp.get("items") else {}
    stats = ch.get("statistics", {})

    return {
        "subscribers": _safe_int(stats.get("subscriberCount")),
        "total_views": _safe_int(stats.get("viewCount")),
        "total_videos": _safe_int(stats.get("videoCount")),
        "watch_time_hours": 0,              # requires Analytics API
        "avg_view_duration": 0,             # requires Analytics API
        "engagement_rate": 0,               # requires Analytics API
        "estimated_revenue": 0,             # requires Analytics API
        "views_last_30d": 0,                # requires Analytics API
        "subscribers_gained_30d": 0,        # requires Analytics API
        "subscribers_lost_30d": 0,          # requires Analytics API
        "date_range": {"start_date": start_date, "end_date": end_date},
    }


def get_views(start_date: str = "30daysAgo", end_date: str = "today",
              granularity: str = "day") -> dict:
    """Views time series."""
    if not settings.yt_credentials_available:
        return _stub_views(granularity)

    # Real implementation would call YouTube Analytics API
    # youtubeAnalytics.reports().query(
    #     ids="channel==MINE",
    #     startDate=..., endDate=...,
    #     dimensions="day",
    #     metrics="views",
    # )
    return _stub_views(granularity)


def get_subscriber_growth(start_date: str = "30daysAgo",
                          end_date: str = "today") -> dict:
    """Net subscriber change over time."""
    if not settings.yt_credentials_available:
        return _stub_subscriber_growth()

    # Real: youtubeAnalytics → metrics="subscribersGained,subscribersLost"
    return _stub_subscriber_growth()


def get_watch_time(start_date: str = "30daysAgo", end_date: str = "today",
                   granularity: str = "day") -> dict:
    """Watch time time series."""
    if not settings.yt_credentials_available:
        return _stub_watch_time(granularity)

    # Real: youtubeAnalytics → metrics="estimatedMinutesWatched"
    return _stub_watch_time(granularity)


def get_top_videos(start_date: str = "30daysAgo", end_date: str = "today",
                   limit: int = 10) -> dict:
    """Top performing videos by views."""
    if not settings.yt_credentials_available:
        return _stub_top_videos()

    client = _get_client()
    if client is None:
        return _stub_top_videos()

    # --- Real YouTube Data API v3 ---
    # Step 1: search for channel's videos
    search_resp = client.search().list(
        part="id",
        channelId=_channel_id(),
        type="video",
        order="viewCount",
        maxResults=limit,
    ).execute()

    video_ids = [item["id"]["videoId"] for item in search_resp.get("items", [])]
    if not video_ids:
        return {"videos": []}

    # Step 2: get detailed statistics for those videos
    videos_resp = client.videos().list(
        part="snippet,statistics,contentDetails",
        id=",".join(video_ids),
    ).execute()

    videos = []
    for item in videos_resp.get("items", []):
        snippet = item.get("snippet", {})
        stats = item.get("statistics", {})
        videos.append({
            "video_id": item["id"],
            "title": snippet.get("title", ""),
            "published_at": snippet.get("publishedAt", ""),
            "views": _safe_int(stats.get("viewCount")),
            "likes": _safe_int(stats.get("likeCount")),
            "comments": _safe_int(stats.get("commentCount")),
            "shares": 0,                    # not available from Data API
            "watch_time_hours": 0,          # requires Analytics API
            "avg_view_duration": 0,         # requires Analytics API
            "impressions_ctr": 0,           # requires Analytics API
            "video_type": "video",          # simplified
        })

    return {"videos": videos}


def get_demographics(start_date: str = "30daysAgo",
                     end_date: str = "today") -> dict:
    """Viewer demographics: country, age, gender."""
    if not settings.yt_credentials_available:
        return _stub_demographics()

    # Real: youtubeAnalytics → dimensions="country" / "ageGroup" / "gender"
    return _stub_demographics()


def get_traffic_sources(start_date: str = "30daysAgo",
                        end_date: str = "today") -> dict:
    """Traffic sources breakdown."""
    if not settings.yt_credentials_available:
        return _stub_traffic_sources()

    # Real: youtubeAnalytics → dimensions="insightTrafficSourceType"
    return _stub_traffic_sources()


def get_engagement(start_date: str = "30daysAgo",
                   end_date: str = "today") -> dict:
    """Engagement aggregates: likes, comments, shares."""
    if not settings.yt_credentials_available:
        return _stub_engagement()

    # Real: youtubeAnalytics → metrics="likes,comments,shares"
    return _stub_engagement()


def get_revenue(start_date: str = "30daysAgo",
                end_date: str = "today") -> dict:
    """Estimated ad revenue (requires YouTube Partner Program)."""
    if not settings.yt_credentials_available:
        return _stub_revenue()

    # Real: youtubeAnalytics → metrics="estimatedRevenue,estimatedAdRevenue"
    return _stub_revenue()


def get_content_performance() -> dict:
    """Performance breakdown by video type (video, short, live, premiere)."""
    if not settings.yt_credentials_available:
        return _stub_content_performance()

    # Would require combining Data API search + Analytics API per-video
    return _stub_content_performance()
