# Troubleshooting /docs Endpoint

## Quick Fix

If `/docs` is still not working, try this:

### Option 1: Temporarily Disable API Key Requirement

In your `.env` file, set:
```env
API_KEY_REQUIRED=false
```

Then restart the server. This will allow `/docs` to work.

### Option 2: Check Your .env Configuration

Make sure your `.env` file has:
```env
API_KEY_REQUIRED=true
API_KEYS=your-key-here  # Must have at least one key if API_KEY_REQUIRED=true
TIMESTAMP_VALIDATION_ENABLED=false  # Temporarily disable for testing
IP_ALLOWLIST_ENABLED=false  # Make sure this is false
```

### Option 3: Verify Middleware Order

The middleware order in `main.py` should be:
1. RequestLoggerMiddleware
2. IPAllowlistMiddleware (only if enabled)
3. TimestampValidationMiddleware (only if enabled)
4. APIKeyAuthMiddleware (only if API_KEY_REQUIRED=true)
5. RateLimitMiddleware (only if enabled)

## Testing

1. **Test the root endpoint:**
   ```bash
   curl http://localhost:8000/
   ```
   Should return JSON without requiring API key.

2. **Test /docs:**
   ```bash
   curl http://localhost:8000/docs
   ```
   Should return HTML (Swagger UI).

3. **Test /openapi.json:**
   ```bash
   curl http://localhost:8000/openapi.json
   ```
   Should return JSON schema.

## Common Issues

### Issue: "API key is required" error on /docs

**Solution:** The API key middleware is blocking it. Check:
- Is `API_KEY_REQUIRED=true` in .env?
- Is the `is_public_endpoint()` function correctly identifying `/docs`?
- Restart the server after changing .env

### Issue: "Timestamp header required" error

**Solution:** Timestamp validation is blocking it. Set:
```env
TIMESTAMP_VALIDATION_ENABLED=false
```

### Issue: "IP not allowed" error

**Solution:** IP allowlist is blocking it. Set:
```env
IP_ALLOWLIST_ENABLED=false
```

## Debug Steps

1. Check server logs for errors
2. Verify .env file is loaded correctly
3. Test with curl to see exact error messages
4. Check browser console for errors
5. Verify server is actually running on port 8000

## Final Solution

If nothing works, temporarily disable all security for testing:

```env
API_KEY_REQUIRED=false
TIMESTAMP_VALIDATION_ENABLED=false
IP_ALLOWLIST_ENABLED=false
RATE_LIMIT_ENABLED=false
```

Then restart the server. `/docs` should definitely work now.

Once confirmed working, re-enable features one by one to identify which one is causing the issue.

