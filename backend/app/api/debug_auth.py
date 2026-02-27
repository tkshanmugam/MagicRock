"""
Debug endpoint to help diagnose authentication issues.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Header
from typing import Optional
from app.core.security import decode_access_token
from app.core.config import settings
from jose import jwt, JWTError
from datetime import datetime

router = APIRouter(prefix="/debug", tags=["Debug"])


@router.get("/token-info")
async def get_token_info(
    authorization: Optional[str] = Header(None)
):
    """
    Debug endpoint to check token information.
    This helps diagnose authentication issues.
    """
    if not authorization:
        return {
            "error": "No Authorization header provided",
            "hint": "Add 'Authorization: Bearer <token>' header"
        }
    
    if not authorization.startswith("Bearer "):
        return {
            "error": "Invalid Authorization header format",
            "hint": "Format should be: 'Bearer <token>'",
            "received": authorization[:50] + "..." if len(authorization) > 50 else authorization
        }
    
    token = authorization.replace("Bearer ", "").strip()
    
    if not token:
        return {
            "error": "Token is empty",
            "hint": "Provide a valid token after 'Bearer '"
        }
    
    # Try to decode without verification first to see the payload
    try:
        unverified_payload = jwt.decode(token, options={"verify_signature": False})
        exp_timestamp = unverified_payload.get("exp")
        exp_date = datetime.fromtimestamp(exp_timestamp) if exp_timestamp else None
        is_expired = exp_timestamp and exp_timestamp < datetime.utcnow().timestamp()
        
        info = {
            "token_received": True,
            "token_length": len(token),
            "unverified_payload": {
                "user_id": unverified_payload.get("sub"),
                "username": unverified_payload.get("username"),
                "role": unverified_payload.get("role"),
                "exp": exp_timestamp,
                "exp_date": exp_date.isoformat() if exp_date else None,
                "is_expired": is_expired
            }
        }
    except Exception as e:
        return {
            "error": "Cannot decode token (even without verification)",
            "exception": str(e),
            "hint": "Token format is invalid"
        }
    
    # Now try to verify with SECRET_KEY
    try:
        verified_payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        info["verification"] = {
            "status": "success",
            "message": "Token is valid and verified"
        }
    except jwt.ExpiredSignatureError:
        info["verification"] = {
            "status": "failed",
            "error": "Token has expired",
            "exp_date": exp_date.isoformat() if exp_date else None
        }
    except JWTError as e:
        # JWTError covers invalid signatures, malformed tokens, etc.
        error_msg = str(e)
        if "signature" in error_msg.lower() or "Invalid" in error_msg:
            info["verification"] = {
                "status": "failed",
                "error": "Invalid token signature",
                "hint": "The SECRET_KEY used to sign this token doesn't match the current SECRET_KEY",
                "secret_key_length": len(settings.SECRET_KEY) if settings.SECRET_KEY else 0,
                "jwt_error": error_msg
            }
        else:
            info["verification"] = {
                "status": "failed",
                "error": f"JWT Error: {str(e)}"
            }
    except Exception as e:
        info["verification"] = {
            "status": "failed",
            "error": f"Unexpected error: {str(e)}"
        }
    
    return info
