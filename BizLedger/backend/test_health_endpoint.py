"""
Test script to verify health endpoint is accessible.
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.middlewares.public_endpoints import is_public_endpoint
from app.core.config import settings

def test_public_endpoints():
    """Test if public endpoint detection works correctly."""
    print("Testing public endpoint detection...")
    print("=" * 60)
    
    test_paths = [
        "/api/v1/health",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/",
        "/api/v1/users",
        "/api/v1/auth/login"
    ]
    
    print(f"API_KEY_REQUIRED: {settings.API_KEY_REQUIRED}")
    print(f"Public endpoints config: {settings.API_KEY_PUBLIC_ENDPOINTS}")
    print(f"Parsed public endpoints: {settings.public_endpoints_list}")
    print("=" * 60)
    
    for path in test_paths:
        is_public = is_public_endpoint(path)
        status = "✓ PUBLIC" if is_public else "✗ PROTECTED"
        print(f"{status:15} | {path}")
    
    print("=" * 60)
    print("\nExpected:")
    print("  /api/v1/health should be PUBLIC")
    print("  /docs should be PUBLIC")
    print("  /api/v1/users should be PROTECTED")
    print("\nIf /api/v1/health shows as PROTECTED, check your .env file:")
    print("  API_KEY_PUBLIC_ENDPOINTS=/api/v1/health")

if __name__ == "__main__":
    test_public_endpoints()

