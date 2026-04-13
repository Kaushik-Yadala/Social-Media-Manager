"""Tests for Instagram/Facebook insights routes."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


class TestInstagramInsightsRoutes:
    def test_insights_route_calls_service(self):
        expected_payload = {"data": [{"name": "views", "values": [{"value": 123}]}]}
        with patch(
            "routes.social_insights_routes.social_insights.get_instagram_insights",
            new=AsyncMock(return_value=expected_payload),
        ) as mocked_service:
            response = client.get(
                "/manual/insta/insights/test_user",
                params={
                    "metric": "views",
                    "period": "day",
                    "since": "2026-04-01",
                    "until": "2026-04-10",
                },
            )

        assert response.status_code == 200
        assert response.json() == expected_payload
        mocked_service.assert_awaited_once_with(
            "test_user",
            "views",
            "day",
            "2026-04-01",
            "2026-04-10",
        )

    def test_csv_import_route_calls_service(self):
        expected_payload = {"message": "CSV import completed."}
        with patch(
            "routes.social_insights_routes.social_insights.import_instagram_csvs",
            new=AsyncMock(return_value=expected_payload),
        ) as mocked_service:
            response = client.post(
                "/manual/insta/csvs/test_user",
                files=[
                    (
                        "files",
                        ("Views.csv", b"Date,Primary\n2026-04-10,100\n", "text/csv"),
                    )
                ],
            )

        assert response.status_code == 200
        assert response.json() == expected_payload
        args = mocked_service.await_args.args
        assert args[0] == "test_user"
        assert len(args[1]) == 1
        assert args[1][0].filename == "Views.csv"

    def test_folder_import_route_calls_service(self):
        expected_payload = {"message": "CSV import completed.", "source": "uploaded_folder_zip"}
        with patch(
            "routes.social_insights_routes.social_insights.import_instagram_folder",
            new=AsyncMock(return_value=expected_payload),
        ) as mocked_service:
            response = client.post(
                "/manual/insta/folders/test_user",
                files={
                    "folder_archive": (
                        "channelwise.zip",
                        b"PK\x03\x04zip-content",
                        "application/zip",
                    )
                },
            )

        assert response.status_code == 200
        assert response.json() == expected_payload
        args = mocked_service.await_args.args
        assert args[0] == "test_user"
        assert args[1].filename == "channelwise.zip"

    def test_folders_alias_calls_service(self):
        expected_payload = {"message": "CSV import completed.", "source": "uploaded_folder_zip"}
        with patch(
            "routes.social_insights_routes.social_insights.import_instagram_folder",
            new=AsyncMock(return_value=expected_payload),
        ) as mocked_service:
            response = client.post(
                "/manual/insta/folder/test_user",
                files={
                    "folder_archive": (
                        "channelwise.zip",
                        b"PK\x03\x04zip-content",
                        "application/zip",
                    )
                },
            )

        assert response.status_code == 200
        assert response.json() == expected_payload
        args = mocked_service.await_args.args
        assert args[0] == "test_user"
        assert args[1].filename == "channelwise.zip"


class TestFacebookInsightsRoutes:
    def test_insights_route_calls_service(self):
        expected_payload = {"data": [{"name": "viewers", "values": [{"value": 42}]}]}
        with patch(
            "routes.social_insights_routes.social_insights.get_facebook_insights",
            new=AsyncMock(return_value=expected_payload),
        ) as mocked_service:
            response = client.get(
                "/manual/facebook/insights/test_page",
                params={
                    "metric": "viewers",
                    "period": "day",
                    "since": "2026-04-01",
                    "until": "2026-04-10",
                },
            )

        assert response.status_code == 200
        assert response.json() == expected_payload
        mocked_service.assert_awaited_once_with(
            "test_page",
            "viewers",
            "day",
            "2026-04-01",
            "2026-04-10",
        )

    def test_csv_import_route_calls_service(self):
        expected_payload = {"message": "CSV import completed."}
        with patch(
            "routes.social_insights_routes.social_insights.import_facebook_csvs",
            new=AsyncMock(return_value=expected_payload),
        ) as mocked_service:
            response = client.post(
                "/manual/facebook/csvs/test_page",
                files=[
                    (
                        "files",
                        ("Viewers.csv", b"Date,Primary\n2026-04-10,50\n", "text/csv"),
                    )
                ],
            )

        assert response.status_code == 200
        assert response.json() == expected_payload
        args = mocked_service.await_args.args
        assert args[0] == "test_page"
        assert len(args[1]) == 1
        assert args[1][0].filename == "Viewers.csv"

    def test_folder_import_route_calls_service(self):
        expected_payload = {"message": "CSV import completed.", "source": "uploaded_folder_zip"}
        with patch(
            "routes.social_insights_routes.social_insights.import_facebook_folder",
            new=AsyncMock(return_value=expected_payload),
        ) as mocked_service:
            response = client.post(
                "/manual/facebook/folders/test_page",
                files={
                    "folder_archive": (
                        "facebook-channelwise.zip",
                        b"PK\x03\x04zip-content",
                        "application/zip",
                    )
                },
            )

        assert response.status_code == 200
        assert response.json() == expected_payload
        args = mocked_service.await_args.args
        assert args[0] == "test_page"
        assert args[1].filename == "facebook-channelwise.zip"

    def test_folders_alias_calls_service(self):
        expected_payload = {"message": "CSV import completed.", "source": "uploaded_folder_zip"}
        with patch(
            "routes.social_insights_routes.social_insights.import_facebook_folder",
            new=AsyncMock(return_value=expected_payload),
        ) as mocked_service:
            response = client.post(
                "/manual/facebook/folder/test_page",
                files={
                    "folder_archive": (
                        "facebook-channelwise.zip",
                        b"PK\x03\x04zip-content",
                        "application/zip",
                    )
                },
            )

        assert response.status_code == 200
        assert response.json() == expected_payload
        args = mocked_service.await_args.args
        assert args[0] == "test_page"
        assert args[1].filename == "facebook-channelwise.zip"
