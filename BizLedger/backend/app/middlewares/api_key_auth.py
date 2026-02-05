"""
API Key authentication middleware.
Validates API keys from X-API-KEY header against configured keys.
"""
import hmac
from typing import Callable
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import logging
from app.core.config import settings
from app.middlewares.public_endpoints import is_public_endpoint

logger = logging.getLogger("access")


def constant_time_compare(val1: str, val2: str) -> bool:
    """Constant-time string comparison to prevent timing attacks."""
    try:
        # Ensure both values are strings
        if not isinstance(val1, str):
            val1 = str(val1)
        if not isinstance(val2, str):
            val2 = str(val2)
        # Use constant-time comparison to prevent timing attacks
        return hmac.compare_digest(val1.encode('utf-8'), val2.encode('utf-8'))
    except Exception as e:
        # Log the error for debugging
        logger.error(f"Error in constant_time_compare: {str(e)} | val1_type={type(val1)} | val2_type={type(val2)}")
        return False


class APIKeyAuthMiddleware(BaseHTTPMiddleware):
    """Middleware to validate API keys for all requests."""
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.valid_api_keys = settings.api_keys_list
        
        if settings.API_KEY_REQUIRED and not self.valid_api_keys:
            logger.warning("API_KEY_REQUIRED is True but no API_KEYS configured!")
    
    async def dispatch(self, request: Request, call_next: Callable):
        try:
            path = request.url.path
            method = request.method
            
            # ALWAYS skip API key validation for OPTIONS requests (preflight CORS requests)
            # Browsers don't send custom headers in preflight requests
            if method == "OPTIONS":
                request.state.api_key_valid = False
                request.state.api_key = None
                return await call_next(request)
            
            # ALWAYS skip API key validation for public endpoints (check this FIRST)
            if is_public_endpoint(path):
                request.state.api_key_valid = False
                request.state.api_key = None
                return await call_next(request)
            
            # Skip if API key not required
            if not settings.API_KEY_REQUIRED:
                request.state.api_key_valid = True
                request.state.api_key = None
                return await call_next(request)
            
            # Get API key from header (case-insensitive header lookup)
            api_key = None
            # Try exact match first
            api_key = request.headers.get(settings.API_KEY_HEADER)
            # If not found, try case-insensitive lookup
            if not api_key:
                for header_name, header_value in request.headers.items():
                    if header_name.lower() == settings.API_KEY_HEADER.lower():
                        api_key = header_value
                        break
            
            request_id = getattr(request.state, 'request_id', 'unknown')
            client_ip = request.client.host if request.client else "unknown"
            
            # Check if API key is missing
            if not api_key:
                logger.warning(
                    f"API_KEY_MISSING | request_id={request_id} | "
                    f"path={request.url.path} | method={request.method} | "
                    f"client_ip={client_ip}"
                )
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="API key is required. Please provide X-API-KEY header."
                )
            
            # Check if we have any valid API keys configured
            if not self.valid_api_keys:
                logger.error(
                    f"API_KEY_CONFIG_ERROR | request_id={request_id} | "
                    f"path={request.url.path} | method={request.method} | "
                    f"client_ip={client_ip} | No API keys configured but API_KEY_REQUIRED is True"
                )
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="API key validation is misconfigured. Please contact the administrator."
                )
            
            # Validate API key using constant-time comparison
            api_key_valid = False
            try:
                # Ensure API key is a string
                if not isinstance(api_key, str):
                    api_key = str(api_key)
                
                for valid_key in self.valid_api_keys:
                    # Ensure valid_key is a string
                    if not isinstance(valid_key, str):
                        valid_key = str(valid_key)
                    
                    if constant_time_compare(api_key, valid_key):
                        api_key_valid = True
                        break
            except Exception as e:
                logger.error(
                    f"API_KEY_VALIDATION_ERROR | request_id={request_id} | "
                    f"path={request.url.path} | method={request.method} | "
                    f"client_ip={client_ip} | error={str(e)} | "
                    f"error_type={type(e).__name__} | api_key_type={type(api_key).__name__} | "
                    f"valid_keys_count={len(self.valid_api_keys)}",
                    exc_info=True
                )
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error validating API key: {str(e)}"
                )
            
            if not api_key_valid:
                # Log invalid key attempt (without logging the key itself)
                logger.warning(
                    f"API_KEY_INVALID | request_id={request_id} | "
                    f"path={request.url.path} | method={request.method} | "
                    f"client_ip={client_ip} | key_length={len(api_key) if api_key else 0}"
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Invalid API key"
                )
            
            # API key is valid
            request.state.api_key_valid = True
            request.state.api_key = api_key  # Store for rate limiting (key hash, not actual key)
            
            # Log successful API key validation (without logging the key)
            logger.info(
                f"API_KEY_VALID | request_id={request_id} | "
                f"path={request.url.path} | method={request.method} | "
                f"client_ip={client_ip}"
            )
            
            return await call_next(request)
            
        except HTTPException:
            # Re-raise HTTPException as-is (these are expected errors)
            raise
        except Exception as e:
            # Catch any unexpected exceptions and convert to proper error response
            request_id = getattr(request.state, 'request_id', 'unknown')
            client_ip = request.client.host if request.client else "unknown"
            logger.error(
                f"API_KEY_MIDDLEWARE_ERROR | request_id={request_id} | "
                f"path={request.url.path} | method={request.method} | "
                f"client_ip={client_ip} | error={str(e)}",
                exc_info=True
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An error occurred during API key validation. Please try again."
            )

