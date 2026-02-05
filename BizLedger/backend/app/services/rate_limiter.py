"""
Rate limiting service using in-memory storage.
Tracks requests per API key with sliding window.
"""
import time
from typing import Dict, List
from collections import defaultdict
import logging
from app.core.config import settings

logger = logging.getLogger("access")


class RateLimiter:
    """In-memory rate limiter with sliding window."""
    
    def __init__(self):
        self.requests: Dict[str, List[float]] = defaultdict(list)
        self.max_requests = settings.RATE_LIMIT_REQUESTS
        self.window_seconds = settings.RATE_LIMIT_WINDOW_SECONDS
    
    def _cleanup_old_requests(self, key: str, current_time: float):
        """Remove requests outside the time window."""
        cutoff_time = current_time - self.window_seconds
        self.requests[key] = [
            req_time for req_time in self.requests[key]
            if req_time > cutoff_time
        ]
    
    def is_allowed(self, key: str) -> tuple[bool, int, int]:
        """Check if request is allowed.
        
        Returns:
            (is_allowed, remaining_requests, reset_in_seconds)
        """
        if not settings.RATE_LIMIT_ENABLED:
            return True, self.max_requests, self.window_seconds
        
        current_time = time.time()
        
        # Cleanup old requests
        self._cleanup_old_requests(key, current_time)
        
        # Count requests in window
        request_count = len(self.requests[key])
        
        if request_count >= self.max_requests:
            # Calculate when the oldest request will expire
            if self.requests[key]:
                oldest_request = min(self.requests[key])
                reset_in = int(self.window_seconds - (current_time - oldest_request)) + 1
            else:
                reset_in = self.window_seconds
            
            return False, 0, reset_in
        
        # Add current request
        self.requests[key].append(current_time)
        
        remaining = self.max_requests - request_count - 1
        reset_in = self.window_seconds
        
        return True, remaining, reset_in
    
    def get_key_identifier(self, api_key: str, client_ip: str) -> str:
        """Generate a rate limit key identifier.
        
        Uses hash of API key + IP for rate limiting per key+IP combination.
        """
        import hashlib
        # Create identifier from API key hash and IP
        key_hash = hashlib.sha256(api_key.encode()).hexdigest()[:16]
        return f"{key_hash}:{client_ip}"


# Global rate limiter instance
rate_limiter = RateLimiter()

