"""
Application configuration loaded from environment variables / .env file.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Google Analytics 4
    ga4_property_id: str = ""
    google_application_credentials: str = ""

    # Database
    mongodb_uri: str = "mongodb://localhost:27017" # default fallback
    database_name: str = "club_artizen_analytics"

    # Security / JWT
    secret_key: str = "supersecretkey" # CHANGE IN PRODUCTION
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7 # 7 days

    # App
    app_env: str = "development"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def ga_credentials_available(self) -> bool:
        """True when a property ID and credentials path are both set."""
        return bool(self.ga4_property_id and self.google_application_credentials)

    @property
    def cors_origins_list(self) -> list[str]:
        """Comma-separated origins from env into a FastAPI-compatible list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
