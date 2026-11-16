from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator, model_validator


class Settings(BaseSettings):

    DATABASE_URL: str

    GEMINI_API_KEY: str

    GEMINI_MODEL: str = "gemini-3.8-flash"

    HF_EMBEDDING_MODEL: str = (
        "sentence-transformers/all-MiniLM-L6-v2"
    )

    MAX_COSINE_DISTANCE: float = 0.65

    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    AUTH_SECRET_KEY: str = Field(min_length=32)
    AUTH_ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30, ge=1, le=1440)
    AUTH_COOKIE_NAME: str = "documind_access_token"
    AUTH_COOKIE_SECURE: bool = False
    AUTH_COOKIE_SAMESITE: Literal["lax", "strict", "none"] = "lax"
    AUTH_COOKIE_DOMAIN: str | None = None
    AUTH_COOKIE_PATH: str = "/"
    CSRF_COOKIE_NAME: str = "documind_csrf"

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )

    @field_validator("AUTH_COOKIE_DOMAIN", mode="before")
    @classmethod
    def normalize_cookie_domain(cls, value: object) -> object:
        return None if value == "" else value

    @model_validator(mode="after")
    def validate_cookie_settings(self) -> "Settings":
        if self.AUTH_COOKIE_SAMESITE == "none" and not self.AUTH_COOKIE_SECURE:
            raise ValueError("AUTH_COOKIE_SECURE must be true when SameSite is 'none'.")
        if self.AUTH_COOKIE_NAME == self.CSRF_COOKIE_NAME:
            raise ValueError("Auth and CSRF cookies must use different names.")
        return self


settings = Settings()