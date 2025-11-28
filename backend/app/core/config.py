from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List


class Settings(BaseSettings):
    """Application settings with environment variable support"""
    
    # Project info
    PROJECT_NAME: str = "API платформы тестирования"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/testing_platform"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    
    # JWT Security
    SECRET_KEY: str  # must be provided via environment
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60  # Увеличено с 30 до 60 минут для комфортной работы
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Database logging
    DATABASE_ECHO: bool = False
    REQUIRE_TEST_ASSIGNMENT: bool = True

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:4173",
    ]
    CORS_ALLOW_ALL_ORIGINS: bool = False

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        # Allow comma-separated env string: "http://a,http://b"
        if isinstance(v, str):
            return [i.strip() for i in v.split(",") if i.strip()]
        return v
    
    class Config:
        env_file = ".env"
        case_sensitive = True

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if not v or len(v) < 32:
            raise ValueError("SECRET_KEY must be set and at least 32 characters long")
        return v


settings = Settings()

