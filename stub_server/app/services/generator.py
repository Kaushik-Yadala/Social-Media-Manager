"""
Gaussian noise data generator for Instagram insights.

Given an ig_user_id, looks at the most recent N entries in MongoDB,
computes mean/std for each metric, samples from N(mean, std), clamps to ≥ 0,
and inserts a new document for the target date.
"""

import random
import math
from datetime import datetime, timezone
from typing import Optional

from app.models.instagram import InstagramInsight

# Fields we generate data for
METRIC_FIELDS = [
    "views",
    "profile_links_taps",
    "total_interactions",
    "reach",
    "accounts_engaged",
    "additional_follows",
]

# How many historical entries to use for computing mean/std
LOOKBACK_WINDOW = 14

# Default baselines if no history exists (reasonable Instagram-scale numbers)
DEFAULT_BASELINES = {
    "views": (500, 100),           # (mean, std)
    "profile_links_taps": (20, 8),
    "total_interactions": (150, 40),
    "reach": (400, 80),
    "accounts_engaged": (100, 30),
    "additional_follows": (15, 6),
}


def _compute_stats(values: list[int]) -> tuple[float, float]:
    """Compute mean and sample std of a list of ints."""
    n = len(values)
    if n == 0:
        return 0.0, 0.0
    mean = sum(values) / n
    if n == 1:
        return mean, mean * 0.15  # 15% noise if only one data point
    variance = sum((v - mean) ** 2 for v in values) / (n - 1)
    return mean, math.sqrt(variance)


async def generate_entry(
    ig_user_id: str,
    target_date: datetime,
    lookback: int = LOOKBACK_WINDOW,
) -> InstagramInsight:
    """
    Generate a new InsagramInsight entry using Gaussian sampling
    from historical data.

    If no historical data exists, falls back to DEFAULT_BASELINES.
    """
    # Fetch recent entries for this user, sorted by date descending
    history = (
        await InstagramInsight.find(InstagramInsight.ig_user_id == ig_user_id)
        .sort("-date")
        .limit(lookback)
        .to_list()
    )

    new_values: dict[str, int] = {}

    for field in METRIC_FIELDS:
        if history:
            field_values = [getattr(doc, field) for doc in history]
            mean, std = _compute_stats(field_values)
        else:
            mean, std = DEFAULT_BASELINES[field]

        # Sample from Gaussian and clamp to non-negative
        sampled = random.gauss(mean, std)
        new_values[field] = max(0, round(sampled))

    # Build and persist the new document
    entry = InstagramInsight(
        ig_user_id=ig_user_id,
        date=target_date,
        **new_values,
    )
    await entry.insert()
    return entry
