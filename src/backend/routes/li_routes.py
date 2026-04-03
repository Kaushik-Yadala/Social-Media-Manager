from fastapi import APIRouter, Query, HTTPException
from typing import Annotated
import services.li_service as li

from models.li_models import (
    LIOverview,
    LIPostResponse,
    LIFollowerDemographics,
    LIPageTrafficResponse
)

router = APIRouter(prefix="/api/li", tags=["LinkedIn"])

@router.get("/overview", response_model=LIOverview, summary="LinkedIn Overview")
def overview(
    start_date: Annotated[str, Query()] = "30daysAgo",
    end_date: Annotated[str, Query()] = "today",
):
    try:
        return li.get_overview(start_date, end_date)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/posts", response_model=LIPostResponse, summary="LinkedIn Post Performance")
def posts_performance(
    start_date: Annotated[str, Query()] = "30daysAgo",
    end_date: Annotated[str, Query()] = "today",
):
    try:
        return li.get_posts_performance(start_date, end_date)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/demographics", response_model=LIFollowerDemographics, summary="LinkedIn Follower Demographics")
def demographics():
    try:
        return li.get_demographics()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/page-traffic", response_model=LIPageTrafficResponse, summary="LinkedIn Page Traffic")
def page_traffic(
    start_date: Annotated[str, Query()] = "7daysAgo",
    end_date: Annotated[str, Query()] = "today",
):
    try:
        return li.get_page_traffic(start_date, end_date)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
