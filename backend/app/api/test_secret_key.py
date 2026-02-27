"""
Test endpoint to verify SECRET_KEY consistency.
"""
from fastapi import APIRouter
from app.core.security import create_access_token, decode_access_token
from app.core.config import settings
from datetime import timedelta

router = APIRouter(prefix="/test", tags=["Test"])


@router.get("/secret-key-consistency")
async def test_secret_key_consistency():
    """
    Test that token creation and validation use the same SECRET_KEY.
    Creates a token and immediately validates it to ensure consistency.
    """
    test_data = {"sub": "1", "username": "test", "role": "ADMIN"}
    
    # Create token
    try:
        token = create_access_token(test_data, expires_delta=timedelta(minutes=30))
    except Exception as e:
        return {
            "status": "error",
            "error": f"Failed to create token: {str(e)}",
            "secret_key_configured": bool(settings.SECRET_KEY),
            "secret_key_length": len(settings.SECRET_KEY) if settings.SECRET_KEY else 0
        }
    
    # Immediately validate the token
    payload = decode_access_token(token)
    
    if payload:
        return {
            "status": "success",
            "message": "Token creation and validation use the same SECRET_KEY",
            "token_created": True,
            "token_validated": True,
            "payload": payload,
            "secret_key_configured": bool(settings.SECRET_KEY),
            "secret_key_length": len(settings.SECRET_KEY) if settings.SECRET_KEY else 0,
            "algorithm": settings.ALGORITHM,
            "confirmation": "✅ SECRET_KEY is consistent - tokens created can be validated"
        }
    else:
        return {
            "status": "failed",
            "message": "Token was created but cannot be validated - SECRET_KEY mismatch!",
            "token_created": True,
            "token_validated": False,
            "secret_key_configured": bool(settings.SECRET_KEY),
            "secret_key_length": len(settings.SECRET_KEY) if settings.SECRET_KEY else 0,
            "algorithm": settings.ALGORITHM,
            "error": "This should never happen if SECRET_KEY is consistent"
        }
