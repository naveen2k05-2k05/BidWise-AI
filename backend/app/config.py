import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "BidWise AI RFP Writer API"
    database_url: str = "sqlite:///./BidWise AI_rfp.db"
    cors_origins: str = "https://bidwise-ai.netlify.app,http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    max_upload_mb: int = 15
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
