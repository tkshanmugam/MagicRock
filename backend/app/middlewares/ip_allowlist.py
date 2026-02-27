"""
IP allowlist middleware.
Restricts access to allowed IP addresses only.
"""
import ipaddress
from typing import Callable, List
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import logging
from app.core.config import settings
from app.middlewares.public_endpoints import is_public_endpoint

# FastAPI public endpoints that should bypass IP allowlist
FASTAPI_PUBLIC_ENDPOINTS = ['/docs', '/redoc', '/openapi.json', '/']

logger = logging.getLogger("access")


class IPAllowlistMiddleware(BaseHTTPMiddleware):
    """Middleware to enforce IP allowlist."""
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.allowed_ips: List[ipaddress.IPv4Network | ipaddress.IPv6Network] = []
        self._load_allowed_ips()
    
    def _load_allowed_ips(self):
        """Load and parse allowed IP addresses and CIDR ranges."""
        if not settings.IP_ALLOWLIST_ENABLED:
            return
        
        ip_list = settings.ip_allowlist_list
        if not ip_list:
            logger.warning("IP_ALLOWLIST_ENABLED is True but no IP_ALLOWLIST configured!")
            return
        
        for ip_str in ip_list:
            try:
                # Try to parse as CIDR range
                if '/' in ip_str:
                    network = ipaddress.ip_network(ip_str, strict=False)
                    self.allowed_ips.append(network)
                else:
                    # Single IP address, convert to /32 or /128
                    ip = ipaddress.ip_address(ip_str)
                    if isinstance(ip, ipaddress.IPv4Address):
                        network = ipaddress.IPv4Network(f"{ip_str}/32", strict=False)
                    else:
                        network = ipaddress.IPv6Network(f"{ip_str}/128", strict=False)
                    self.allowed_ips.append(network)
            except ValueError as e:
                logger.error(f"Invalid IP address or CIDR range: {ip_str} - {e}")
    
    def _is_ip_allowed(self, client_ip: str) -> bool:
        """Check if client IP is in allowlist."""
        if not settings.IP_ALLOWLIST_ENABLED or not self.allowed_ips:
            return True  # If disabled or empty, allow all
        
        try:
            client_ip_obj = ipaddress.ip_address(client_ip)
        except ValueError:
            logger.warning(f"Invalid client IP address: {client_ip}")
            return False
        
        # Check if IP is in any allowed network
        for network in self.allowed_ips:
            if client_ip_obj in network:
                return True
        
        return False
    
    async def dispatch(self, request: Request, call_next: Callable):
        # Skip if IP allowlist disabled
        if not settings.IP_ALLOWLIST_ENABLED:
            return await call_next(request)
        
        # ALWAYS skip IP allowlist check for OPTIONS requests (preflight CORS requests)
        if request.method == "OPTIONS":
            return await call_next(request)
        
        # Skip IP allowlist check for public endpoints (docs, health, etc.)
        if is_public_endpoint(request.url.path):
            return await call_next(request)
        
        client_ip = request.client.host if request.client else "unknown"
        request_id = getattr(request.state, 'request_id', 'unknown')
        
        if not self._is_ip_allowed(client_ip):
            logger.warning(
                f"IP_NOT_ALLOWED | request_id={request_id} | "
                f"path={request.url.path} | method={request.method} | "
                f"client_ip={client_ip}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Your IP address is not authorized."
            )
        
        return await call_next(request)

