"""
Security utilities for JWT tokens and password hashing.
"""
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import settings

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _truncate_password(password: str, max_bytes: int = 72) -> str:
    """Truncate password to max_bytes to comply with bcrypt limit.
    
    Args:
        password: Password string to truncate
        max_bytes: Maximum byte length (default 72 for bcrypt)
    
    Returns:
        Truncated password string
    """
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > max_bytes:
        # Truncate to max_bytes and decode back
        truncated_bytes = password_bytes[:max_bytes]
        # Decode with error handling in case we cut in the middle of a UTF-8 sequence
        return truncated_bytes.decode('utf-8', errors='ignore')
    return password


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hashed password.
    
    Note: bcrypt has a 72-byte limit. Passwords longer than 72 bytes
    will be truncated automatically for comparison.
    """
    # Truncate to 72 bytes before verification
    truncated_password = _truncate_password(plain_password, max_bytes=72)
    return pwd_context.verify(truncated_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt.
    
    Note: bcrypt has a 72-byte limit. Passwords longer than 72 bytes
    will be truncated automatically.
    """
    # Truncate password to 72 bytes before hashing
    truncated_password = _truncate_password(password, max_bytes=72)
    return pwd_context.hash(truncated_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    
    # Ensure SECRET_KEY is set
    if not settings.SECRET_KEY:
        raise ValueError("SECRET_KEY is not configured. Please set it in your .env file.")
    
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and verify a JWT access token."""
    if not token:
        return None
    
    if not settings.SECRET_KEY:
        import logging
        logger = logging.getLogger(__name__)
        logger.error("SECRET_KEY is not configured")
        return None
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        # Token has expired
        import logging
        logger = logging.getLogger(__name__)
        logger.warning("Token has expired")
        return None
    except JWTError as e:
        # Invalid token (signature, format, etc.)
        # python-jose uses JWTError for all JWT-related errors including invalid signatures
        # Always log this error to help diagnose SECRET_KEY mismatches
        import logging
        logger = logging.getLogger(__name__)
        error_msg = str(e)
        logger.error(
            f"JWT decode error: {error_msg} | "
            f"Error type: {type(e).__name__} | "
            f"Token length: {len(token)} | "
            f"SECRET_KEY length: {len(settings.SECRET_KEY)} | "
            f"Algorithm: {settings.ALGORITHM}"
        )
        return None
    except Exception as e:
        # Any other error
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Unexpected error decoding token: {str(e)} | Error type: {type(e).__name__}")
        return None


def create_refresh_token(data: dict) -> str:
    """Create a JWT refresh token with longer expiration."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_refresh_token(token: str) -> Optional[dict]:
    """Decode and verify a JWT refresh token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        # Verify it's a refresh token
        if payload.get("type") != "refresh":
            return None
        return payload
    except JWTError:
        return None

