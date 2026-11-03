from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):

    DATABASE_URL: str

    GEMINI_API_KEY: str

    GEMINI_MODEL: str = "gemini-3.8-flash"

    HF_EMBEDDING_MODEL: str = (
        "sentence-transformers/all-MiniLM-L6-v2"
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )


settings = Settings()