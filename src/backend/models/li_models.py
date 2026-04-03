from typing import List, Optional
from pydantic import BaseModel, Field

class LIMetricBase(BaseModel):
    date: str

class LIPostPerformance(LIMetricBase):
    post_id: str
    post_type: str
    reach: int = 0
    impressions: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0
    clicks: int = 0
    engagement_rate: float = 0.0

class LIPostResponse(BaseModel):
    posts: List[LIPostPerformance]

class LIDemographicData(BaseModel):
    category: str # e.g. "Geography", "Industry", "Seniority"
    value: str # e.g. "North America", "Tech", "Senior"
    follower_count: int
    percentage: float

class LIFollowerDemographics(BaseModel):
    total_followers: int
    demographics: List[LIDemographicData]

class LIPageTraffic(LIMetricBase):
    page_views: int = 0
    unique_visitors: int = 0
    custom_button_clicks: int = 0

class LIPageTrafficResponse(BaseModel):
    traffic_data: List[LIPageTraffic]

class LIOverview(BaseModel):
    total_followers: int = 0
    new_followers: int = 0
    total_page_views: int = 0
    total_post_impressions: int = 0
    avg_engagement_rate: float = 0.0
