import httpx
from typing import Dict, Any, List
from datetime import datetime, timedelta

# Mock responses for LinkedIn data as actual API calls require valid organizational tokens
# that need to be provisioned via OAuth 2.0.

def get_overview(start_date: str, end_date: str) -> Dict[str, Any]:
    return {
        "total_followers": 15420,
        "new_followers": 342,
        "total_page_views": 8500,
        "total_post_impressions": 45000,
        "avg_engagement_rate": 4.8
    }

def get_posts_performance(start_date: str, end_date: str) -> Dict[str, Any]:
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
                "engagement_rate": 5.2
            },
            {
                "date": (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d"),
                "post_id": "urn:li:share:67890",
                "post_type": "Image",
                "reach": 8000,
                "impressions": 9500,
                "likes": 150,
                "comments": 12,
                "shares": 5,
                "clicks": 300,
                "engagement_rate": 3.1
            }
        ]
    }

def get_demographics() -> Dict[str, Any]:
    return {
        "total_followers": 15420,
        "demographics": [
            {"category": "Geography", "value": "North America", "follower_count": 6168, "percentage": 40.0},
            {"category": "Geography", "value": "Europe", "follower_count": 4626, "percentage": 30.0},
            {"category": "Geography", "value": "Asia", "follower_count": 3084, "percentage": 20.0},
            {"category": "Industry", "value": "Technology", "follower_count": 7710, "percentage": 50.0},
            {"category": "Industry", "value": "Retail", "follower_count": 3855, "percentage": 25.0},
            {"category": "Seniority", "value": "Senior", "follower_count": 5397, "percentage": 35.0},
            {"category": "Seniority", "value": "Manager", "follower_count": 4626, "percentage": 30.0}
        ]
    }

def get_page_traffic(start_date: str, end_date: str) -> Dict[str, Any]:
    # Generate last 7 days mock data
    traffic = []
    for i in range(7):
        date_str = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
        traffic.append({
            "date": date_str,
            "page_views": 1200 - (i * 50),
            "unique_visitors": 800 - (i * 30),
            "custom_button_clicks": 45 - (i * 2)
        })
    return {"traffic_data": traffic}
