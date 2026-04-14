"""Backend routes for Instagram/Facebook insights APIs."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, File, Query, UploadFile

from models.social_insights_models import InstagramDashboardLayoutUpsertRequest
import services.social_insights_service as social_insights

router = APIRouter(prefix="/manual", tags=["Instagram and Facebook Insights"])


@router.get("/insta/insights/{ig_user_id}")
async def get_instagram_insights(
    ig_user_id: str,
    metric: str = Query(
        ...,
        description="Comma-separated list of metrics (e.g., views,reach,content_interactions).",
    ),
    period: str = Query(
        "day",
        description="Time period: day, week, days_28, month, lifetime, total_over_range.",
    ),
    since: str | None = Query(None, description="Start date (ISO-8601 or Unix timestamp)."),
    until: str | None = Query(None, description="End date (ISO-8601 or Unix timestamp)."),
):
    return await social_insights.get_instagram_insights(
        ig_user_id, metric, period, since, until
    )


@router.post("/insta/csvs/{ig_user_id}")
async def import_instagram_csv_uploads(
    ig_user_id: str,
    files: Annotated[
        list[UploadFile],
        File(
            ...,
            description="One or more CSV files, or a ZIP containing CSV files.",
            json_schema_extra={"items": {"type": "string", "format": "binary"}},
        ),
    ],
):
    return await social_insights.import_instagram_csvs(ig_user_id, files)


@router.post("/insta/folder/{ig_user_id}", include_in_schema=False)
@router.post("/insta/folders/{ig_user_id}")
async def import_instagram_folder_upload(
    ig_user_id: str,
    folder_archive: Annotated[
        UploadFile,
        File(
            ...,
            description="ZIP file of a folder containing CSV files.",
            json_schema_extra={"type": "string", "format": "binary"},
        ),
    ],
):
    return await social_insights.import_instagram_folder(ig_user_id, folder_archive)


@router.get("/insta/layout/{ig_user_id}")
async def get_instagram_dashboard_layout(
    ig_user_id: str,
    dashboard_user_id: str | None = Query(
        None,
        description="Dashboard user ID used to scope persisted widget layout.",
    ),
):
    return await social_insights.get_instagram_dashboard_layout(
        ig_user_id=ig_user_id,
        dashboard_user_id=dashboard_user_id,
    )


@router.put("/insta/layout/{ig_user_id}")
async def save_instagram_dashboard_layout(
    ig_user_id: str,
    payload: InstagramDashboardLayoutUpsertRequest,
):
    return await social_insights.save_instagram_dashboard_layout(
        ig_user_id=ig_user_id,
        dashboard_user_id=payload.dashboard_user_id,
        active_widgets=payload.active_widgets,
    )


@router.post("/insta/posts/{ig_user_id}/csvs")
async def import_instagram_posts_csv_upload(
    ig_user_id: str,
    posts_csv: Annotated[
        list[UploadFile],
        File(
            ...,
            description="One or more Instagram post-level CSV exports (for example posts.csv).",
            json_schema_extra={"items": {"type": "string", "format": "binary"}},
        ),
    ],
):
    return await social_insights.import_instagram_posts_csv(ig_user_id, posts_csv)


@router.get("/insta/posts/{instagram_media_id}/insights")
async def get_instagram_post_insights(
    instagram_media_id: str,
    metric: str | None = Query(
        None,
        description=(
            "Comma-separated post metrics: "
            "views,likes,comments,shares,saved,reach,follows,total_interactions. "
            "Leave empty to return all available metrics."
        ),
    ),
    period: str = Query(
        "lifetime",
        description="Per Instagram media insights documentation, period is lifetime.",
    ),
    post_id: str | None = Query(
        None,
        description=(
            "Optional post ID when instagram_media_id is an ig_user_id. "
            "If omitted, instagram_media_id can be either post_id or ig_user_id."
        ),
    ),
    breakdown: str | None = Query(
        None,
        description="Optional breakdown. Not available for imported CSV post metrics.",
    ),
):
    return await social_insights.get_instagram_post_insights(
        instagram_media_id=instagram_media_id,
        metric=metric,
        period=period,
        post_id=post_id,
        breakdown=breakdown,
    )


@router.get("/facebook/insights/{fb_user_id}")
async def get_facebook_insights(
    fb_user_id: str,
    metric: str = Query(
        ...,
        description="Comma-separated list of metrics (e.g., views,viewers,content_interactions).",
    ),
    period: str = Query(
        "day",
        description="Time period: day, week, days_28, month, lifetime, total_over_range.",
    ),
    since: str | None = Query(None, description="Start date (ISO-8601 or Unix timestamp)."),
    until: str | None = Query(None, description="End date (ISO-8601 or Unix timestamp)."),
):
    return await social_insights.get_facebook_insights(
        fb_user_id, metric, period, since, until
    )


@router.get("/facebook/layout/{fb_user_id}")
async def get_facebook_dashboard_layout(
    fb_user_id: str,
    dashboard_user_id: str | None = Query(
        None,
        description="Dashboard user ID used to scope persisted widget layout.",
    ),
):
    return await social_insights.get_facebook_dashboard_layout(
        fb_user_id=fb_user_id,
        dashboard_user_id=dashboard_user_id,
    )


@router.put("/facebook/layout/{fb_user_id}")
async def save_facebook_dashboard_layout(
    fb_user_id: str,
    payload: InstagramDashboardLayoutUpsertRequest,
):
    return await social_insights.save_facebook_dashboard_layout(
        fb_user_id=fb_user_id,
        dashboard_user_id=payload.dashboard_user_id,
        active_widgets=payload.active_widgets,
    )


@router.post("/facebook/csvs/{fb_user_id}")
async def import_facebook_csv_uploads(
    fb_user_id: str,
    files: Annotated[
        list[UploadFile],
        File(
            ...,
            description="One or more CSV files, or a ZIP containing CSV files.",
            json_schema_extra={"items": {"type": "string", "format": "binary"}},
        ),
    ],
):
    return await social_insights.import_facebook_csvs(fb_user_id, files)


@router.post("/facebook/folder/{fb_user_id}", include_in_schema=False)
@router.post("/facebook/folders/{fb_user_id}")
async def import_facebook_folder_upload(
    fb_user_id: str,
    folder_archive: Annotated[
        UploadFile,
        File(
            ...,
            description="ZIP file of a folder containing CSV files.",
            json_schema_extra={"type": "string", "format": "binary"},
        ),
    ],
):
    return await social_insights.import_facebook_folder(fb_user_id, folder_archive)
