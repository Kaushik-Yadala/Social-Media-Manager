"""
API routes for competitor social metrics.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from services import competitor_service as cs
from models.competitor_models import CompetitorsResponse

router = APIRouter(prefix="/api/competitors", tags=["Competitors"])


@router.get("", response_model=CompetitorsResponse)
async def get_competitors():
    """
    Return live-scraped competitor metrics with follower counts,
    engagement rates, and growth data.
    """
    try:
        return await cs.get_competitors()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.post("/refresh", response_model=dict)
async def refresh_competitors():
    """Force re-scrape (bypasses cache)."""
    try:
        result = await cs.get_competitors(force_refresh=True)
        return {
            "status": "ok",
            "message": "Competitor data refreshed successfully",
            "source": result.source,
        }
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))
