# API Key Security Documentation

## Overview

The BizLeader API implements comprehensive API key-based security with multiple layers of protection:

1. **API Key Authentication** - Validates calling applications
2. **JWT Authentication** - Validates user identity
3. **Rate Limiting** - Prevents abuse
4. **Replay Protection** - Timestamp validation
5. **IP Allowlist** - Optional IP-based access control

## Security Architecture

### Request Flow

```
1. Request arrives
   ↓
2. Request Logging (captures all requests)
   ↓
3. IP Allowlist Check (if enabled)
   ↓
4. Timestamp Validation (replay protection)
   ↓
5. API Key Authentication
   ↓
6. Rate Limiting
   ↓
7. Route Handler (JWT auth if required)
   ↓
8. Response
```

## Configuration

### Environment Variables

```env
# API Key Configuration
API_KEYS=key1,key2,key3                    # Comma-separated API keys
API_KEY_HEADER=X-API-KEY                    # Header name for API key
API_KEY_REQUIRED=true                       # Require API key for all endpoints
API_KEY_PUBLIC_ENDPOINTS=/api/v1/health    # Public endpoints (comma-separated)

# Rate Limiting
RATE_LIMIT_ENABLED=true                     # Enable rate limiting
RATE_LIMIT_REQUESTS=100                     # Requests per window
RATE_LIMIT_WINDOW_SECONDS=60                # Time window in seconds

# Replay Protection
TIMESTAMP_VALIDATION_ENABLED=true           # Enable timestamp validation
TIMESTAMP_HEADER=X-TIMESTAMP                # Header name for timestamp
TIMESTAMP_TOLERANCE_SECONDS=300             # Max time difference (5 minutes)

# IP Allowlist (Optional)
IP_ALLOWLIST_ENABLED=false                  # Enable IP allowlist
IP_ALLOWLIST=127.0.0.1,192.168.1.0/24       # Allowed IPs/CIDR ranges
```

## Generating API Keys

```bash
# Generate a single API key
python generate_api_keys.py

# Generate multiple API keys
python generate_api_keys.py 3
```

**Output:**
```
API Key 1: xK9mP2qR5vT8wY1zA4bC7dE0fG3hI6jK9lM2nO5pQ8rS1tU4vW7xY0zA3bC6dE
API Key 2: yL0nQ3rS6wU9xZ2aB5cD8eF1gH4iJ7kL0mN3oP6qR9sT2uV5wX8yZ1aB4cD7eF
API Key 3: zM1oR4sT7xV0yA3bC6dE9fG2hI5jK8lM1nO4pQ7rS0tU3vW6xY9zA2bC5dE8fG

Add to your .env file:
API_KEYS=xK9mP2qR5vT8wY1zA4bC7dE0fG3hI6jK9lM2nO5pQ8rS1tU4vW7xY0zA3bC6dE,yL0nQ3rS6wU9xZ2aB5cD8eF1gH4iJ7kL0mN3oP6qR9sT2uV5wX8yZ1aB4cD7eF,zM1oR4sT7xV0yA3bC6dE9fG2hI5jK8lM1nO4pQ7rS0tU3vW6xY9zA2bC5dE8fG
```

## Using API Keys

### Example Request

```bash
# Get current Unix timestamp
TIMESTAMP=$(date +%s)

# Make authenticated request
curl -X GET "http://localhost:8000/api/v1/users" \
  -H "X-API-KEY: your-api-key-here" \
  -H "X-TIMESTAMP: $TIMESTAMP" \
  -H "Authorization: Bearer your-jwt-token"
```

### JavaScript/TypeScript Example

```typescript
const timestamp = Math.floor(Date.now() / 1000);

const response = await fetch('http://localhost:8000/api/v1/users', {
  method: 'GET',
  headers: {
    'X-API-KEY': 'your-api-key-here',
    'X-TIMESTAMP': timestamp.toString(),
    'Authorization': `Bearer ${jwtToken}`
  }
});
```

### Python Example

```python
import requests
import time

timestamp = int(time.time())

response = requests.get(
    'http://localhost:8000/api/v1/users',
    headers={
        'X-API-KEY': 'your-api-key-here',
        'X-TIMESTAMP': str(timestamp),
        'Authorization': f'Bearer {jwt_token}'
    }
)
```

## Security Features

### 1. API Key Authentication

- **Constant-time comparison** prevents timing attacks
- **Multiple keys supported** for different environments/clients
- **Never logged** in access logs or error logs
- **Header-based** (configurable header name)

### 2. Rate Limiting

- **Per API key + IP** combination
- **Sliding window** algorithm
- **Configurable limits** (default: 100 requests/minute)
- **HTTP 429** response when exceeded
- **Rate limit headers** in response:
  - `X-RateLimit-Limit`: Maximum requests
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Seconds until reset

### 3. Replay Protection

- **Timestamp validation** prevents replay attacks
- **Configurable tolerance** (default: 5 minutes)
- **Unix timestamp** in seconds required
- **Rejects old requests** outside tolerance window

### 4. IP Allowlist (Optional)

- **CIDR range support** (e.g., `192.168.1.0/24`)
- **IPv4 and IPv6** support
- **Optional feature** (disabled by default)
- **IP-based access control**

## Error Responses

### 401 Unauthorized - Missing API Key

```json
{
  "detail": "API key is required. Please provide X-API-KEY header."
}
```

### 403 Forbidden - Invalid API Key

```json
{
  "detail": "Invalid API key"
}
```

### 429 Too Many Requests - Rate Limit Exceeded

```json
{
  "detail": "Rate limit exceeded. Try again in 45 seconds."
}
```

Response headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 45
```

### 400 Bad Request - Invalid Timestamp

```json
{
  "detail": "Request timestamp is outside allowed tolerance. Time difference: 600.00s (max: 300s)"
}
```

### 403 Forbidden - IP Not Allowed

```json
{
  "detail": "Access denied. Your IP address is not authorized."
}
```

## Public Endpoints

These endpoints don't require API key authentication:

- `/api/v1/health` (configurable via `API_KEY_PUBLIC_ENDPOINTS`)

## Logging

### Access Logs

All API key events are logged (without logging the actual key):

```
API_KEY_VALID | request_id=abc123 | path=/api/v1/users | method=GET | client_ip=192.168.1.1
API_KEY_MISSING | request_id=def456 | path=/api/v1/users | method=GET | client_ip=192.168.1.1
API_KEY_INVALID | request_id=ghi789 | path=/api/v1/users | method=GET | client_ip=192.168.1.1 | key_length=32
RATE_LIMIT_EXCEEDED | request_id=jkl012 | path=/api/v1/users | method=GET | client_ip=192.168.1.1 | reset_in=45s
TIMESTAMP_INVALID | request_id=mno345 | path=/api/v1/users | method=GET | client_ip=192.168.1.1 | time_diff=600.00s
IP_NOT_ALLOWED | request_id=pqr678 | path=/api/v1/users | method=GET | client_ip=10.0.0.1
```

### Security Best Practices

1. **Generate Strong Keys**: Use 32+ character random keys
2. **Rotate Regularly**: Change API keys periodically
3. **Use Different Keys**: Different keys for dev/staging/prod
4. **Never Log Keys**: Keys are never logged or returned in responses
5. **HTTPS Only**: Always use HTTPS in production
6. **Monitor Logs**: Regularly review access logs for suspicious activity
7. **Limit IPs**: Use IP allowlist when possible
8. **Set Appropriate Limits**: Configure rate limits based on usage patterns

## Testing

### Test API Key Validation

```bash
# Missing API key (should return 401)
curl http://localhost:8000/api/v1/users

# Invalid API key (should return 403)
curl -H "X-API-KEY: invalid-key" http://localhost:8000/api/v1/users

# Valid API key (should work)
curl -H "X-API-KEY: your-valid-key" \
     -H "X-TIMESTAMP: $(date +%s)" \
     http://localhost:8000/api/v1/users
```

### Test Rate Limiting

```bash
# Make 101 requests quickly (should hit rate limit on 101st)
for i in {1..101}; do
  curl -H "X-API-KEY: your-key" \
       -H "X-TIMESTAMP: $(date +%s)" \
       http://localhost:8000/api/v1/health
done
```

### Test Timestamp Validation

```bash
# Old timestamp (should return 400)
curl -H "X-API-KEY: your-key" \
     -H "X-TIMESTAMP: 1000000000" \
     http://localhost:8000/api/v1/users

# Future timestamp (should return 400)
curl -H "X-API-KEY: your-key" \
     -H "X-TIMESTAMP: 9999999999" \
     http://localhost:8000/api/v1/users
```

## Troubleshooting

### API Key Not Working

1. Check `.env` file has `API_KEYS` configured
2. Verify key is in the comma-separated list
3. Check header name matches `API_KEY_HEADER` setting
4. Review access logs for error messages

### Rate Limit Issues

1. Check `RATE_LIMIT_REQUESTS` and `RATE_LIMIT_WINDOW_SECONDS`
2. Review rate limit headers in response
3. Wait for reset period or increase limits

### Timestamp Errors

1. Ensure client clock is synchronized (use NTP)
2. Check `TIMESTAMP_TOLERANCE_SECONDS` setting
3. Verify timestamp is Unix seconds (not milliseconds)

## Production Checklist

- [ ] Generate strong API keys (32+ characters)
- [ ] Configure multiple keys for different environments
- [ ] Set appropriate rate limits
- [ ] Enable IP allowlist if possible
- [ ] Configure timestamp tolerance
- [ ] Enable HTTPS
- [ ] Monitor access logs
- [ ] Set up key rotation schedule
- [ ] Document key distribution process
- [ ] Test all security features

