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
    # "local" (disk, for dev) or "firestore" (Firestore + Cloud Storage, for Cloud Run)
    store: str = "local"
    gcp_project: str = ""
    gcs_bucket: str = ""
    # Human voices for the crew (optional; the app falls back to browser speech without it)
    cartesia_api_key: str = ""
    cartesia_model: str = "sonic-3"
    cartesia_version: str = "2025-04-16"
    cartesia_voice_inspector: str = "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4"  # Skylar: Rosa
    cartesia_voice_lawyer: str = "b24f41fd-00a3-4cd8-992a-a0c9f13f3ef1"  # Clive: Theo
    cartesia_voice_advocate: str = "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc"  # Jacqueline: June


settings = Settings()
