"""
Insights routers — supports CSV-driven upserts and Meta-style read responses.
"""

from datetime import timedelta
from typing import Annotated, Optional

from beanie import Document
from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from app.models.facebook import FacebookInsight
from app.models.instagram import InstagramInsight
from app.services.csv_ingest import (
    expand_csv_payloads,
    merge_csv_updates,
    parse_date_value,
    upsert_platform_insights,
)

VALID_PERIODS = {"day", "week", "days_28", "month", "lifetime", "total_over_range"}

INSTAGRAM_METRIC_QUERY_ALIASES = {
    "total_interactions": "content_interactions",
    "profile_links_taps": "instagram_link_clicks",
    "accounts_engaged": "instagram_profile_visits",
    "additional_follows": "instagram_follows",
}

FACEBOOK_METRIC_QUERY_ALIASES = {
    "total_interactions": "content_interactions",
    "profile_links_taps": "facebook_link_clicks",
    "accounts_engaged": "viewers",
    "additional_follows": "facebook_follows",
}

INSTAGRAM_METRIC_META = {
    "views": {
        "title": "Views",
        "description": "Total number of times the content was viewed.",
    },
    "reach": {
        "title": "Reach",
        "description": "Number of unique Instagram accounts that saw the content.",
    },
    "content_interactions": {
        "title": "Content interactions",
        "description": "Interactions such as likes, saves, comments, and shares.",
    },
    "instagram_link_clicks": {
        "title": "Instagram link clicks",
        "description": "Number of taps/clicks on links from Instagram.",
    },
    "instagram_profile_visits": {
        "title": "Instagram profile visits",
        "description": "Number of profile visits.",
    },
    "instagram_follows": {
        "title": "Instagram follows",
        "description": "Number of followers gained.",
    },
}

FACEBOOK_METRIC_META = {
    "views": {
        "title": "Views",
        "description": "Total number of times the content was viewed.",
    },
    "viewers": {
        "title": "Viewers",
        "description": "Number of unique Facebook viewers.",
    },
    "content_interactions": {
        "title": "Content interactions",
        "description": "Interactions such as reactions, comments, and shares.",
    },
    "facebook_link_clicks": {
        "title": "Facebook link clicks",
        "description": "Number of taps/clicks on links from Facebook content.",
    },
    "facebook_visits": {
        "title": "Facebook visits",
        "description": "Number of page visits on Facebook.",
    },
    "facebook_follows": {
        "title": "Facebook follows",
        "description": "Number of followers gained on Facebook.",
    },
}

instagram_router = APIRouter(prefix="/stub/insta", tags=["Instagram Insights"])
facebook_router = APIRouter(prefix="/facebook", tags=["Facebook Insights"])


def _metric_meta(metric: str, metric_map: dict[str, dict[str, str]]) -> dict[str, str]:
    default_title = metric.replace("_", " ").title()
    return metric_map.get(
        metric,
        {
            "title": default_title,
            "description": f"Imported metric '{metric}'.",
        },
    )


def _normalize_metric_query(metric_name: str, aliases: dict[str, str]) -> str:
    return aliases.get(metric_name, metric_name)


def _coerce_number(value: int | float) -> int | float:
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def _aggregate_for_period(
    entries: list[Document],
    stored_metric: str,
    response_metric: str,
    period: str,
    account_id: str,
    metric_meta_map: dict[str, dict[str, str]],
) -> dict:
    metric_entries = [
        entry
        for entry in sorted(entries, key=lambda item: item.date)
        if stored_metric in entry.metrics
    ]
    metric_meta = _metric_meta(stored_metric, metric_meta_map)

    if not metric_entries:
        return {
            "name": response_metric,
            "period": period,
            "values": [],
            "title": metric_meta["title"],
            "description": metric_meta["description"],
            "id": f"{account_id}/insights/{response_metric}/{period}",
        }

    if period in ("lifetime", "total_over_range"):
        total = _coerce_number(
            sum(entry.metrics[stored_metric] for entry in metric_entries)
        )
        return {
            "name": response_metric,
            "period": period,
            "values": [{"value": total}],
            "title": metric_meta["title"],
            "description": metric_meta["description"],
            "id": f"{account_id}/insights/{response_metric}/{period}",
        }

    if period == "day":
        values = [
            {
                "value": _coerce_number(entry.metrics[stored_metric]),
                "end_time": entry.date.strftime("%Y-%m-%dT%H:%M:%S+0000"),
            }
            for entry in metric_entries
        ]
        return {
            "name": response_metric,
            "period": period,
            "values": values,
            "title": metric_meta["title"],
            "description": metric_meta["description"],
            "id": f"{account_id}/insights/{response_metric}/{period}",
        }

    window_days = {"week": 7, "days_28": 28, "month": 30}[period]
    buckets: list[dict] = []
    index = 0

    while index < len(metric_entries):
        bucket_start = metric_entries[index].date
        bucket_end = bucket_start + timedelta(days=window_days)
        bucket_entries = [
            entry for entry in metric_entries[index:] if entry.date < bucket_end
        ]

        bucket_value = _coerce_number(
            sum(entry.metrics[stored_metric] for entry in bucket_entries)
        )
        buckets.append(
            {
                "value": bucket_value,
                "end_time": bucket_end.strftime("%Y-%m-%dT%H:%M:%S+0000"),
            }
        )
        index += len(bucket_entries)

    return {
        "name": response_metric,
        "period": period,
        "values": buckets,
        "title": metric_meta["title"],
        "description": metric_meta["description"],
        "id": f"{account_id}/insights/{response_metric}/{period}",
    }


async def _import_payloads(
    account_id: str,
    payloads: list[tuple[str, bytes]],
    source: str,
    account_response_key: str,
    document_model: type[Document],
    account_field: str,
    platform: str,
) -> dict:
    try:
        expanded_payloads = expand_csv_payloads(payloads)
        updates_by_date, processed_files, metric_keys = merge_csv_updates(expanded_payloads)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not updates_by_date:
        raise HTTPException(
            status_code=400,
            detail="No valid CSV metric rows were found to import.",
        )

    created_entries, updated_entries = await upsert_platform_insights(
        document_model=document_model,
        account_field=account_field,
        account_id=account_id,
        platform=platform,
        updates_by_date=updates_by_date,
    )

    return {
        "message": "CSV import completed.",
        "source": source,
        account_response_key: account_id,
        "processed_files": processed_files,
        "touched_dates": len(updates_by_date),
        "created_entries": created_entries,
        "updated_entries": updated_entries,
        "metric_keys": metric_keys,
    }


async def _get_insights(
    account_id: str,
    metric: str,
    period: str,
    since: Optional[str],
    until: Optional[str],
    document_model: type[Document],
    account_field: str,
    metric_aliases: dict[str, str],
    metric_meta_map: dict[str, dict[str, str]],
) -> dict:
    if period not in VALID_PERIODS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid period '{period}'. Must be one of: {', '.join(sorted(VALID_PERIODS))}",
        )

    requested_metrics = [item.strip() for item in metric.split(",") if item.strip()]
    if not requested_metrics:
        raise HTTPException(status_code=400, detail="At least one metric is required.")

    query_filters: dict = {account_field: account_id}

    date_filter: dict = {}
    if since:
        try:
            date_filter["$gte"] = parse_date_value(since)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    if until:
        try:
            date_filter["$lte"] = parse_date_value(until)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    if date_filter:
        query_filters["date"] = date_filter

    entries = await document_model.find(query_filters).sort("+date").to_list()
    if not entries:
        return {"data": []}

    data = []
    for requested_metric in requested_metrics:
        stored_metric = _normalize_metric_query(requested_metric, metric_aliases)
        data.append(
            _aggregate_for_period(
                entries=entries,
                stored_metric=stored_metric,
                response_metric=requested_metric,
                period=period,
                account_id=account_id,
                metric_meta_map=metric_meta_map,
            )
        )

    return {"data": data}


async def _collect_upload_payloads(files: list[UploadFile]) -> list[tuple[str, bytes]]:
    payloads: list[tuple[str, bytes]] = []
    for uploaded_file in files:
        file_name = uploaded_file.filename or "uploaded_file"
        file_content = await uploaded_file.read()
        if not file_content:
            continue
        payloads.append((file_name, file_content))
    return payloads


@instagram_router.get("/get_data/{ig_user_id}/insights")
async def get_instagram_insights(
    ig_user_id: str,
    metric: str = Query(
        ...,
        description="Comma-separated list of metrics (e.g., views,reach,content_interactions)",
    ),
    period: str = Query(
        "day",
        description="Time period: day, week, days_28, month, lifetime, total_over_range",
    ),
    since: Optional[str] = Query(
        None,
        description="Start date (ISO-8601 or Unix timestamp)",
    ),
    until: Optional[str] = Query(
        None,
        description="End date (ISO-8601 or Unix timestamp)",
    ),
):
    return await _get_insights(
        account_id=ig_user_id,
        metric=metric,
        period=period,
        since=since,
        until=until,
        document_model=InstagramInsight,
        account_field="ig_user_id",
        metric_aliases=INSTAGRAM_METRIC_QUERY_ALIASES,
        metric_meta_map=INSTAGRAM_METRIC_META,
    )


@instagram_router.post("/import_data/{ig_user_id}/csvs")
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
    payloads = await _collect_upload_payloads(files)
    if not payloads:
        raise HTTPException(status_code=400, detail="No non-empty files were uploaded.")

    return await _import_payloads(
        account_id=ig_user_id,
        payloads=payloads,
        source="uploaded_files",
        account_response_key="ig_user_id",
        document_model=InstagramInsight,
        account_field="ig_user_id",
        platform="instagram",
    )


@instagram_router.post("/import_data/{ig_user_id}/folder")
async def import_instagram_csv_folder(
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
    archive_name = folder_archive.filename or "folder_upload.zip"
    archive_bytes = await folder_archive.read()
    if not archive_bytes:
        raise HTTPException(status_code=400, detail="Uploaded folder archive is empty.")

    result = await _import_payloads(
        account_id=ig_user_id,
        payloads=[(archive_name, archive_bytes)],
        source="uploaded_folder_zip",
        account_response_key="ig_user_id",
        document_model=InstagramInsight,
        account_field="ig_user_id",
        platform="instagram",
    )
    result["archive_name"] = archive_name
    return result


@facebook_router.get("/get_data/{fb_user_id}/insights")
async def get_facebook_insights(
    fb_user_id: str,
    metric: str = Query(
        ...,
        description="Comma-separated list of metrics (e.g., views,viewers,content_interactions)",
    ),
    period: str = Query(
        "day",
        description="Time period: day, week, days_28, month, lifetime, total_over_range",
    ),
    since: Optional[str] = Query(
        None,
        description="Start date (ISO-8601 or Unix timestamp)",
    ),
    until: Optional[str] = Query(
        None,
        description="End date (ISO-8601 or Unix timestamp)",
    ),
):
    return await _get_insights(
        account_id=fb_user_id,
        metric=metric,
        period=period,
        since=since,
        until=until,
        document_model=FacebookInsight,
        account_field="fb_user_id",
        metric_aliases=FACEBOOK_METRIC_QUERY_ALIASES,
        metric_meta_map=FACEBOOK_METRIC_META,
    )


@facebook_router.post("/import_data/{fb_user_id}/csvs")
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
    payloads = await _collect_upload_payloads(files)
    if not payloads:
        raise HTTPException(status_code=400, detail="No non-empty files were uploaded.")

    return await _import_payloads(
        account_id=fb_user_id,
        payloads=payloads,
        source="uploaded_files",
        account_response_key="fb_user_id",
        document_model=FacebookInsight,
        account_field="fb_user_id",
        platform="facebook",
    )


@facebook_router.post("/import_data/{fb_user_id}/folder")
async def import_facebook_csv_folder(
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
    archive_name = folder_archive.filename or "folder_upload.zip"
    archive_bytes = await folder_archive.read()
    if not archive_bytes:
        raise HTTPException(status_code=400, detail="Uploaded folder archive is empty.")

    result = await _import_payloads(
        account_id=fb_user_id,
        payloads=[(archive_name, archive_bytes)],
        source="uploaded_folder_zip",
        account_response_key="fb_user_id",
        document_model=FacebookInsight,
        account_field="fb_user_id",
        platform="facebook",
    )
    result["archive_name"] = archive_name
    return result


# Backward compatibility for existing imports.
router = instagram_router
