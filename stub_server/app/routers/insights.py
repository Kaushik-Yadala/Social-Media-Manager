"""
Insights router — supports CSV-driven upserts and Meta-style read responses.
"""

from datetime import timedelta
from typing import Annotated, Optional

from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from app.models.instagram import InstagramInsight
from app.services.csv_ingest import (
    expand_csv_payloads,
    merge_csv_updates,
    parse_date_value,
    upsert_insights,
)

router = APIRouter(prefix="/stub/insta", tags=["Instagram Insights"])

VALID_PERIODS = {"day", "week", "days_28", "month", "lifetime", "total_over_range"}

METRIC_QUERY_ALIASES = {
    "total_interactions": "content_interactions",
    "profile_links_taps": "instagram_link_clicks",
    "accounts_engaged": "instagram_profile_visits",
    "additional_follows": "instagram_follows",
}

METRIC_META = {
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


def _metric_meta(metric: str) -> dict[str, str]:
    default_title = metric.replace("_", " ").title()
    return METRIC_META.get(
        metric,
        {
            "title": default_title,
            "description": f"Imported metric '{metric}'.",
        },
    )


def _normalize_metric_query(metric_name: str) -> str:
    return METRIC_QUERY_ALIASES.get(metric_name, metric_name)


def _coerce_number(value: int | float) -> int | float:
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def _aggregate_for_period(
    entries: list[InstagramInsight],
    stored_metric: str,
    response_metric: str,
    period: str,
    ig_user_id: str,
) -> dict:
    metric_entries = [
        entry
        for entry in sorted(entries, key=lambda item: item.date)
        if stored_metric in entry.metrics
    ]
    metric_meta = _metric_meta(stored_metric)

    if not metric_entries:
        return {
            "name": response_metric,
            "period": period,
            "values": [],
            "title": metric_meta["title"],
            "description": metric_meta["description"],
            "id": f"{ig_user_id}/insights/{response_metric}/{period}",
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
            "id": f"{ig_user_id}/insights/{response_metric}/{period}",
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
            "id": f"{ig_user_id}/insights/{response_metric}/{period}",
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
        "id": f"{ig_user_id}/insights/{response_metric}/{period}",
    }


async def _import_payloads(
    ig_user_id: str,
    payloads: list[tuple[str, bytes]],
    source: str,
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

    created_entries, updated_entries = await upsert_insights(ig_user_id, updates_by_date)

    return {
        "message": "CSV import completed.",
        "source": source,
        "ig_user_id": ig_user_id,
        "processed_files": processed_files,
        "touched_dates": len(updates_by_date),
        "created_entries": created_entries,
        "updated_entries": updated_entries,
        "metric_keys": metric_keys,
    }


@router.get("/get_data/{ig_user_id}/insights")
async def get_insights(
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
    if period not in VALID_PERIODS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid period '{period}'. Must be one of: {', '.join(sorted(VALID_PERIODS))}",
        )

    requested_metrics = [item.strip() for item in metric.split(",") if item.strip()]
    if not requested_metrics:
        raise HTTPException(status_code=400, detail="At least one metric is required.")

    query_filters: dict = {"ig_user_id": ig_user_id}

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

    entries = await InstagramInsight.find(query_filters).sort("+date").to_list()
    if not entries:
        return {"data": []}

    data = []
    for requested_metric in requested_metrics:
        stored_metric = _normalize_metric_query(requested_metric)
        data.append(
            _aggregate_for_period(
                entries=entries,
                stored_metric=stored_metric,
                response_metric=requested_metric,
                period=period,
                ig_user_id=ig_user_id,
            )
        )

    return {"data": data}


@router.post("/import_data/{ig_user_id}/csvs")
async def import_csv_uploads(
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
    payloads: list[tuple[str, bytes]] = []
    for uploaded_file in files:
        file_name = uploaded_file.filename or "uploaded_file"
        file_content = await uploaded_file.read()
        if not file_content:
            continue
        payloads.append((file_name, file_content))

    if not payloads:
        raise HTTPException(status_code=400, detail="No non-empty files were uploaded.")

    return await _import_payloads(
        ig_user_id=ig_user_id,
        payloads=payloads,
        source="uploaded_files",
    )


@router.post("/import_data/{ig_user_id}/folder")
async def import_csv_folder(
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
        ig_user_id=ig_user_id,
        payloads=[(archive_name, archive_bytes)],
        source="uploaded_folder_zip",
    )
    result["archive_name"] = archive_name
    return result
