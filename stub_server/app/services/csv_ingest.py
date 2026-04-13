"""
CSV ingestion helpers for social insights data.
"""

import csv
import io
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

from beanie import Document

from app.models.instagram import InstagramInsight

ENCODING_CANDIDATES = (
    "utf-8-sig",
    "utf-16",
    "utf-16le",
    "utf-16be",
    "latin-1",
)

PRIMARY_COLUMN_ALIASES = {"primary", "value", "values"}
METRIC_NAME_ALIASES = {
    "interactions": "content_interactions",
    "linkclicks": "instagram_link_clicks",
    "link_clicks": "instagram_link_clicks",
    "visits": "instagram_profile_visits",
    "follows": "instagram_follows",
}


def normalize_metric_name(value: str) -> str:
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
    return METRIC_NAME_ALIASES.get(result, result)


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
        metric_key = normalize_metric_name(header_row[index])
        if len(value_indices) == 1 and metric_key in PRIMARY_COLUMN_ALIASES:
            fallback = metric_title or Path(source_name).stem
            metric_key = normalize_metric_name(fallback)

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


def expand_csv_payloads(
    uploaded_files: list[tuple[str, bytes]],
) -> list[tuple[str, bytes]]:
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


def collect_csv_files_from_folder(folder_path: Path) -> list[tuple[str, bytes]]:
    csv_paths = sorted(
        path for path in folder_path.iterdir() if path.is_file() and path.suffix.lower() == ".csv"
    )
    if not csv_paths:
        raise ValueError(f"No CSV files found in '{folder_path}'.")
    return [(path.name, path.read_bytes()) for path in csv_paths]


def merge_csv_updates(
    csv_payloads: list[tuple[str, bytes]],
) -> tuple[dict[datetime, dict[str, int | float]], int, list[str]]:
    merged_updates: dict[datetime, dict[str, int | float]] = defaultdict(dict)
    discovered_metrics: set[str] = set()

    for source_name, content in csv_payloads:
        file_updates, metric_keys = _parse_csv_content(source_name, content)
        discovered_metrics.update(metric_keys)

        for date_key, metric_updates in file_updates.items():
            merged_updates[date_key].update(metric_updates)

    return merged_updates, len(csv_payloads), sorted(discovered_metrics)


async def upsert_platform_insights(
    document_model: type[Document],
    account_field: str,
    account_id: str,
    platform: str,
    updates_by_date: dict[datetime, dict[str, int | float]],
) -> tuple[int, int]:
    if not updates_by_date:
        return 0, 0

    dates = sorted(updates_by_date.keys())
    min_date = dates[0]
    max_date = dates[-1]
    existing_entries = await document_model.find(
        {
            account_field: account_id,
            "date": {"$gte": min_date, "$lte": max_date},
        }
    ).to_list()
    existing_by_date = {entry.date.date(): entry for entry in existing_entries}

    created_entries = 0
    updated_entries = 0

    for date_key in dates:
        metric_updates = updates_by_date[date_key]
        existing_entry = existing_by_date.get(date_key.date())

        if existing_entry:
            existing_entry.metrics.update(metric_updates)
            existing_entry.platform = platform
            await existing_entry.save()
            updated_entries += 1
            continue

        new_entry = document_model(
            **{
                account_field: account_id,
                "platform": platform,
                "date": date_key,
                "metrics": metric_updates,
            }
        )
        await new_entry.insert()
        created_entries += 1

    return created_entries, updated_entries


async def upsert_insights(
    ig_user_id: str,
    updates_by_date: dict[datetime, dict[str, int | float]],
) -> tuple[int, int]:
    return await upsert_platform_insights(
        document_model=InstagramInsight,
        account_field="ig_user_id",
        account_id=ig_user_id,
        platform="instagram",
        updates_by_date=updates_by_date,
    )
