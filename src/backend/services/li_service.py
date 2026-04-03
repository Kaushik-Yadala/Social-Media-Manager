from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict


FIXTURE_DIR = Path(__file__).resolve().parent.parent / "fixtures" / "generated"


def _load_fixture() -> Dict[str, Any] | None:
    fp = FIXTURE_DIR / "linkedin.json"
    if not fp.exists():
        return None
    with open(fp) as f:
        return json.load(f)


def _fallback_overview() -> Dict[str, Any]:
    return {
        "total_followers": 15420,
        "new_followers": 342,
        "total_page_views": 8500,
        "total_post_impressions": 45000,
        "avg_engagement_rate": 4.8,
    }


def get_overview(start_date: str, end_date: str) -> Dict[str, Any]:
    fixture = _load_fixture()
    if not fixture or "overview" not in fixture:
        return _fallback_overview()

    ov = fixture["overview"]
    return {
        "total_followers": int(ov.get("followers", 0)),
        "new_followers": int(max(0, ov.get("followers_change", 0) * 100)),
        "total_page_views": int(ov.get("unique_visitors", 0)),
        "total_post_impressions": int(ov.get("impressions", 0)),
        "avg_engagement_rate": float(ov.get("engagement_rate", 0.0)),
    }


def get_posts_performance(start_date: str, end_date: str) -> Dict[str, Any]:
    fixture = _load_fixture()
    if fixture and "top_posts" in fixture and "posts" in fixture["top_posts"]:
        posts = []
        for p in fixture["top_posts"]["posts"]:
            posts.append(
                {
                    "date": p.get("published", "")[:10],
                    "post_id": p.get("post_id", ""),
                    "post_type": p.get("post_type", "Post"),
                    "reach": int(p.get("impressions", 0)),
                    "impressions": int(p.get("impressions", 0)),
                    "likes": int(p.get("reactions", 0)),
                    "comments": int(p.get("comments", 0)),
                    "shares": int(p.get("shares", 0)),
                    "clicks": int(p.get("clicks", 0)),
                    "engagement_rate": float(p.get("engagement_rate", 0.0)),
                }
            )
        return {"posts": posts}

    return {
        "posts": [
            {
                "date": (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d"),
                "post_id": "urn:li:share:12345",
                "post_type": "Article",
                "reach": 12000,
                "impressions": 15000,
                "likes": 340,
                "comments": 45,
                "shares": 20,
                "clicks": 800,
                "engagement_rate": 5.2,
            }
        ]
    }


def get_demographics() -> Dict[str, Any]:
    fixture = _load_fixture()
    if fixture and "demographics" in fixture and "overview" in fixture:
        dem = fixture["demographics"]
        flattened = []
        mapping = {
            "by_function": "Function",
            "by_seniority": "Seniority",
            "by_industry": "Industry",
            "by_location": "Geography",
        }
        for key, label in mapping.items():
            for item in dem.get(key, []):
                flattened.append(
                    {
                        "category": label,
                        "value": item.get("category", "Unknown"),
                        "follower_count": int(item.get("count", 0)),
                        "percentage": float(item.get("value", 0.0)),
                    }
                )

        return {
            "total_followers": int(fixture["overview"].get("followers", 0)),
            "demographics": flattened,
        }

    return {
        "total_followers": 15420,
        "demographics": [
            {"category": "Geography", "value": "North America", "follower_count": 6168, "percentage": 40.0},
            {"category": "Industry", "value": "Technology", "follower_count": 7710, "percentage": 50.0},
            {"category": "Seniority", "value": "Senior", "follower_count": 5397, "percentage": 35.0},
        ],
    }


def get_page_traffic(start_date: str, end_date: str) -> Dict[str, Any]:
    fixture = _load_fixture()
    if fixture and "page_views" in fixture and "series" in fixture["page_views"]:
        traffic = []
        for row in fixture["page_views"]["series"]:
            views = int(row.get("value", 0))
            traffic.append(
                {
                    "date": row.get("date", ""),
                    "page_views": views,
                    "unique_visitors": int(views * 0.75),
                    "custom_button_clicks": int(views * 0.04),
                }
            )
        return {"traffic_data": traffic}

    traffic = []
    for i in range(7):
        date_str = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
        traffic.append({
            "date": date_str,
            "page_views": 1200 - (i * 50),
            "unique_visitors": 800 - (i * 30),
            "custom_button_clicks": 45 - (i * 2),
        })
    return {"traffic_data": traffic}
