"""Mongo document models for manual Instagram/Facebook insights imports."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class InstagramPostInsightDocument(BaseModel):
    """Stored shape for post-level Instagram insights keyed by post_id."""

    model_config = ConfigDict(extra="forbid")

    platform: Literal["instagram"] = "instagram"
    post_id: str = Field(..., description="Unique Instagram post/media ID.")
    ig_user_id: str = Field(..., description="Instagram user ID used for manual import.")
    account_id: str | None = Field(default=None, description="Account ID from CSV export.")
    account_username: str | None = Field(default=None, description="Account username from CSV export.")
    account_name: str | None = Field(default=None, description="Account display name from CSV export.")
    description: str | None = Field(default=None, description="Post caption/description.")
    duration_sec: int | float | None = Field(default=None, description="Post duration in seconds, when provided.")
    publish_time: datetime | None = Field(default=None, description="Post publish time in UTC.")
    permalink: str | None = Field(default=None, description="Instagram permalink for the post.")
    post_type: str | None = Field(default=None, description="Raw post type label from CSV export.")
    data_comment: str | None = Field(default=None, description="Data comment metadata from CSV export.")
    period: str = Field(default="lifetime", description="Insights period label in source CSV.")
    metrics: dict[str, int | float] = Field(
        default_factory=dict,
        description="Normalized metric values keyed by metric name.",
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Last upsert timestamp in UTC.",
    )

    @field_validator("post_id", "ig_user_id")
    @classmethod
    def _validate_non_empty_ids(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Value cannot be empty.")
        return normalized
