# API Overview

Complete reference for the Allo-Scrapper REST API.

**Related Documentation:**
- [Health Check](./health.md) - Service health endpoint
- [Cinemas](./cinemas.md) - Cinema management endpoints
- [Films](./films.md) - Film data endpoints
- [Authentication](./auth.md) - Auth endpoints
- [Scraper](./scraper.md) - Scraping control endpoints
- [Reports](./reports.md) - Scrape reports endpoints
- [Settings](./settings.md) - Settings management
- [Users](./users.md) - User management
- [System](./system.md) - System information
- [../../getting-started/configuration.md](../../getting-started/configuration.md) - Environment variables
- [../../reference/database/](../../reference/database/) - Database schema

---

## Table of Contents

- [Base URL](#base-url)
- [Response Format](#response-format)
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Endpoints](#endpoints)

---

## Base URL

- **Development**: `http://localhost:3000/api`
- **Production**: `https://your-domain.com/api`

---

## Response Format

All endpoints except `GET /api/health` return:

```json
{
  "success": true,
  "data": {}
}
```

Error responses:
```json
{
  "success": false,
  "error": "Error message"
}
```

---

## Authentication

Protected endpoints require JWT authentication:
- **Login**: `POST /api/auth/login` to obtain a token
- **Authorization Header**: `Authorization: Bearer <token>`

**Default credentials:**
- Username: `admin`
- Password: `admin`

**⚠️ Important:** Change the default admin password in production environments.

### JWT Payload

JWTs contain user information and permissions for role-based access control:

```json
{
  "id": 1,
  "username": "admin",
  "role_name": "admin",
  "is_system_role": true,
  "permissions": ["users:list", "users:create", "scraper:trigger", "..."]
}
```

**Token Properties:**
- **Expiry**: 24 hours
- **Permissions**: Baked in at login time (re-login required for permission changes)
- **Admin Bypass**: System admin role has access to all endpoints

### Permission-Based Access

Most endpoints now require specific permissions instead of just admin role:

- `POST /api/scraper/trigger` - Requires `scraper:trigger` permission
- `GET /api/reports` - Requires `reports:list` permission
- `GET /api/reports/:id` - Requires `reports:view` permission
- `PUT /api/settings` - Requires `settings:update` permission
- `POST /api/settings/reset` - Requires `settings:reset` permission
- `POST /api/users` - Requires `users:create` permission
- `PUT /api/users/:id/role` - Requires `users:update` permission
- `DELETE /api/users/:id` - Requires `users:delete` permission

See [Roles & Permissions Reference](../roles-and-permissions.md) for complete permission list.

**Example:**
```bash
# Login and save token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.data.token')

# Use token for protected endpoints
curl http://localhost:3000/api/reports \
  -H "Authorization: Bearer $TOKEN"
```

---

## Rate Limiting

All API endpoints are protected with rate limiting to prevent abuse and ensure service availability.

### Rate Limits by Endpoint Type

| Endpoint Type | Limit | Window | Description |
|--------------|-------|--------|-------------|
| **General API** | 100 requests | 15 minutes | Applies to all `/api/*` routes |
| **Login** | 5 failed attempts | 15 minutes | Failed logins only (successful logins don't count) |
| **Registration** | 3 registrations | 1 hour | New user registrations |
| **Protected Endpoints** | 60 requests | 15 minutes | `/api/reports/*` endpoints |
| **Scraper Trigger** | 10 requests | 15 minutes | `/api/scraper/trigger` endpoint |
| **Public Endpoints** | 100 requests | 15 minutes | `/api/films/*`, `/api/cinemas/*` |

### Rate Limit Headers

All API responses include rate limit headers:
- `RateLimit-Limit` - Maximum requests allowed in the window
- `RateLimit-Remaining` - Requests remaining in current window
- `RateLimit-Reset` - Unix timestamp when the window resets

### 429 Response Format

When the rate limit is exceeded, the API returns a `429 Too Many Requests` response:

```json
{
  "success": false,
  "error": "Too many requests, please try again later."
}
```

The response includes a `Retry-After` header indicating when to retry (in seconds).

### Configuration

Rate limits can be configured via environment variables in `.env`:

```bash
# Rate limit window (default: 15 minutes)
RATE_LIMIT_WINDOW_MS=900000

# General API limit (default: 100)
RATE_LIMIT_GENERAL_MAX=100

# Auth login limit (default: 5)
RATE_LIMIT_AUTH_MAX=5

# Registration limit (default: 3)
RATE_LIMIT_REGISTER_MAX=3
RATE_LIMIT_REGISTER_WINDOW_MS=3600000

# Protected endpoints limit (default: 60)
RATE_LIMIT_PROTECTED_MAX=60

# Scraper trigger limit (default: 10)
RATE_LIMIT_SCRAPER_MAX=10

# Public endpoints limit (default: 100)
RATE_LIMIT_PUBLIC_MAX=100
```

### Practical Examples

**Testing rate limits:**
```bash
# Trigger rate limit on login (5 failed attempts per 15 min)
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"wrong"}' \
    -w "\nStatus: %{http_code}\n"
done

# 6th request returns 429 Too Many Requests
```

**Checking rate limit headers:**
```bash
# Make request and view headers
curl -I http://localhost:3000/api/films

# Response includes:
# RateLimit-Limit: 100
# RateLimit-Remaining: 99
# RateLimit-Reset: 1709647200  (Unix timestamp)
```

**Handling 429 responses:**
```bash
# When rate limited, check Retry-After header
curl -i http://localhost:3000/api/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrong"}'

# If 429, response includes:
# Retry-After: 896  (seconds until reset)
```

**Rate limit bypass for successful logins:**
```bash
# Failed logins count toward limit
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrong"}'
# → Increments counter

# Successful logins do NOT count
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'
# → Does NOT increment counter (returns token)
```

---

## Endpoints

### Quick Reference

| Category | Endpoint | Method | Auth Required |
|----------|----------|--------|---------------|
| [Health](./health.md) | `/api/health` | GET | No |
| [Cinemas](./cinemas.md) | `/api/cinemas` | GET | No |
| [Cinemas](./cinemas.md) | `/api/cinemas/:id` | GET | No |
| [Cinemas](./cinemas.md) | `/api/cinemas` | POST | `cinemas:create` |
| [Cinemas](./cinemas.md) | `/api/cinemas/:id` | PUT | `cinemas:update` |
| [Cinemas](./cinemas.md) | `/api/cinemas/:id` | DELETE | `cinemas:delete` |
| [Films](./films.md) | `/api/films` | GET | No |
| [Films](./films.md) | `/api/films/:id` | GET | No |
| [Films](./films.md) | `/api/films/search` | GET | No |
| [Auth](./auth.md) | `/api/auth/login` | POST | No |
| [Auth](./auth.md) | `/api/auth/register` | POST | No |
| [Auth](./auth.md) | `/api/auth/change-password` | POST | Yes |
| [Scraper](./scraper.md) | `/api/scraper/trigger` | POST | `scraper:trigger` |
| [Scraper](./scraper.md) | `/api/scraper/status` | GET | No |
| [Scraper](./scraper.md) | `/api/scraper/progress` | GET (SSE) | No |
| [Reports](./reports.md) | `/api/reports` | GET | `reports:list` |
| [Reports](./reports.md) | `/api/reports/:id` | GET | `reports:view` |
| [Settings](./settings.md) | `/api/settings` | GET | No |
| [Settings](./settings.md) | `/api/settings/admin` | GET | `settings:read` |
| [Settings](./settings.md) | `/api/settings` | PUT | `settings:update` |
| [Settings](./settings.md) | `/api/settings/reset` | POST | `settings:reset` |
| [Settings](./settings.md) | `/api/settings/export` | GET | `settings:export` |
| [Settings](./settings.md) | `/api/settings/import` | POST | `settings:import` |
| [Settings](./settings.md) | `/api/theme.css` | GET | No |
| [Users](./users.md) | `/api/users` | GET | `users:list` |
| [Users](./users.md) | `/api/users/:id` | GET | `users:list` |
| [Users](./users.md) | `/api/users` | POST | `users:create` |
| [Users](./users.md) | `/api/users/:id/role` | PUT | `users:update` |
| [Users](./users.md) | `/api/users/:id/reset-password` | POST | `users:update` |
| [Users](./users.md) | `/api/users/:id` | DELETE | `users:delete` |
| [System](./system.md) | `/api/system/info` | GET | `system:info` |
| [System](./system.md) | `/api/system/health` | GET | `system:health` |
| [System](./system.md) | `/api/system/migrations` | GET | `system:migrations` |
| **Roles & Permissions Management** | | | |
| [Roles](./roles.md) | `/api/roles/permissions` | GET | `roles:list` |
| [Roles](./roles.md) | `/api/roles` | GET | `roles:list` |
| [Roles](./roles.md) | `/api/roles/:id` | GET | `roles:read` |
| [Roles](./roles.md) | `/api/roles` | POST | `roles:create` |
| [Roles](./roles.md) | `/api/roles/:id` | PUT | `roles:update` |
| [Roles](./roles.md) | `/api/roles/:id` | DELETE | `roles:delete` |
| [Roles](./roles.md) | `/api/roles/:id/permissions` | PUT | `roles:update` |

---

## Related Documentation

- [Health Check](./health.md) - Service health endpoint
- [Cinemas API](./cinemas.md) - Cinema management
- [Films API](./films.md) - Film data
- [Authentication](./auth.md) - Login, registration, password management
- [Scraper API](./scraper.md) - Trigger and monitor scraping
- [Reports API](./reports.md) - View scrape reports
- [Settings API](./settings.md) - Application settings management
- [Users API](./users.md) - User management (admin only)
- [System API](./system.md) - System information and health

---

[← Back to API Reference](./README.md)
