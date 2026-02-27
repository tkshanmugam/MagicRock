"""
Request/Response logging middleware.
"""
import time
import uuid
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import logging

logger = logging.getLogger("access")


class RequestLoggerMiddleware(BaseHTTPMiddleware):
    """Middleware to log all HTTP requests and responses."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate unique request ID
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        # Start timer
        start_time = time.time()
        
        # Get client IP
        client_ip = request.client.host if request.client else "unknown"
        
        # Get API key status (if available)
        api_key_valid = getattr(request.state, 'api_key_valid', None)
        api_key_status = "valid" if api_key_valid else ("invalid" if api_key_valid is False else "none")
        
        # Log request
        logger.info(
            f"REQUEST | request_id={request_id} | method={request.method} | "
            f"path={request.url.path} | client_ip={client_ip} | "
            f"api_key={api_key_status} | "
            f"user_agent={request.headers.get('user-agent', 'unknown')}"
        )
        
        try:
            # Process request
            response = await call_next(request)
            
            # Calculate response time
            process_time = time.time() - start_time
            
            # Log response
            logger.info(
                f"RESPONSE | request_id={request_id} | method={request.method} | "
                f"path={request.url.path} | status_code={response.status_code} | "
                f"response_time={process_time:.4f}s | client_ip={client_ip}"
            )
            
            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id
            
            return response
            
        except Exception as e:
            # Calculate response time
            process_time = time.time() - start_time
            
            # Log error
            error_logger = logging.getLogger("error")
            error_logger.error(
                f"ERROR | request_id={request_id} | method={request.method} | "
                f"path={request.url.path} | error={str(e)} | "
                f"response_time={process_time:.4f}s | client_ip={client_ip}",
                exc_info=True
            )
            
            # Re-raise exception
            raise

