# Rate Limiting

API rate limiting policies, headers, and configuration for Allo-Scrapper.

**Last updated:** March 6, 2026

**Related Documentation:**
- [API Reference](./README.md) - All API endpoints
- [Authentication API](./auth.md) - Authentication endpoints
- [Configuration Guide](../../getting-started/configuration.md) - Environment variables

---

## Table of Contents

- [Overview](#overview)
- [Rate Limit Tiers](#rate-limit-tiers)
- [Rate Limit Headers](#rate-limit-headers)
- [Handling 429 Responses](#handling-429-responses)
- [Configuration](#configuration)
- [Testing Rate Limits](#testing-rate-limits)
- [Bypassing Rate Limits](#bypassing-rate-limits)

---

## Overview

Allo-Scrapper uses **`express-rate-limit`** middleware to protect the API from abuse and ensure fair usage.

### Key Features

- **Per-IP rate limiting**: Limits are tracked by client IP address
- **Sliding window**: Requests counted within a rolling time window
- **Standard headers**: `X-RateLimit-*` headers included in all responses
- **Configurable**: All limits adjustable via environment variables
- **Tiered limits**: Different limits for different endpoint types

### Strategy

Rate limits are applied **per IP address** using a sliding window algorithm:

```
Window: 15 minutes (default)
Max requests: Varies by endpoint type
Counter reset: Rolling (not fixed intervals)
```

**Example**: If you make 50 requests at 10:00 AM, the counter resets at 10:15 AM (not at the next hour).

---

## Rate Limit Tiers

Different endpoint types have different rate limits to balance security and usability.

### Limit Summary Table

| Tier | Endpoint Pattern | Window | Max Requests | Env Variable |
|------|-----------------|--------|--------------|--------------|
| **General** | `/api/*` (all endpoints) | 15 min | 100 | `RATE_LIMIT_GENERAL_MAX` |
| **Authentication** | `/api/auth/login` | 15 min | 5 failed attempts¹ | `RATE_LIMIT_AUTH_MAX` |
| **Registration** | `/api/auth/register` | 1 hour | 3 | `RATE_LIMIT_REGISTER_MAX` |
| **Protected** | `/api/reports/*` | 15 min | 60 | `RATE_LIMIT_PROTECTED_MAX` |
| **Scraper** | `/api/scraper/trigger` | 15 min | 10 | `RATE_LIMIT_SCRAPER_MAX` |
| **Public** | `/api/films/*`, `/api/cinemas/*` | 15 min | 100 | `RATE_LIMIT_PUBLIC_MAX` |

**¹ Note**: Authentication endpoint only counts **failed login attempts**. Successful logins don't count toward the limit (`skipSuccessfulRequests: true`).

---

### General API Limiter

**Applies to**: All `/api/*` routes (default/baseline limit)

**Default**: 100 requests per 15 minutes

**Purpose**: Prevent general API abuse

**Implementation**:
```typescript
// server/src/middleware/rate-limit.ts
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests
  standardHeaders: true,
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
  },
});
```

---

### Authentication Limiter (Login)

**Applies to**: `/api/auth/login`

**Default**: 5 failed attempts per 15 minutes

**Purpose**: Prevent brute-force password attacks

**Special behavior**: 
- ✅ Successful logins **don't count** toward the limit
- ❌ Failed logins **do count**

**Example scenario**:
```
1. Failed login  (count: 1/5)
2. Failed login  (count: 2/5)
3. Successful login (count: 2/5 - not incremented)
4. Failed login  (count: 3/5)
5. Failed login  (count: 4/5)
6. Failed login  (count: 5/5)
7. Failed login  (BLOCKED - 429 response)
```

**Why this matters**: Legitimate users who forget their password aren't locked out after 5 total attempts, only after 5 consecutive failures.

---

### Registration Limiter

**Applies to**: `/api/auth/register`

**Default**: 3 registrations per 1 hour

**Purpose**: Prevent spam account creation

**Note**: Registration window is **1 hour** (longer than other limits).

**Configuration**:
```bash
RATE_LIMIT_REGISTER_MAX=3
RATE_LIMIT_REGISTER_WINDOW_MS=3600000  # 1 hour in milliseconds
```

---

### Protected Endpoints Limiter

**Applies to**: `/api/reports/*`

**Default**: 60 requests per 15 minutes

**Purpose**: Allow authenticated users more requests than public users

**Usage**: Applied to mutation endpoints that require authentication but aren't as sensitive as authentication routes.

---

### Scraper Limiter

**Applies to**: `/api/scraper/trigger`

**Default**: 10 scrape requests per 15 minutes

**Purpose**: Prevent triggering too many concurrent expensive scraping operations

**Why strict**: Scraping is an expensive operation that:
- Fetches external HTML pages
- Parses large amounts of data
- Writes to database
- Can overload external servers (AlloCiné)

---

### Public Endpoints Limiter

**Applies to**: 
- `/api/films/*`
- `/api/cinemas/*`
- Other public read endpoints

**Default**: 100 requests per 15 minutes

**Purpose**: Allow reasonable read access to public data

**Same as general limit**: Currently identical to `generalLimiter`, but separate for future customization.

---

## Rate Limit Headers

All API responses include **standard rate limit headers** (`RateLimit-*` format, not `X-RateLimit-*`).

### Response Headers

Every response includes these headers:

| Header | Description | Example |
|--------|-------------|---------|
| `RateLimit-Limit` | Maximum requests allowed in window | `100` |
| `RateLimit-Remaining` | Requests remaining in current window | `73` |
| `RateLimit-Reset` | Unix timestamp when limit resets | `1709739600` |

**Legacy headers** (`X-RateLimit-*`) are **disabled** (`legacyHeaders: false`).

---

### Example Response

**Successful request** (within limits):

```http
GET /api/films HTTP/1.1
Host: localhost:3000

HTTP/1.1 200 OK
RateLimit-Limit: 100
RateLimit-Remaining: 73
RateLimit-Reset: 1709739600
Content-Type: application/json

{
  "success": true,
  "data": [...]
}
```

---

**Rate-limited request** (exceeded limit):

```http
POST /api/auth/login HTTP/1.1
Host: localhost:3000

HTTP/1.1 429 Too Many Requests
RateLimit-Limit: 5
RateLimit-Remaining: 0
RateLimit-Reset: 1709739600
Retry-After: 600
Content-Type: application/json

{
  "success": false,
  "error": "Too many login attempts, please try again after 15 minutes."
}
```

---

## Handling 429 Responses

When you exceed a rate limit, the API returns a **`429 Too Many Requests`** response.

### Response Format

```json
{
  "success": false,
  "error": "Too many requests, please try again later."
}
```

### Error Messages by Endpoint

| Endpoint | Error Message |
|----------|---------------|
| General API | "Too many requests, please try again later." |
| `/api/auth/login` | "Too many login attempts, please try again after 15 minutes." |
| `/api/auth/register` | "Too many registration attempts, please try again later." |
| `/api/scraper/trigger` | "Too many scrape requests, please try again later." |
| Protected endpoints | "Too many requests to this resource, please try again later." |

---

### Client-Side Handling

**Check headers before retrying**:

```javascript
async function apiRequest(url) {
  const response = await fetch(url);
  
  if (response.status === 429) {
    const resetTime = parseInt(response.headers.get('RateLimit-Reset'));
    const now = Math.floor(Date.now() / 1000);
    const waitSeconds = resetTime - now;
    
    console.error(`Rate limited. Retry in ${waitSeconds} seconds.`);
    throw new Error('Rate limit exceeded');
  }
  
  return response.json();
}
```

---

### Exponential Backoff

For automated clients, use **exponential backoff**:

```javascript
async function fetchWithRetry(url, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || 60;
        const delay = retryAfter * 1000 * Math.pow(2, attempt - 1);
        
        console.log(`Rate limited. Waiting ${delay}ms before retry ${attempt}/${maxRetries}`);
        await sleep(delay);
        continue;
      }
      
      return response;
    } catch (error) {
      if (attempt === maxRetries) throw error;
    }
  }
}
```

---

## Configuration

All rate limits are configurable via environment variables.

### Environment Variables

**Window duration** (applies to all limits except registration):
```bash
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes (default)
```

**Per-tier limits**:
```bash
RATE_LIMIT_GENERAL_MAX=100          # General API
RATE_LIMIT_AUTH_MAX=5               # Authentication (failed attempts)
RATE_LIMIT_REGISTER_MAX=3           # Registration
RATE_LIMIT_REGISTER_WINDOW_MS=3600000  # Registration window (1 hour)
RATE_LIMIT_PROTECTED_MAX=60         # Protected endpoints
RATE_LIMIT_SCRAPER_MAX=10           # Scraper trigger
RATE_LIMIT_PUBLIC_MAX=100           # Public endpoints
```

---

### Adjusting Limits

**Production (stricter limits)**:
```bash
RATE_LIMIT_GENERAL_MAX=50           # Stricter general limit
RATE_LIMIT_AUTH_MAX=3               # Only 3 failed login attempts
RATE_LIMIT_SCRAPER_MAX=5            # Fewer scrape triggers
```

**Development (relaxed limits)**:
```bash
RATE_LIMIT_GENERAL_MAX=1000         # Generous for testing
RATE_LIMIT_AUTH_MAX=100             # Don't lock out during testing
RATE_LIMIT_SCRAPER_MAX=50           # Frequent scraping during dev
```

**High-traffic public API**:
```bash
RATE_LIMIT_PUBLIC_MAX=500           # Allow more public read requests
RATE_LIMIT_PROTECTED_MAX=200        # Allow more authenticated requests
```

---

### Disabling Rate Limiting (NOT RECOMMENDED)

Rate limiting is **automatically disabled** in test environments when `req.ip` is undefined.

**Do NOT disable in production**. Rate limits are critical for:
- Security (brute-force protection)
- Stability (prevent DoS)
- Fair usage (prevent abuse)

---

## Testing Rate Limits

### Manual Testing with curl

**Test general API limit**:
```bash
# Make 101 requests rapidly
for i in {1..101}; do
  curl -i http://localhost:3000/api/films
done

# The 101st request should return 429
```

**Test authentication limit**:
```bash
# Make 6 failed login attempts
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"wrong","password":"wrong"}'
done

# The 6th request should return 429
```

---

### Automated Testing

**Test file**: `server/src/middleware/rate-limit.test.ts`

```bash
cd server
npm run test -- rate-limit.test.ts
```

**Test environment**: Rate limits are skipped when `req.ip` is undefined (prevents test failures).

---

### Check Remaining Requests

**Before hitting the limit**:
```bash
curl -I http://localhost:3000/api/films | grep RateLimit

# Output:
# RateLimit-Limit: 100
# RateLimit-Remaining: 95
# RateLimit-Reset: 1709739600
```

---

## Bypassing Rate Limits

### For Admin Users (Future Enhancement)

**Not currently implemented**, but you could add:

```typescript
// server/src/middleware/rate-limit.ts
const skipRateLimitForAdmin = (req: any) => {
  return req.user?.role === 'admin';
};

export const generalLimiter = rateLimit({
  // ... other config
  skip: (req) => !req.ip || skipRateLimitForAdmin(req),
});
```

### For Specific IPs (Whitelisting)

**Add to rate-limit.ts**:

```typescript
const WHITELISTED_IPS = ['127.0.0.1', '192.168.1.100'];

const skipWhitelisted = (req: any) => {
  return WHITELISTED_IPS.includes(req.ip);
};

export const generalLimiter = rateLimit({
  skip: (req) => !req.ip || skipWhitelisted(req),
  // ... other config
});
```

---

## Best Practices

### For API Clients

1. **Monitor headers**: Check `RateLimit-Remaining` before making requests
2. **Implement backoff**: Use exponential backoff on 429 responses
3. **Cache responses**: Don't repeatedly request the same data
4. **Batch requests**: Combine multiple operations when possible
5. **Respect Retry-After**: Wait the specified time before retrying

### For API Operators

1. **Set realistic limits**: Balance security and usability
2. **Monitor 429 responses**: Track rate limit violations
3. **Adjust per environment**: Stricter in prod, relaxed in dev
4. **Consider authenticated tiers**: Give authenticated users higher limits
5. **Document limits**: Clearly communicate limits to API consumers

---

## Troubleshooting

### "Too many requests" but I haven't made many

**Cause**: Multiple clients behind same IP (NAT, corporate proxy)

**Solution**: 
- Increase limits for that use case
- Consider per-user rate limiting (requires authentication)

---

### Rate limit headers missing

**Cause**: Endpoint doesn't have rate limiting middleware applied

**Solution**: Check that route uses the appropriate limiter:

```typescript
router.get('/films', publicLimiter, getFilms);
```

---

### Test failures due to rate limiting

**Cause**: Test environment not properly detected

**Solution**: Ensure `req.ip` is undefined in tests, or mock the middleware.

---

## Related Documentation

- [API Reference](./README.md) - All API endpoints
- [Authentication API](./auth.md) - Login and authentication
- [Configuration Guide](../../getting-started/configuration.md) - Environment setup
- [Security Best Practices](../../project/security.md) - Security guidelines

---

[← Back to API Reference](./README.md)
