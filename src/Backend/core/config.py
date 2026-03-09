"""
Application configuration loaded from environment variables / .env file.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Google Analytics 4
    ga4_property_id: str = ""
    google_application_credentials: str = ""

    # App
    app_env: str = "development"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def ga_credentials_available(self) -> bool:
        """True when a property ID and credentials path are both set."""
        return bool(self.ga4_property_id and self.google_application_credentials)


settings = Settings()
