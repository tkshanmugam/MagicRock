"""
Script to generate secure API keys for the BizLeader API.
Run this script to generate API keys that can be added to .env file.
"""
import secrets
import sys


def generate_api_key(length: int = 32) -> str:
    """Generate a secure random API key."""
    return secrets.token_urlsafe(length)


def main():
    """Generate API keys."""
    print("=" * 60)
    print("BizLeader API Key Generator")
    print("=" * 60)
    print()
    
    try:
        count = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    except ValueError:
        count = 1
    
    print(f"Generating {count} API key(s)...")
    print()
    
    keys = []
    for i in range(count):
        key = generate_api_key(32)
        keys.append(key)
        print(f"API Key {i+1}: {key}")
    
    print()
    print("=" * 60)
    print("Add to your .env file:")
    print("=" * 60)
    print(f"API_KEYS={','.join(keys)}")
    print()
    print("⚠️  IMPORTANT:")
    print("  - Store these keys securely")
    print("  - Never commit them to version control")
    print("  - Use different keys for different environments")
    print("  - Rotate keys periodically")
    print("=" * 60)


if __name__ == "__main__":
    main()

