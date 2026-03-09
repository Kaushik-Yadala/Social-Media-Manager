"""
Application configuration loaded from environment variables / .env file.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Google Analytics 4
    ga4_property_id: str = ""
    google_application_credentials: str = ""

    # YouTube Data API v3
    youtube_api_key: str = ""
    youtube_channel_id: str = ""

    # App
    app_env: str = "development"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def ga_credentials_available(self) -> bool:
        """True when a property ID and credentials path are both set."""
        return bool(self.ga4_property_id and self.google_application_credentials)

    @property
    def yt_credentials_available(self) -> bool:
        """True when a YouTube API key and channel ID are both set."""
        return bool(self.youtube_api_key and self.youtube_channel_id)


settings = Settings()
