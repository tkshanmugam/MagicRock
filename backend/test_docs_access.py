"""
Quick test script to verify /docs endpoint is accessible.
"""
import requests
import sys

def test_docs():
    """Test if /docs endpoint is accessible."""
    base_url = "http://localhost:8000"
    
    endpoints = [
        "/",
        "/docs",
        "/redoc",
        "/openapi.json"
    ]
    
    print("Testing FastAPI documentation endpoints...")
    print("=" * 60)
    
    for endpoint in endpoints:
        try:
            url = f"{base_url}{endpoint}"
            response = requests.get(url, timeout=5)
            status = "✓" if response.status_code == 200 else "✗"
            print(f"{status} {endpoint:20} - Status: {response.status_code}")
        except requests.exceptions.ConnectionError:
            print(f"✗ {endpoint:20} - Connection Error (Server not running?)")
            sys.exit(1)
        except Exception as e:
            print(f"✗ {endpoint:20} - Error: {str(e)}")
    
    print("=" * 60)
    print("\nIf all endpoints show ✓, the docs should be accessible.")
    print("If any show ✗, check the server logs for errors.")

if __name__ == "__main__":
    test_docs()

