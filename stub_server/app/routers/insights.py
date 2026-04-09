"""
Insights router — the core API of the stub server.

Endpoints:
  GET /stub/insta/get_data/{ig_user_id}/insights
      → returns Meta-style JSON for requested metrics/period/date-range
  GET /stub/insta/create_entry/{ig_user_id}
      → generates a new day's data via Gaussian sampling and returns it
"""

from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.models.instagram import InstagramInsight
from app.services.generator import generate_entry, METRIC_FIELDS

router = APIRouter(prefix="/stub/insta", tags=["Instagram Insights"])

# ── Metric metadata (mirrors Meta's title/description fields) ────────────────

METRIC_META = {
    "views": {
        "title": "Views",
        "description": "Total number of times the content was viewed.",
    },
    "profile_links_taps": {
        "title": "Profile links taps",
        "description": "The number of taps on the bio link.",
    },
    "total_interactions": {
        "title": "Total interactions",
        "description": "Number of likes, saves, comments, and shares on the media, minus the number of unlikes, unsaves, and deleted comments.",
    },
    "reach": {
        "title": "Reach",
        "description": "Number of unique Instagram accounts that have seen the content at least once. Reach is different from impressions, which can include multiple views by the same account. Metric is estimated.",
    },
    "accounts_engaged": {
        "title": "Accounts engaged",
        "description": "The number of unique accounts that interacted with the content.",
    },
    "additional_follows": {
        "title": "Follows",
        "description": "The number of new followers gained.",
    },
}

VALID_PERIODS = {"day", "week", "days_28", "month", "lifetime", "total_over_range"}


def _parse_date(value: str) -> datetime:
    """
    Parse a date that can be either:
      • ISO-8601 string  (2025-04-09, 2025-04-09T00:00:00)
      • Unix timestamp   (1712620800)
    Returns a timezone-aware UTC datetime.
    """
    # Try unix timestamp first
    try:
        ts = float(value)
        return datetime.fromtimestamp(ts, tz=timezone.utc)
    except ValueError:
        pass

    # Try ISO format
    try:
        dt = datetime.fromisoformat(value)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid date format: '{value}'. Use ISO-8601 or Unix timestamp.",
        )


def _aggregate_for_period(
    entries: list[InstagramInsight],
    metric: str,
    period: str,
    ig_user_id: str,
) -> dict:
    """
    Build one element of the Meta-style `data` array for a single metric.

    For 'day' period: returns individual daily values with end_time.
    For 'lifetime' / 'total_over_range': returns a single aggregated value.
    For 'week' / 'days_28' / 'month': groups entries into windows.
    """

    if period in ("lifetime", "total_over_range"):
        total = sum(getattr(e, metric) for e in entries)
        return {
            "name": metric,
            "period": period,
            "values": [{"value": total}],
            "title": METRIC_META[metric]["title"],
            "description": METRIC_META[metric]["description"],
            "id": f"{ig_user_id}/insights/{metric}/{period}",
        }

    if period == "day":
        values = []
        for e in sorted(entries, key=lambda x: x.date):
            values.append({
                "value": getattr(e, metric),
                "end_time": e.date.strftime("%Y-%m-%dT%H:%M:%S+0000"),
            })
        return {
            "name": metric,
            "period": period,
            "values": values,
            "title": METRIC_META[metric]["title"],
            "description": METRIC_META[metric]["description"],
            "id": f"{ig_user_id}/insights/{metric}/{period}",
        }

    # week / days_28 / month  → bucket entries
    window_days = {"week": 7, "days_28": 28, "month": 30}[period]
    sorted_entries = sorted(entries, key=lambda x: x.date)
    buckets: list[dict] = []

    i = 0
    while i < len(sorted_entries):
        bucket_start = sorted_entries[i].date
        bucket_end = bucket_start + timedelta(days=window_days)
        bucket_entries = [
            e for e in sorted_entries[i:]
            if e.date < bucket_end
        ]
        total = sum(getattr(e, metric) for e in bucket_entries)
        buckets.append({
            "value": total,
            "end_time": bucket_end.strftime("%Y-%m-%dT%H:%M:%S+0000"),
        })
        i += len(bucket_entries)

    return {
        "name": metric,
        "period": period,
        "values": buckets,
        "title": METRIC_META[metric]["title"],
        "description": METRIC_META[metric]["description"],
        "id": f"{ig_user_id}/insights/{metric}/{period}",
    }


# ══════════════════════════════════════════════════════════════════════════════
# Endpoint 1: GET data (Meta-style)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/get_data/{ig_user_id}/insights")
async def get_insights(
    ig_user_id: str,
    metric: str = Query(
        ...,
        description="Comma-separated list of metrics (e.g., views,reach,total_interactions)",
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
    """
    GET /{ig_user_id}/insights — mirrors Meta Graph API response format.

    Returns a JSON object with a `data` array, each element containing
    metric name, period, values, title, description, and id.
    """
    # Validate period
    if period not in VALID_PERIODS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid period '{period}'. Must be one of: {', '.join(VALID_PERIODS)}",
        )

    # Parse requested metrics
    requested_metrics = [m.strip() for m in metric.split(",")]
    for m in requested_metrics:
        if m not in METRIC_FIELDS:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown metric '{m}'. Available: {', '.join(METRIC_FIELDS)}",
            )

    # Build the DB query
    query_filters = {"ig_user_id": ig_user_id}

    date_filter: dict = {}
    if since:
        date_filter["$gte"] = _parse_date(since)
    if until:
        date_filter["$lte"] = _parse_date(until)
    if date_filter:
        query_filters["date"] = date_filter

    entries = (
        await InstagramInsight.find(query_filters)
        .sort("+date")
        .to_list()
    )

    # If no data, return empty data set (Meta behaviour)
    if not entries:
        return {"data": []}

    # Build response
    data = []
    for m in requested_metrics:
        data.append(_aggregate_for_period(entries, m, period, ig_user_id))

    return {"data": data}


# ══════════════════════════════════════════════════════════════════════════════
# Endpoint 2: Create entry via Gaussian generation
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/create_entry/{ig_user_id}")
async def create_entry(
    ig_user_id: str,
    date: str = Query(
        ...,
        description="ISO date for the new entry (e.g., 2025-04-09)",
    ),
):
    """
    Generate a new insights entry for the given date using
    Gaussian sampling from historical data, then return it in
    Meta-style JSON format.
    """
    target_date = _parse_date(date)

    # Check for duplicate
    existing = await InstagramInsight.find_one(
        InstagramInsight.ig_user_id == ig_user_id,
        InstagramInsight.date == target_date,
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Entry already exists for {ig_user_id} on {date}",
        )

    entry = await generate_entry(ig_user_id, target_date)

    # Return in Meta-style format — one metric per data element
    data = []
    for m in METRIC_FIELDS:
        data.append({
            "name": m,
            "period": "day",
            "values": [
                {
                    "value": getattr(entry, m),
                    "end_time": entry.date.strftime("%Y-%m-%dT%H:%M:%S+0000"),
                }
            ],
            "title": METRIC_META[m]["title"],
            "description": METRIC_META[m]["description"],
            "id": f"{ig_user_id}/insights/{m}/day",
        })

    return {"data": data}
