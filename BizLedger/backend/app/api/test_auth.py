"""
Test endpoint to verify token creation and validation.
"""
from fastapi import APIRouter, Depends, Header
from typing import Optional
from app.core.security import create_access_token, decode_access_token
from app.core.config import settings
from datetime import timedelta
from jose import jwt

router = APIRouter(prefix="/test", tags=["Test"])


@router.get("/token-create-test")
async def test_token_creation():
    """Test token creation."""
    test_data = {"sub": "1", "username": "test", "role": "ADMIN"}
    token = create_access_token(test_data, expires_delta=timedelta(minutes=30))
    
    return {
        "token_created": True,
        "token_length": len(token),
        "token_preview": f"{token[:50]}...",
        "secret_key_configured": bool(settings.SECRET_KEY),
        "secret_key_length": len(settings.SECRET_KEY) if settings.SECRET_KEY else 0,
        "algorithm": settings.ALGORITHM
    }


@router.get("/token-validate-test")
async def test_token_validation(
    authorization: Optional[str] = Header(None)
):
    """Test token validation."""
    if not authorization or not authorization.startswith("Bearer "):
        return {
            "error": "Please provide Authorization: Bearer <token> header"
        }
    
    token = authorization.replace("Bearer ", "").strip()
    
    # Try to decode
    try:
        # Decode without verification first
        unverified = jwt.decode(token, options={"verify_signature": False})
        
        # Now try to verify
        payload = decode_access_token(token)
        
        if payload:
            return {
                "status": "success",
                "token_valid": True,
                "payload": payload,
                "unverified_payload": unverified
            }
        else:
            return {
                "status": "failed",
                "token_valid": False,
                "unverified_payload": unverified,
                "error": "Token validation failed (expired or invalid signature)"
            }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "error_type": type(e).__name__
        }
