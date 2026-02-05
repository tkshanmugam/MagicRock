"""
Quick diagnostic script to check if endpoints are configured correctly.
Run this while the server is running to test the endpoints.
"""
import requests
import sys

def test_endpoints():
    """Test if endpoints are accessible."""
    base_url = "http://localhost:8000"
    
    endpoints = [
        ("/", "Root endpoint"),
        ("/docs", "Swagger UI"),
        ("/openapi.json", "OpenAPI schema"),
        ("/api/v1/health", "Health check"),
    ]
    
    print("Testing endpoints...")
    print("=" * 70)
    
    for endpoint, description in endpoints:
        try:
            url = f"{base_url}{endpoint}"
            response = requests.get(url, timeout=5)
            
            if response.status_code == 200:
                print(f"[OK] {endpoint:25} - {description} - Status: 200")
            else:
                print(f"[ERROR] {endpoint:25} - {description} - Status: {response.status_code}")
                print(f"         Response: {response.text[:100]}")
        except requests.exceptions.ConnectionError:
            print(f"[ERROR] {endpoint:25} - {description}")
            print("         Server is not running on http://localhost:8000")
            print("         Please start the server first!")
            sys.exit(1)
        except Exception as e:
            print(f"[ERROR] {endpoint:25} - {description}")
            print(f"         Error: {str(e)}")
    
    print("=" * 70)
    print("\nIf all endpoints show [OK], everything is working correctly.")
    print("If any show [ERROR], check the error message above.")

if __name__ == "__main__":
    test_endpoints()

