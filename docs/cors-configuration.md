# CORS Configuration Guide

## Overview

The Tab Sync API now supports Chrome extensions and other browser extensions with proper CORS (Cross-Origin Resource Sharing) configuration.

## Problem

Chrome extensions use special origin formats (`chrome-extension://extension-id`) that require explicit CORS handling. The previous configuration had two main issues:

1. **Invalid CORS setup**: Using `credentials: true` with `origin: "*"` is not allowed by the CORS specification
2. **Helmet blocking**: Default Helmet security settings were blocking cross-origin requests

## Solution

### 1. Dynamic Origin Validation

The API now uses a dynamic origin validation function that:

- ✅ Automatically allows **all Chrome extension origins** (`chrome-extension://`)
- ✅ Automatically allows **all Firefox extension origins** (`moz-extension://`)
- ✅ Allows requests with **no origin** (Postman, curl, mobile apps)
- ✅ In **development mode**: Automatically allows localhost and local IPs (10.x, 172.16.x, 192.168.x, 100.64.x)
- ✅ In **production mode**: Checks against configured `ALLOWED_ORIGINS`

### 2. Helmet Configuration

Helmet middleware is now configured to allow cross-origin requests:

```typescript
helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
})
```

### 3. Environment Configuration

Add the `ALLOWED_ORIGINS` environment variable to specify additional allowed origins (optional):

```bash
# .env
ALLOWED_ORIGINS=http://localhost:3000,https://example.com,https://app.example.com
```

**Note**: Browser extensions are always allowed regardless of this setting.

## Configuration Options

### Development Mode

In development (`NODE_ENV=development`), the API automatically allows:
- All browser extensions (Chrome, Firefox)
- All localhost origins
- All local network IPs (10.x, 172.16.x, 192.168.x, 100.64.x)
- Any origins specified in `ALLOWED_ORIGINS`

### Production Mode

In production (`NODE_ENV=production`), the API allows:
- All browser extensions (Chrome, Firefox)
- Only origins specified in `ALLOWED_ORIGINS` environment variable
- Requests with no origin (mobile apps, API clients)

## Testing

### From Chrome Extension

1. Ensure your Chrome extension is loaded
2. Make API calls to `http://your-server:3000/api/v1/*`
3. CORS headers will be automatically set correctly

### From Browser Console

```javascript
fetch('http://localhost:3000/api/v1/health')
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(err => console.error(err));
```

### With curl

```bash
curl -H "Origin: chrome-extension://ehjpngelmohbjmjamlgkflpnlpidoboa" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://localhost:3000/api/v1/health
```

## Troubleshooting

### Still getting CORS errors?

1. **Check server logs**: The server logs all requests and their origins
2. **Verify server is running**: Ensure the server restarted after configuration changes
3. **Check browser console**: Look for specific CORS error messages
4. **Test with curl**: Verify the API is responding correctly

### Server not responding?

```bash
# Check if server is running
lsof -i:3000

# Restart the server
npm run dev
```

### Clear browser cache

Browser extensions may cache CORS responses. Try:
1. Reload the extension
2. Clear browser cache
3. Restart the browser

## Security Considerations

### Production Deployment

When deploying to production:

1. Set `NODE_ENV=production`
2. Configure `ALLOWED_ORIGINS` with specific origins (if needed)
3. Use HTTPS for all production endpoints
4. Keep `JWT_SECRET` secure and strong

### Rate Limiting

The API includes rate limiting by default:
- 60 requests per minute per IP address
- Configurable via `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX_REQUESTS`

## Related Files

- `src/index.ts` - CORS configuration
- `src/config.ts` - Environment variable handling
- `.env.example` - Configuration template
- `docs/REQUIREMENTS.md` - Feature requirements and test cases
