"""
Debug endpoint to check API key configuration.
"""
from fastapi import APIRouter, Header, HTTPException, status
from typing import Optional
from app.core.config import settings
import hmac

router = APIRouter(prefix="/debug", tags=["Debug"])


@router.get("/api-key-config")
async def get_api_key_config():
    """
    Debug endpoint to check API key configuration.
    This helps diagnose API key validation issues.
    """
    return {
        "api_key_required": settings.API_KEY_REQUIRED,
        "api_key_header": settings.API_KEY_HEADER,
        "valid_api_keys_count": len(settings.api_keys_list),
        "valid_api_keys_preview": [
            f"{key[:10]}...{key[-10:]}" if len(key) > 20 else key[:10] + "..."
            for key in settings.api_keys_list[:3]  # Show first 3 keys (masked)
        ],
        "api_keys_env_value_length": len(settings.API_KEYS) if settings.API_KEYS else 0,
        "hint": "Check your .env file for API_KEYS configuration"
    }


@router.get("/api-key-test")
async def test_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-KEY")
):
    """
    Test API key validation.
    """
    if not x_api_key:
        return {
            "error": "No X-API-KEY header provided",
            "hint": "Add 'X-API-KEY: <your-key>' header"
        }
    
    # Check if API key validation is enabled
    if not settings.API_KEY_REQUIRED:
        return {
            "status": "API key validation is disabled",
            "your_key": f"{x_api_key[:10]}...{x_api_key[-10:]}" if len(x_api_key) > 20 else "***",
            "key_length": len(x_api_key)
        }
    
    # Check if we have valid keys configured
    valid_keys = settings.api_keys_list
    if not valid_keys:
        return {
            "error": "No API keys configured",
            "hint": "Set API_KEYS in your .env file",
            "your_key": f"{x_api_key[:10]}...{x_api_key[-10:]}" if len(x_api_key) > 20 else "***",
            "key_length": len(x_api_key)
        }
    
    # Try to match the key
    matched = False
    comparison_errors = []
    
    for i, valid_key in enumerate(valid_keys):
        try:
            # Use the same comparison function as the middleware
            if not isinstance(x_api_key, str):
                x_api_key = str(x_api_key)
            if not isinstance(valid_key, str):
                valid_key = str(valid_key)
            
            if hmac.compare_digest(x_api_key.encode('utf-8'), valid_key.encode('utf-8')):
                matched = True
                break
        except Exception as e:
            comparison_errors.append({
                "key_index": i,
                "error": str(e),
                "error_type": type(e).__name__
            })
    
    if matched:
        return {
            "status": "success",
            "message": "API key is valid!",
            "your_key_preview": f"{x_api_key[:10]}...{x_api_key[-10:]}" if len(x_api_key) > 20 else "***",
            "key_length": len(x_api_key)
        }
    else:
        return {
            "status": "failed",
            "message": "API key does not match any configured keys",
            "your_key_preview": f"{x_api_key[:10]}...{x_api_key[-10:]}" if len(x_api_key) > 20 else "***",
            "your_key_length": len(x_api_key),
            "valid_keys_count": len(valid_keys),
            "comparison_errors": comparison_errors if comparison_errors else None,
            "hint": "Make sure your API key is in the API_KEYS environment variable in your .env file"
        }
