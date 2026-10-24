from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    gemini_api_key: str = ""
    gemma_model: str = "gemma-4-31b-it"
    # Set OLLAMA=1 to run agents against a local Gemma 4 when the API rate-limits us.
    ollama: bool = False
    ollama_model: str = "gemma4:e4b"
    ollama_url: str = "http://localhost:11434"
    cors_origins: str = "http://localhost:3000"


settings = Settings()
