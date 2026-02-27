"""
Request timestamp validation middleware.
Prevents replay attacks by validating request timestamps.
"""
import time
from typing import Callable
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import logging
from app.core.config import settings
from app.middlewares.public_endpoints import is_public_endpoint

logger = logging.getLogger("access")


class TimestampValidationMiddleware(BaseHTTPMiddleware):
    """Middleware to validate request timestamps and prevent replay attacks."""
    
    async def dispatch(self, request: Request, call_next: Callable):
        # Skip if timestamp validation disabled
        if not settings.TIMESTAMP_VALIDATION_ENABLED:
            return await call_next(request)
        
        # ALWAYS skip timestamp validation for OPTIONS requests (preflight CORS requests)
        # Browsers don't send custom headers in preflight requests
        if request.method == "OPTIONS":
            return await call_next(request)
        
        # Skip timestamp validation for public endpoints
        if is_public_endpoint(request.url.path):
            return await call_next(request)
        
        # Get timestamp from header
        timestamp_str = request.headers.get(settings.TIMESTAMP_HEADER)
        request_id = getattr(request.state, 'request_id', 'unknown')
        client_ip = request.client.host if request.client else "unknown"
        
        if not timestamp_str:
            logger.warning(
                f"TIMESTAMP_MISSING | request_id={request_id} | "
                f"path={request.url.path} | method={request.method} | "
                f"client_ip={client_ip}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Timestamp header {settings.TIMESTAMP_HEADER} is required"
            )
        
        try:
            # Parse timestamp (expecting Unix timestamp in seconds)
            request_timestamp = float(timestamp_str)
            current_timestamp = time.time()
            
            # Calculate time difference
            time_diff = abs(current_timestamp - request_timestamp)
            
            # Check if timestamp is within tolerance window
            if time_diff > settings.TIMESTAMP_TOLERANCE_SECONDS:
                logger.warning(
                    f"TIMESTAMP_INVALID | request_id={request_id} | "
                    f"path={request.url.path} | method={request.method} | "
                    f"client_ip={client_ip} | time_diff={time_diff:.2f}s | "
                    f"tolerance={settings.TIMESTAMP_TOLERANCE_SECONDS}s"
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Request timestamp is outside allowed tolerance. "
                           f"Time difference: {time_diff:.2f}s (max: {settings.TIMESTAMP_TOLERANCE_SECONDS}s)"
                )
            
            # Timestamp is valid
            request.state.timestamp_valid = True
            request.state.request_timestamp = request_timestamp
            
        except ValueError:
            logger.warning(
                f"TIMESTAMP_INVALID_FORMAT | request_id={request_id} | "
                f"path={request.url.path} | method={request.method} | "
                f"client_ip={client_ip} | timestamp={timestamp_str}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid timestamp format. Expected Unix timestamp in seconds."
            )
        
        return await call_next(request)

