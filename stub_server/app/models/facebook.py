from datetime import datetime
from typing import Literal

from beanie import Document
from pydantic import Field


class FacebookInsight(Document):
    """
    Represents a single day's worth of Facebook page-level insights.
    Each document is one row of daily metrics for a given fb_user_id.
    """

    platform: Literal["facebook"] = Field(
        default="facebook",
        description="Social platform this document belongs to.",
    )

    # Which simulated Facebook account/page this data belongs to
    fb_user_id: str = Field(..., description="The Facebook page/account ID")

    # The date the metrics were recorded (stored as midnight UTC)
    date: datetime = Field(..., description="Date these metrics were recorded")

    # Dynamic metric map keyed by normalized CSV metric/column names.
    # Examples: views, viewers, facebook_visits, content_interactions
    metrics: dict[str, int | float] = Field(
        default_factory=dict,
        description="Metric values keyed by normalized metric names",
    )

    class Settings:
        name = "facebook_insights_data"
        indexes = [
            "platform",
            "fb_user_id",
            "date",
        ]
