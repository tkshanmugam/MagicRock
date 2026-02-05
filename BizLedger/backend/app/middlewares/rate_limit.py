"""
Rate limiting middleware.
Enforces rate limits per API key.
"""
from typing import Callable
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import logging
from app.core.config import settings
from app.services.rate_limiter import rate_limiter
from app.middlewares.public_endpoints import is_public_endpoint

logger = logging.getLogger("access")


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware to enforce rate limiting."""
    
    async def dispatch(self, request: Request, call_next: Callable):
        # Skip if rate limiting disabled
        if not settings.RATE_LIMIT_ENABLED:
            return await call_next(request)
        
        # ALWAYS skip rate limiting for OPTIONS requests (preflight CORS requests)
        if request.method == "OPTIONS":
            return await call_next(request)
        
        # Skip rate limiting for public endpoints
        if is_public_endpoint(request.url.path):
            return await call_next(request)
        
        # Get API key and client IP for rate limiting
        api_key = getattr(request.state, 'api_key', None)
        client_ip = request.client.host if request.client else "unknown"
        request_id = getattr(request.state, 'request_id', 'unknown')
        
        # If no API key, use IP only (shouldn't happen if API key middleware runs first)
        if not api_key:
            rate_limit_key = f"ip:{client_ip}"
        else:
            rate_limit_key = rate_limiter.get_key_identifier(api_key, client_ip)
        
        # Check rate limit
        is_allowed, remaining, reset_in = rate_limiter.is_allowed(rate_limit_key)
        
        if not is_allowed:
            logger.warning(
                f"RATE_LIMIT_EXCEEDED | request_id={request_id} | "
                f"path={request.url.path} | method={request.method} | "
                f"client_ip={client_ip} | reset_in={reset_in}s"
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Try again in {reset_in} seconds.",
                headers={
                    "X-RateLimit-Limit": str(settings.RATE_LIMIT_REQUESTS),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(reset_in)
                }
            )
        
        # Add rate limit headers to response
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(settings.RATE_LIMIT_REQUESTS)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_in)
        
        return response

