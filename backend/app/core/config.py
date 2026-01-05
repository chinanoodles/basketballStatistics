"""应用配置"""
from pydantic_settings import BaseSettings
import os


class Settings(BaseSettings):
    """应用设置"""
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
    ALLOW_EXTERNAL: bool = os.getenv("ALLOW_EXTERNAL", "false").lower() == "true"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

