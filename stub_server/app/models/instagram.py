from datetime import datetime
from typing import Optional
from pydantic import Field
from beanie import Document


class InstagramInsight(Document):
    """
    Represents a single day's worth of Instagram account-level insights.
    Each document is one row of daily metrics for a given ig_user_id.
    """

    # Which simulated Instagram account this data belongs to
    ig_user_id: str = Field(..., description="The Instagram user/account ID")

    # The date the metrics were recorded (stored as midnight UTC)
    date: datetime = Field(..., description="Date these metrics were recorded")

    # ── Metrics (matching Meta's account-level insights) ──────────────
    views: int = Field(default=0, description="Total number of times content was viewed")
    profile_links_taps: int = Field(default=0, description="Taps on the bio link")
    total_interactions: int = Field(default=0, description="Likes, saves, comments, and shares")
    reach: int = Field(default=0, description="Unique accounts that saw content")
    accounts_engaged: int = Field(default=0, description="Unique accounts that interacted")
    additional_follows: int = Field(default=0, description="New followers gained")

    class Settings:
        name = "instagram_insights_data"
        indexes = [
            "ig_user_id",
            "date",
        ]
