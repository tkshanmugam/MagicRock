"""
Debug middleware to log all requests and their paths.
Temporary middleware to help diagnose issues.
"""
from typing import Callable
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import logging

logger = logging.getLogger("access")


class DebugMiddleware(BaseHTTPMiddleware):
    """Debug middleware to log request paths."""
    
    async def dispatch(self, request: Request, call_next: Callable):
        path = request.url.path
        logger.info(f"DEBUG: Request to path: {path}")
        logger.info(f"DEBUG: Full URL: {request.url}")
        return await call_next(request)

