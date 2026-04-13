from datetime import datetime
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

    # Dynamic metric map keyed by normalized CSV metric/column names.
    # Examples: views, reach, content_interactions, instagram_link_clicks
    metrics: dict[str, int | float] = Field(
        default_factory=dict,
        description="Metric values keyed by normalized metric names",
    )

    class Settings:
        name = "instagram_insights_data"
        indexes = [
            "ig_user_id",
            "date",
        ]
