"""
Endpoint to verify token and show detailed error information.
"""
from fastapi import APIRouter, Header, HTTPException, status
from typing import Optional
from app.core.security import decode_access_token
from app.core.config import settings
from jose import jwt, JWTError
from datetime import datetime

router = APIRouter(prefix="/verify", tags=["Verify"])


@router.get("/token")
async def verify_token(
    authorization: Optional[str] = Header(None)
):
    """
    Verify token and return detailed information about why it might be failing.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No Authorization header provided"
        )
    
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format. Must be: 'Bearer <token>'"
        )
    
    token = authorization.replace("Bearer ", "").strip()
    
    result = {
        "token_received": True,
        "token_length": len(token),
        "secret_key_configured": bool(settings.SECRET_KEY),
        "secret_key_length": len(settings.SECRET_KEY) if settings.SECRET_KEY else 0,
        "algorithm": settings.ALGORITHM
    }
    
    # Try to decode without verification first
    try:
        unverified_payload = jwt.decode(token, options={"verify_signature": False})
        exp_timestamp = unverified_payload.get("exp")
        exp_date = datetime.fromtimestamp(exp_timestamp) if exp_timestamp else None
        is_expired = exp_timestamp and exp_timestamp < datetime.utcnow().timestamp()
        
        result["unverified_payload"] = {
            "user_id": unverified_payload.get("sub"),
            "username": unverified_payload.get("username"),
            "role": unverified_payload.get("role"),
            "exp": exp_timestamp,
            "exp_date": exp_date.isoformat() if exp_date else None,
            "is_expired": is_expired
        }
    except Exception as e:
        result["decode_error"] = {
            "error": str(e),
            "error_type": type(e).__name__,
            "message": "Token format is invalid - cannot decode even without verification"
        }
        return result
    
    # Now try to verify with SECRET_KEY
    try:
        verified_payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        result["verification"] = {
            "status": "success",
            "message": "Token is valid and verified",
            "payload": verified_payload
        }
    except jwt.ExpiredSignatureError:
        result["verification"] = {
            "status": "failed",
            "error": "Token has expired",
            "exp_date": exp_date.isoformat() if exp_date else None
        }
    except JWTError as e:
        error_msg = str(e)
        result["verification"] = {
            "status": "failed",
            "error": "Token signature verification failed",
            "jwt_error": error_msg,
            "error_type": type(e).__name__,
            "hint": "This usually means the SECRET_KEY used to sign the token doesn't match the current SECRET_KEY. The token was likely created with a different SECRET_KEY than what the server is currently using."
        }
    except Exception as e:
        result["verification"] = {
            "status": "failed",
            "error": f"Unexpected error: {str(e)}",
            "error_type": type(e).__name__
        }
    
    return result
