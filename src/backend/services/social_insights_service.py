"""Instagram/Facebook insights service (native backend implementation)."""

from __future__ import annotations

import csv
import io
import zipfile
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path, PurePosixPath
from typing import Any

from fastapi import HTTPException, UploadFile
from pymongo.errors import PyMongoError

from core.config import settings
from core.database import db

ENCODING_CANDIDATES = (
    "utf-8-sig",
    "utf-16",
    "utf-16le",
    "utf-16be",
    "latin-1",
)

PRIMARY_COLUMN_ALIASES = {"primary", "value", "values"}
VALID_PERIODS = {"day", "week", "days_28", "month", "lifetime", "total_over_range"}

INSTAGRAM_METRIC_NAME_ALIASES = {
    "interactions": "content_interactions",
    "linkclicks": "instagram_link_clicks",
    "link_clicks": "instagram_link_clicks",
    "visits": "instagram_profile_visits",
    "follows": "instagram_follows",
}

FACEBOOK_METRIC_NAME_ALIASES = {
    "interactions": "content_interactions",
    "linkclicks": "facebook_link_clicks",
    "link_clicks": "facebook_link_clicks",
    "visits": "facebook_visits",
    "follows": "facebook_follows",
}

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

def _metric_name_aliases(platform: str) -> dict[str, str]:
    if platform == "instagram":
        return INSTAGRAM_METRIC_NAME_ALIASES
    return FACEBOOK_METRIC_NAME_ALIASES


def _get_collection(platform: str):
    if db.client is None:
        raise HTTPException(status_code=503, detail="Database is not initialized.")

    if platform == "instagram":
        collection_name = settings.instagram_collection_name
    else:
        collection_name = settings.facebook_collection_name

    return db.client[settings.database_name][collection_name]


def normalize_metric_name(value: str, aliases: dict[str, str] | None = None) -> str:
    value = value.strip().lower()
    normalized = []
    previous_was_separator = False

    for character in value:
        if character.isalnum():
            normalized.append(character)
            previous_was_separator = False
        elif not previous_was_separator:
            normalized.append("_")
            previous_was_separator = True

    result = "".join(normalized).strip("_")
    if aliases is None:
        return result
    return aliases.get(result, result)


def parse_date_value(value: str) -> datetime:
    text = value.strip().strip('"')
    if not text:
        raise ValueError("Date value is empty.")

    try:
        timestamp = float(text)
        parsed = datetime.fromtimestamp(timestamp, tz=timezone.utc)
    except ValueError:
        try:
            parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            for date_format in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%m/%d/%Y", "%d/%m/%Y"):
                try:
                    parsed = datetime.strptime(text, date_format)
                    break
                except ValueError:
                    continue
            else:
                raise ValueError(
                    f"Unsupported date '{text}'. Use ISO-8601, YYYY-MM-DD, or Unix timestamp."
                )

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc).replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )


def parse_numeric_value(value: str) -> int | float:
    text = value.strip().strip('"')
    if not text:
        raise ValueError("Numeric value is empty.")

    cleaned = text.replace(",", "")
    number = float(cleaned)
    if number.is_integer():
        return int(number)
    return number


def decode_csv_bytes(content: bytes) -> str:
    for encoding in ENCODING_CANDIDATES:
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ValueError("Unable to decode CSV. Supported encodings include UTF-8 and UTF-16.")


def _is_zip_payload(content: bytes) -> bool:
    return zipfile.is_zipfile(io.BytesIO(content))


def _is_supported_zip_csv_member(member: zipfile.ZipInfo) -> bool:
    if member.is_dir():
        return False

    member_path = PurePosixPath(member.filename)
    if member_path.suffix.lower() != ".csv":
        return False

    for part in member_path.parts:
        if not part:
            continue
        if part == "__MACOSX":
            return False
        if part.startswith(".") or part.startswith("._"):
            return False

    return True


def _load_csv_rows(content: bytes) -> list[list[str]]:
    decoded = decode_csv_bytes(content)
    lines = [line for line in decoded.splitlines() if line.strip()]
    if not lines:
        raise ValueError("CSV is empty.")

    delimiter = ","
    first_line = lines[0].strip().lstrip("\ufeff")
    if first_line.lower().startswith("sep="):
        declared_delimiter = first_line.split("=", 1)[1].strip()
        delimiter = declared_delimiter or ","
        lines = lines[1:]

    reader = csv.reader(lines, delimiter=delimiter)
    rows = [[cell.strip().lstrip("\ufeff") for cell in row] for row in reader]
    rows = [row for row in rows if any(cell.strip() for cell in row)]
    if not rows:
        raise ValueError("CSV has no usable rows.")
    return rows


def _parse_csv_content(
    source_name: str,
    content: bytes,
    metric_aliases: dict[str, str],
) -> tuple[dict[datetime, dict[str, int | float]], set[str]]:
    rows = _load_csv_rows(content)

    metric_title = ""
    if len(rows[0]) == 1:
        candidate_title = rows[0][0].strip().strip('"')
        if normalize_metric_name(candidate_title) != "date":
            metric_title = candidate_title
            rows = rows[1:]

    if len(rows) < 2:
        raise ValueError(f"{source_name}: CSV is missing a header row or data rows.")

    header_row = [column.strip().strip('"') for column in rows[0]]
    normalized_headers = [normalize_metric_name(column) for column in header_row]

    try:
        date_index = normalized_headers.index("date")
    except ValueError as exc:
        raise ValueError(f"{source_name}: missing required 'Date' column.") from exc

    value_indices = [
        index
        for index, column_name in enumerate(header_row)
        if index != date_index and column_name.strip()
    ]
    if not value_indices:
        raise ValueError(f"{source_name}: no metric columns were found.")

    metric_keys: dict[int, str] = {}
    for index in value_indices:
        metric_key = normalize_metric_name(header_row[index], metric_aliases)
        if len(value_indices) == 1 and metric_key in PRIMARY_COLUMN_ALIASES:
            fallback = metric_title or Path(source_name).stem
            metric_key = normalize_metric_name(fallback, metric_aliases)

        if not metric_key or metric_key == "date":
            raise ValueError(f"{source_name}: invalid metric column '{header_row[index]}'.")
        metric_keys[index] = metric_key

    updates_by_date: dict[datetime, dict[str, int | float]] = defaultdict(dict)

    for row_number, row in enumerate(rows[1:], start=2):
        if len(row) < len(header_row):
            row = row + [""] * (len(header_row) - len(row))

        raw_date = row[date_index].strip().strip('"')
        if not raw_date:
            continue

        try:
            normalized_date = parse_date_value(raw_date)
        except ValueError as exc:
            raise ValueError(
                f"{source_name}: invalid date '{raw_date}' at row {row_number}."
            ) from exc

        metric_updates: dict[str, int | float] = {}
        for column_index, metric_key in metric_keys.items():
            raw_value = row[column_index].strip().strip('"') if column_index < len(row) else ""
            if not raw_value:
                continue

            try:
                metric_updates[metric_key] = parse_numeric_value(raw_value)
            except ValueError as exc:
                column_name = header_row[column_index] or f"column_{column_index + 1}"
                raise ValueError(
                    f"{source_name}: invalid number '{raw_value}' for '{column_name}' at row {row_number}."
                ) from exc

        if metric_updates:
            updates_by_date[normalized_date].update(metric_updates)

    return updates_by_date, set(metric_keys.values())


def expand_csv_payloads(uploaded_files: list[tuple[str, bytes]]) -> list[tuple[str, bytes]]:
    expanded_payloads: list[tuple[str, bytes]] = []

    for source_name, content in uploaded_files:
        lower_name = source_name.lower()
        if lower_name.endswith(".zip") or _is_zip_payload(content):
            try:
                with zipfile.ZipFile(io.BytesIO(content)) as archive:
                    zip_csv_members = [
                        member
                        for member in archive.infolist()
                        if _is_supported_zip_csv_member(member)
                    ]
                    if not zip_csv_members:
                        raise ValueError(f"{source_name}: ZIP does not contain any CSV files.")

                    for member in zip_csv_members:
                        member_content = archive.read(member)
                        member_name = f"{source_name}:{member.filename}"
                        expanded_payloads.append((member_name, member_content))
            except zipfile.BadZipFile as exc:
                raise ValueError(f"{source_name}: invalid ZIP file.") from exc
            continue

        if lower_name.endswith(".csv"):
            expanded_payloads.append((source_name, content))
            continue

        raise ValueError(
            f"{source_name}: unsupported file type. Upload CSV files or a ZIP of CSV files."
        )

    return expanded_payloads


def merge_csv_updates(
    csv_payloads: list[tuple[str, bytes]],
    metric_aliases: dict[str, str],
) -> tuple[dict[datetime, dict[str, int | float]], int, list[str]]:
    merged_updates: dict[datetime, dict[str, int | float]] = defaultdict(dict)
    discovered_metrics: set[str] = set()

    for source_name, content in csv_payloads:
        file_updates, metric_keys = _parse_csv_content(source_name, content, metric_aliases)
        discovered_metrics.update(metric_keys)

        for date_key, metric_updates in file_updates.items():
            merged_updates[date_key].update(metric_updates)

    return merged_updates, len(csv_payloads), sorted(discovered_metrics)


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


def _extract_entry_points(
    entries: list[dict[str, Any]],
    stored_metric: str,
) -> list[dict[str, Any]]:
    points: list[dict[str, Any]] = []

    for entry in entries:
        entry_date = entry.get("date")
        metrics = entry.get("metrics")
        if not isinstance(entry_date, datetime) or not isinstance(metrics, dict):
            continue

        raw_value = metrics.get(stored_metric)
        if raw_value is None:
            continue

        try:
            numeric_value = float(raw_value)
        except (TypeError, ValueError):
            continue

        points.append(
            {
                "date": entry_date,
                "value": _coerce_number(numeric_value),
            }
        )

    points.sort(key=lambda item: item["date"])
    return points


def _aggregate_for_period(
    entries: list[dict[str, Any]],
    stored_metric: str,
    response_metric: str,
    period: str,
    account_id: str,
    metric_meta_map: dict[str, dict[str, str]],
) -> dict[str, Any]:
    metric_entries = _extract_entry_points(entries, stored_metric)
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
        total = _coerce_number(sum(float(entry["value"]) for entry in metric_entries))
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
                "value": entry["value"],
                "end_time": entry["date"].strftime("%Y-%m-%dT%H:%M:%S+0000"),
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
    buckets: list[dict[str, Any]] = []
    index = 0

    while index < len(metric_entries):
        bucket_start = metric_entries[index]["date"]
        bucket_end = bucket_start + timedelta(days=window_days)
        bucket_entries = [
            entry for entry in metric_entries[index:] if entry["date"] < bucket_end
        ]
        bucket_value = _coerce_number(sum(float(entry["value"]) for entry in bucket_entries))
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


async def _upsert_platform_insights(
    platform: str,
    account_field: str,
    account_id: str,
    updates_by_date: dict[datetime, dict[str, int | float]],
) -> tuple[int, int]:
    if not updates_by_date:
        return 0, 0

    collection = _get_collection(platform)
    dates = sorted(updates_by_date.keys())
    min_date = dates[0]
    max_date = dates[-1]

    try:
        existing_entries = await collection.find(
            {
                account_field: account_id,
                "date": {"$gte": min_date, "$lte": max_date},
            }
        ).to_list(length=None)
    except PyMongoError as exc:
        raise HTTPException(status_code=500, detail=f"Database query failed: {exc}") from exc

    existing_by_date = {
        entry["date"].date(): entry
        for entry in existing_entries
        if isinstance(entry.get("date"), datetime)
    }

    created_entries = 0
    updated_entries = 0

    for date_key in dates:
        metric_updates = updates_by_date[date_key]
        existing_entry = existing_by_date.get(date_key.date())

        try:
            if existing_entry:
                merged_metrics = dict(existing_entry.get("metrics") or {})
                merged_metrics.update(metric_updates)
                await collection.update_one(
                    {"_id": existing_entry["_id"]},
                    {
                        "$set": {
                            "platform": platform,
                            "metrics": merged_metrics,
                        }
                    },
                )
                updated_entries += 1
                continue

            await collection.insert_one(
                {
                    "platform": platform,
                    account_field: account_id,
                    "date": date_key,
                    "metrics": metric_updates,
                }
            )
            created_entries += 1
        except PyMongoError as exc:
            raise HTTPException(status_code=500, detail=f"Database write failed: {exc}") from exc

    return created_entries, updated_entries


async def _collect_upload_payloads(files: list[UploadFile]) -> list[tuple[str, bytes]]:
    payloads: list[tuple[str, bytes]] = []
    for uploaded_file in files:
        file_name = uploaded_file.filename or "uploaded_file"
        file_content = await uploaded_file.read()
        if not file_content:
            continue
        payloads.append((file_name, file_content))
    return payloads


async def _import_payloads(
    *,
    platform: str,
    account_field: str,
    account_response_key: str,
    account_id: str,
    source: str,
    payloads: list[tuple[str, bytes]],
) -> dict[str, Any]:
    try:
        expanded_payloads = expand_csv_payloads(payloads)
        updates_by_date, processed_files, metric_keys = merge_csv_updates(
            expanded_payloads,
            metric_aliases=_metric_name_aliases(platform),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not updates_by_date:
        raise HTTPException(
            status_code=400,
            detail="No valid CSV metric rows were found to import.",
        )

    created_entries, updated_entries = await _upsert_platform_insights(
        platform=platform,
        account_field=account_field,
        account_id=account_id,
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
    *,
    platform: str,
    account_field: str,
    account_id: str,
    metric: str,
    period: str,
    since: str | None,
    until: str | None,
    metric_aliases: dict[str, str],
    metric_meta_map: dict[str, dict[str, str]],
) -> dict[str, Any]:
    if period not in VALID_PERIODS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid period '{period}'. Must be one of: {', '.join(sorted(VALID_PERIODS))}",
        )

    requested_metrics = [item.strip() for item in metric.split(",") if item.strip()]
    if not requested_metrics:
        raise HTTPException(status_code=400, detail="At least one metric is required.")

    query_filters: dict[str, Any] = {account_field: account_id}
    date_filter: dict[str, datetime] = {}

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

    collection = _get_collection(platform)
    try:
        entries = await collection.find(query_filters).sort("date", 1).to_list(length=None)
    except PyMongoError as exc:
        raise HTTPException(status_code=500, detail=f"Database query failed: {exc}") from exc

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


async def get_instagram_insights(
    ig_user_id: str,
    metric: str,
    period: str = "day",
    since: str | None = None,
    until: str | None = None,
) -> dict[str, Any]:
    return await _get_insights(
        platform="instagram",
        account_field="ig_user_id",
        account_id=ig_user_id,
        metric=metric,
        period=period,
        since=since,
        until=until,
        metric_aliases=INSTAGRAM_METRIC_QUERY_ALIASES,
        metric_meta_map=INSTAGRAM_METRIC_META,
    )


async def import_instagram_csvs(ig_user_id: str, files: list[UploadFile]) -> dict[str, Any]:
    payloads = await _collect_upload_payloads(files)
    if not payloads:
        raise HTTPException(status_code=400, detail="No non-empty files were uploaded.")

    return await _import_payloads(
        platform="instagram",
        account_field="ig_user_id",
        account_response_key="ig_user_id",
        account_id=ig_user_id,
        source="uploaded_files",
        payloads=payloads,
    )


async def import_instagram_folder(ig_user_id: str, folder_archive: UploadFile) -> dict[str, Any]:
    archive_name = folder_archive.filename or "folder_upload.zip"
    archive_bytes = await folder_archive.read()
    if not archive_bytes:
        raise HTTPException(status_code=400, detail="Uploaded folder archive is empty.")

    result = await _import_payloads(
        platform="instagram",
        account_field="ig_user_id",
        account_response_key="ig_user_id",
        account_id=ig_user_id,
        source="uploaded_folder_zip",
        payloads=[(archive_name, archive_bytes)],
    )
    result["archive_name"] = archive_name
    return result


async def get_facebook_insights(
    fb_user_id: str,
    metric: str,
    period: str = "day",
    since: str | None = None,
    until: str | None = None,
) -> dict[str, Any]:
    return await _get_insights(
        platform="facebook",
        account_field="fb_user_id",
        account_id=fb_user_id,
        metric=metric,
        period=period,
        since=since,
        until=until,
        metric_aliases=FACEBOOK_METRIC_QUERY_ALIASES,
        metric_meta_map=FACEBOOK_METRIC_META,
    )


async def import_facebook_csvs(fb_user_id: str, files: list[UploadFile]) -> dict[str, Any]:
    payloads = await _collect_upload_payloads(files)
    if not payloads:
        raise HTTPException(status_code=400, detail="No non-empty files were uploaded.")

    return await _import_payloads(
        platform="facebook",
        account_field="fb_user_id",
        account_response_key="fb_user_id",
        account_id=fb_user_id,
        source="uploaded_files",
        payloads=payloads,
    )


async def import_facebook_folder(fb_user_id: str, folder_archive: UploadFile) -> dict[str, Any]:
    archive_name = folder_archive.filename or "folder_upload.zip"
    archive_bytes = await folder_archive.read()
    if not archive_bytes:
        raise HTTPException(status_code=400, detail="Uploaded folder archive is empty.")

    result = await _import_payloads(
        platform="facebook",
        account_field="fb_user_id",
        account_response_key="fb_user_id",
        account_id=fb_user_id,
        source="uploaded_folder_zip",
        payloads=[(archive_name, archive_bytes)],
    )
    result["archive_name"] = archive_name
    return result
