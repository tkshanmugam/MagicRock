"""
Shared utility for checking if an endpoint is public.
All middlewares should use this function for consistency.
"""
from app.core.config import settings


def is_public_endpoint(path: str) -> bool:
    """Check if endpoint is in public endpoints list.
    
    This function is used by all security middlewares to determine
    if an endpoint should bypass security checks.
    
    Args:
        path: Request path (e.g., '/api/v1/health')
    
    Returns:
        True if endpoint is public, False otherwise
    """
    # Normalize path (remove trailing slash for comparison)
    path_normalized = path.rstrip('/') if path != '/' else '/'
    
    # FastAPI built-in endpoints (ALWAYS public, regardless of settings)
    # These MUST be accessible for the API documentation to work
    fastapi_public_paths = ['/docs', '/redoc', '/openapi.json', '/', '']
    if path_normalized in fastapi_public_paths:
        return True
    
    # Check if path starts with /docs or /redoc (for static assets)
    # This catches /docs/static/..., /redoc/static/..., etc.
    if path.startswith('/docs') or path.startswith('/redoc') or path.startswith('/static'):
        return True
    
    # If API key not required, all endpoints are public
    if not settings.API_KEY_REQUIRED:
        return True
    
    # Check configured public endpoints
    public_endpoints = settings.public_endpoints_list
    if not public_endpoints:
        return False
    
    # Check exact match or prefix match
    for endpoint in public_endpoints:
        endpoint_normalized = endpoint.rstrip('/') if endpoint != '/' else '/'
        # Exact match
        if path_normalized == endpoint_normalized:
            return True
        # Prefix match - check if path starts with endpoint
        if path.startswith(endpoint):
            return True
    
    return False

