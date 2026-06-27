import json

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+asyncpg://clubhouse:clubhouse@localhost:5432/clubhouse"
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 10080  # 7 days
    ANON_JWT_EXPIRE_MINUTES: int = 1440

    # JSON array of provider configs. Each entry: {"id": "...", "client_id": "...", "client_secret": "..."}
    # Well-known providers (google, github, discord) need only id + credentials.
    # Custom OIDC providers also need "issuer_url" or explicit "userinfo_url".
    OAUTH_PROVIDERS_JSON: str = '[]'

    CORS_ORIGINS: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    @property
    def oauth_providers(self) -> list[dict]:
        return json.loads(self.OAUTH_PROVIDERS_JSON)


settings = Settings()
