"""Configuration module for environment variables."""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Cohere
    cohere_api_key: Optional[str] = None
    
    # Pinecone
    pinecone_api_key: Optional[str] = None
    pinecone_index_name: Optional[str] = "memory-index"
    pinecone_environment: Optional[str] = None  # Not needed for newer Pinecone
    
    # MongoDB
    mongodb_uri: Optional[str] = "mongodb://localhost:27017"
    mongodb_db_name: str = "memory_db"
    
    # OpenRouter
    openrouter_api_key: Optional[str] = None
    
    # FastAPI
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    
    class Config:
        env_file = ".env"
        case_sensitive = False
        env_prefix = ""  # No prefix needed


settings = Settings()

