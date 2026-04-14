"""Mongo document models for manual Instagram/Facebook insights imports."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

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


class InstagramDashboardWidgetInstance(BaseModel):
    """Stored widget instance for Instagram dashboard layout persistence."""

    model_config = ConfigDict(extra="forbid")

    instance_id: str = Field(..., description="Unique dashboard widget instance ID.")
    widget_id: str = Field(..., description="Widget template ID.")
    config: dict[str, Any] = Field(
        default_factory=dict,
        description="Widget-specific configuration payload.",
    )

    @field_validator("instance_id", "widget_id")
    @classmethod
    def _validate_non_empty_widget_fields(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Value cannot be empty.")
        return normalized


class InstagramDashboardLayoutUpsertRequest(BaseModel):
    """Request body for saving Instagram dashboard layout for a user."""

    model_config = ConfigDict(extra="forbid")

    dashboard_user_id: str | None = Field(
        default=None,
        description="Authenticated dashboard user ID. Falls back to ig_user_id when omitted.",
    )
    active_widgets: list[InstagramDashboardWidgetInstance] = Field(
        default_factory=list,
        description="Ordered list of widget instances currently active in the dashboard.",
    )

    @field_validator("dashboard_user_id")
    @classmethod
    def _normalize_dashboard_user_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class InstagramDashboardLayoutResponse(BaseModel):
    """Instagram dashboard layout payload returned by layout APIs."""

    model_config = ConfigDict(extra="forbid")

    ig_user_id: str
    dashboard_user_id: str
    active_widgets: list[InstagramDashboardWidgetInstance] = Field(default_factory=list)
    updated_at: datetime | None = Field(default=None, description="Last layout update timestamp in UTC.")


class FacebookDashboardLayoutResponse(BaseModel):
    """Facebook dashboard layout payload returned by layout APIs."""

    model_config = ConfigDict(extra="forbid")

    fb_user_id: str
    dashboard_user_id: str
    active_widgets: list[InstagramDashboardWidgetInstance] = Field(default_factory=list)
    updated_at: datetime | None = Field(default=None, description="Last layout update timestamp in UTC.")
