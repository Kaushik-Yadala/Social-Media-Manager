"""Service tests for Instagram post-wise manual insights."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

import services.social_insights_service as social_insights


class _FakeCursor:
    def __init__(self, documents: list[dict[str, Any]]):
        self._documents = documents

    def sort(self, *_args, **_kwargs):
        return self

    async def to_list(self, length=None):
        if length is None:
            return self._documents
        return self._documents[:length]


def test_parse_instagram_posts_csv_extracts_post_metrics():
    csv_content = (
        b"Post ID,Account ID,Account username,Account name,Description,Duration (sec),"
        b"Publish time,Permalink,Post type,Data comment,Date,Views,Likes,Shares,Comments,Saves,Reach,Follows\n"
        b"1801,1784,clubartizen,Club Artizen,Caption,0,03/27/2026 06:08,"
        b"https://www.instagram.com/p/example/,IG image,,Lifetime,160,5,3,2,4,45,1\n"
    )

    documents, metric_keys = social_insights._parse_instagram_posts_csv(
        source_name="posts.csv",
        content=csv_content,
        ig_user_id="ClubArtizen",
    )

    assert len(documents) == 1
    assert documents[0].post_id == "1801"
    assert documents[0].ig_user_id == "ClubArtizen"
    assert documents[0].metrics["saved"] == 4
    assert documents[0].metrics["total_interactions"] == 14
    assert "total_interactions" in metric_keys


@pytest.mark.asyncio
async def test_get_instagram_post_insights_returns_lifetime_values_for_post_id():
    class _FakeCollection:
        async def find_one(self, query):
            assert query == {"post_id": "1801"}
            return {
                "post_id": "1801",
                "post_type": "IG image",
                "metrics": {"views": 160, "saved": 4, "total_interactions": 14},
            }

        def find(self, _query):
            return _FakeCursor([])

    with patch(
        "services.social_insights_service._get_instagram_posts_collection",
        new=AsyncMock(return_value=_FakeCollection()),
    ):
        payload = await social_insights.get_instagram_post_insights(
            instagram_media_id="1801",
            metric="views,saves,total_interactions",
            period="lifetime",
        )

    assert payload["data"][0]["name"] == "views"
    assert payload["data"][0]["values"] == [{"value": 160}]
    assert payload["data"][1]["name"] == "saved"
    assert payload["data"][1]["values"] == [{"value": 4}]
    assert payload["data"][2]["name"] == "total_interactions"
    assert payload["data"][2]["values"] == [{"value": 14}]


@pytest.mark.asyncio
async def test_get_instagram_post_insights_returns_postwise_data_for_ig_user_id():
    class _FakeCollection:
        async def find_one(self, query):
            assert query == {"post_id": "ClubArtizen"}
            return None

        def find(self, query):
            user_query = query.get("ig_user_id")
            assert isinstance(user_query, dict)
            assert user_query.get("$options") == "i"
            return _FakeCursor(
                [
                    {
                        "post_id": "1802",
                        "ig_user_id": "ClubArtizen",
                        "account_id": "1784",
                        "post_type": "IG image",
                        "metrics": {"views": 99, "likes": 9},
                    },
                    {
                        "post_id": "1801",
                        "ig_user_id": "ClubArtizen",
                        "account_id": "1784",
                        "post_type": "IG image",
                        "metrics": {"views": 160, "likes": 15},
                    },
                ]
            )

    with patch(
        "services.social_insights_service._get_instagram_posts_collection",
        new=AsyncMock(return_value=_FakeCollection()),
    ):
        payload = await social_insights.get_instagram_post_insights(
            instagram_media_id="ClubArtizen",
            metric="views",
            period="lifetime",
        )

    assert len(payload["data"]) == 2
    assert payload["data"][0]["post_id"] == "1802"
    assert payload["data"][0]["insights"][0]["name"] == "views"
    assert payload["data"][0]["insights"][0]["values"] == [{"value": 99}]
    assert payload["data"][1]["post_id"] == "1801"


@pytest.mark.asyncio
async def test_get_instagram_post_insights_returns_all_metrics_when_metric_empty():
    class _FakeCollection:
        async def find_one(self, query):
            assert query == {"post_id": "1801"}
            return {
                "post_id": "1801",
                "post_type": "IG image",
                "metrics": {
                    "views": 160,
                    "likes": 5,
                    "shares": 3,
                    "comments": 2,
                    "saved": 4,
                    "reach": 45,
                    "follows": 1,
                },
            }

        def find(self, _query):
            return _FakeCursor([])

    with patch(
        "services.social_insights_service._get_instagram_posts_collection",
        new=AsyncMock(return_value=_FakeCollection()),
    ):
        payload = await social_insights.get_instagram_post_insights(
            instagram_media_id="1801",
            metric="",
            period="lifetime",
        )

    returned_metric_names = {item["name"] for item in payload["data"]}
    assert {
        "views",
        "likes",
        "shares",
        "comments",
        "saved",
        "reach",
        "follows",
        "total_interactions",
    }.issubset(returned_metric_names)


@pytest.mark.asyncio
async def test_get_instagram_post_insights_supports_post_id_option_for_user_id():
    class _FakeCollection:
        async def find_one(self, query):
            user_query = query.get("ig_user_id")
            assert isinstance(user_query, dict)
            assert user_query.get("$options") == "i"
            assert query.get("post_id") == "1801"
            return {
                "post_id": "1801",
                "ig_user_id": "ClubArtizen",
                "post_type": "IG image",
                "metrics": {"views": 160, "likes": 5},
            }

        def find(self, _query):
            return _FakeCursor([])

    with patch(
        "services.social_insights_service._get_instagram_posts_collection",
        new=AsyncMock(return_value=_FakeCollection()),
    ):
        payload = await social_insights.get_instagram_post_insights(
            instagram_media_id="ClubArtizen",
            post_id="1801",
            metric=None,
            period="lifetime",
        )

    assert payload["data"][0]["name"] == "likes"
    assert payload["data"][0]["id"] == "1801/insights/likes/lifetime"


@pytest.mark.asyncio
async def test_get_instagram_post_insights_rejects_non_lifetime_period():
    with pytest.raises(HTTPException) as exc_info:
        await social_insights.get_instagram_post_insights(
            instagram_media_id="1801",
            metric="views",
            period="day",
        )

    assert exc_info.value.status_code == 400
    assert "period=lifetime" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_get_instagram_post_insights_rejects_unsupported_metrics():
    class _FakeCollection:
        async def find_one(self, query):
            assert query == {"post_id": "1801"}
            return {"post_id": "1801", "post_type": "IG image", "metrics": {"views": 1}}

        def find(self, _query):
            return _FakeCursor([])

    with patch(
        "services.social_insights_service._get_instagram_posts_collection",
        new=AsyncMock(return_value=_FakeCollection()),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await social_insights.get_instagram_post_insights(
                instagram_media_id="1801",
                metric="impressions",
                period="lifetime",
            )

    assert exc_info.value.status_code == 400
    assert "Unsupported metric" in str(exc_info.value.detail)
