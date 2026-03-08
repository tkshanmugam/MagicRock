"""
Application configuration loaded from environment variables.
"""
from pydantic_settings import BaseSettings
from typing import Optional
import os
import json


class Settings(BaseSettings):
    """Application settings loaded from .env file."""
    
    # Application
    APP_NAME: str = "BizLeader API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"
    
    # Database
    DATABASE_URL: str
    DB_ECHO: bool = False
    
    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # API Key Security
    API_KEYS: str = ""  # Comma-separated list of API keys
    API_KEY_HEADER: str = "X-API-KEY"
    API_KEY_REQUIRED: bool = True
    API_KEY_PUBLIC_ENDPOINTS: str = "/api/v1/health,/uploads"  # Comma-separated paths that don't require API key (docs/redoc are always public)
    
    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS: int = 100  # Requests per window
    RATE_LIMIT_WINDOW_SECONDS: int = 60  # Time window in seconds
    
    # Request Timestamp Validation (Replay Protection)
    TIMESTAMP_VALIDATION_ENABLED: bool = True
    TIMESTAMP_HEADER: str = "X-TIMESTAMP"
    TIMESTAMP_TOLERANCE_SECONDS: int = 300  # 5 minutes tolerance
    
    # IP Allowlist (Optional)
    IP_ALLOWLIST_ENABLED: bool = False
    IP_ALLOWLIST: str = ""  # Comma-separated IP addresses or CIDR ranges
    
    # Super Admin
    SUPER_ADMIN_USERNAME: str
    SUPER_ADMIN_PASSWORD: str
    SUPER_ADMIN_EMAIL: str
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_DIR: str = "logs"
    LOG_RETENTION_DAYS: int = 5
    
    # CORS (can be JSON string or comma-separated) - include all client origins
    CORS_ORIGINS: str = '["http://localhost:3000","http://localhost:3001","http://187.77.188.73:3000"]'

    # File Uploads
    UPLOADS_DIR: str = "uploads"
    ORG_LOGO_SUBDIR: str = "organizations"
    ORG_LOGO_ALLOWED_EXTENSIONS: str = ".png,.jpg,.jpeg"
    ORG_LOGO_ALLOWED_CONTENT_TYPES: str = "image/png,image/jpeg"
    ORG_LOGO_MAX_SIZE_MB: int = 2
    
    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS_ORIGINS into a list."""
        try:
            # Try JSON first
            return json.loads(self.CORS_ORIGINS)
        except json.JSONDecodeError:
            # Fall back to comma-separated
            return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
    
    @property
    def api_keys_list(self) -> list[str]:
        """Parse API_KEYS into a list."""
        if not self.API_KEYS:
            return []
        return [key.strip() for key in self.API_KEYS.split(",") if key.strip()]
    
    @property
    def public_endpoints_list(self) -> list[str]:
        """Parse public endpoints that don't require API key."""
        if not self.API_KEY_PUBLIC_ENDPOINTS:
            return []
        return [endpoint.strip() for endpoint in self.API_KEY_PUBLIC_ENDPOINTS.split(",") if endpoint.strip()]
    
    @property
    def ip_allowlist_list(self) -> list[str]:
        """Parse IP allowlist into a list."""
        if not self.IP_ALLOWLIST:
            return []
        return [ip.strip() for ip in self.IP_ALLOWLIST.split(",") if ip.strip()]

    @property
    def org_logo_allowed_extensions_list(self) -> list[str]:
        """Parse allowed logo extensions into a list."""
        if not self.ORG_LOGO_ALLOWED_EXTENSIONS:
            return []
        return [ext.strip().lower() for ext in self.ORG_LOGO_ALLOWED_EXTENSIONS.split(",") if ext.strip()]

    @property
    def org_logo_allowed_content_types_list(self) -> list[str]:
        """Parse allowed logo content types into a list."""
        if not self.ORG_LOGO_ALLOWED_CONTENT_TYPES:
            return []
        return [ctype.strip().lower() for ctype in self.ORG_LOGO_ALLOWED_CONTENT_TYPES.split(",") if ctype.strip()]

    @property
    def org_logo_max_size_bytes(self) -> int:
        """Convert max logo size from MB to bytes."""
        return int(self.ORG_LOGO_MAX_SIZE_MB) * 1024 * 1024
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()

