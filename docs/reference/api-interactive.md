# Interactive API Reference

Explore the Allo-Scrapper REST API with full interactive documentation.

**Last updated:** March 18, 2026

---

## OpenAPI Specification

The Allo-Scrapper API is documented using the **OpenAPI 3.0 standard**. This enables interactive exploration, client SDK generation, and integration with tools like Swagger UI and Redocly.

**Specification File**: `docs/reference/openapi.yaml`

---

## Accessing the API Documentation

### Option 1: Swagger UI (Interactive)

View and test API endpoints in browser with live examples:

```bash
# Using SwaggerUI online (no setup needed)
https://editor.swagger.io/?url=https://raw.githubusercontent.com/phbassin/allo-scrapper/develop/docs/reference/openapi.yaml
```

**Features:**
- ✅ Interactive endpoint testing
- ✅ Live request/response examples
- ✅ Schema documentation with types
- ✅ Authentication testing with JWT tokens
- ✅ Try-it-out functionality (test endpoints from UI)

### Option 2: Local Swagger UI (Self-hosted)

Host Swagger UI locally for offline access:

**Docker:**
```bash
docker run -p 80:8080 \
  -e SWAGGER_JSON_URL=https://raw.githubusercontent.com/phbassin/allo-scrapper/develop/docs/reference/openapi.yaml \
  swaggerapi/swagger-ui
```

Then visit: http://localhost

**Docker Compose:**
```yaml
services:
  swagger-ui:
    image: swaggerapi/swagger-ui
    ports:
      - "8080:8080"
    environment:
      SWAGGER_JSON_URL: https://raw.githubusercontent.com/phbassin/allo-scrapper/develop/docs/reference/openapi.yaml
```

### Option 3: Redocly (Beautiful Documentation)

Generate beautiful static documentation:

```bash
# Online (no setup needed)
https://redocly.github.io/redoc/?url=https://raw.githubusercontent.com/phbassin/allo-scrapper/develop/docs/reference/openapi.yaml
```

**Features:**
- ✅ Beautiful responsive design
- ✅ Code examples in multiple languages
- ✅ Improved readability
- ✅ Mobile-friendly

---

## API Structure

The API is organized into **8 main resource groups**:

### 1. **Authentication** (`/auth`)
- `POST /auth/login` – User login
- `POST /auth/register` – Create new user
- `POST /auth/change-password` – Change password

### 2. **Cinemas** (`/cinemas`)
- `GET /cinemas` – List cinemas
- `POST /cinemas` – Create cinema
- `GET /cinemas/{id}` – Get cinema details
- `PUT /cinemas/{id}` – Update cinema
- `DELETE /cinemas/{id}` – Delete cinema

### 3. **Films** (`/films`)
- `GET /films` – List films
- `GET /films/search?q=...` – Search films
- `GET /films/{id}` – Get film details

### 4. **Scraper** (`/scraper`)
- `POST /scraper/trigger` – Trigger scraping job
- `GET /scraper/status` – Get scraper status
- `GET /scraper/reports` – List scrape reports
- `GET /scraper/reports/{id}` – Get report details

### 5. **Settings** (`/settings`)
- `GET /settings` – Get public settings
- `GET /settings/admin` – Get full settings (admin only)
- `PUT /settings` – Update settings
- `POST /settings/reset` – Reset to defaults
- `POST /settings/export` – Export as JSON
- `POST /settings/import` – Import from JSON

### 6. **System** (`/system`)
- `GET /system/health` – Check system health
- `GET /system/info` – Get system information
- `GET /system/migrations` – View database migrations

### 7. **Roles** (`/roles`)
- `GET /roles` – List all roles
- `POST /roles` – Create role
- `GET /roles/{id}` – Get role details
- `PUT /roles/{id}` – Update role
- `DELETE /roles/{id}` – Delete role

### 8. **Users** (`/users`)
- `GET /users` – List users
- `POST /users` – Create user
- `GET /users/{id}` – Get user details
- `PUT /users/{id}` – Update user role
- `DELETE /users/{id}` – Delete user

---

## Quick Start

### 1. Authentication

All protected endpoints require a JWT token:

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "password123"
  }'

# Response:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "role_name": "admin"
  }
}
```

### 2. Use Token in Requests

```bash
# List cinemas with authentication
curl http://localhost:3000/api/cinemas \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 3. Testing in Swagger UI

1. Click **"Authorize"** button (top right)
2. Paste your JWT token
3. All subsequent requests will include the token automatically
4. Click **"Try it out"** on any endpoint to test

---

## Code Examples

### JavaScript/Node.js

```typescript
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api';

// 1. Login
const loginRes = await fetch(`${API_URL}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'password123'
  })
});

const { token } = await loginRes.json();

// 2. List cinemas
const cinemasRes = await fetch(`${API_URL}/cinemas`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

const { cinemas } = await cinemasRes.json();
console.log(cinemas);

// 3. Trigger scraping
const scrapeRes = await fetch(`${API_URL}/scraper/trigger`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ triggerType: 'manual' })
});

const { reportId } = await scrapeRes.json();
```

### Python

```python
import requests

API_URL = 'http://localhost:3000/api'

# Login
response = requests.post(f'{API_URL}/auth/login', json={
    'username': 'admin',
    'password': 'password123'
})
token = response.json()['token']

# List cinemas
headers = {'Authorization': f'Bearer {token}'}
response = requests.get(f'{API_URL}/cinemas', headers=headers)
cinemas = response.json()['cinemas']

# Trigger scraping
response = requests.post(
    f'{API_URL}/scraper/trigger',
    headers=headers,
    json={'triggerType': 'manual'}
)
report_id = response.json()['reportId']
```

### cURL

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}' \
  | jq -r '.token')

# Use token in requests
curl http://localhost:3000/api/cinemas \
  -H "Authorization: Bearer $TOKEN"

# Trigger scraping
curl -X POST http://localhost:3000/api/scraper/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"triggerType":"manual"}'
```

---

## Permissions & Authorization

All protected endpoints enforce role-based access control (RBAC). See the required permission in each endpoint's documentation.

**Common Permissions:**
- `cinemas:read` – View cinemas
- `cinemas:create` – Add cinemas
- `scraper:trigger` – Trigger scraping jobs
- `settings:read` – View settings
- `settings:update` – Modify settings
- `users:list` – View users
- `roles:*` – Manage roles

See `docs/reference/roles-and-permissions.md` for complete permission list.

---

## Error Responses

All endpoints return standard HTTP error codes and descriptive error messages:

```json
{
  "error": "Forbidden",
  "message": "You do not have permission to access this resource",
  "statusCode": 403
}
```

**Common Status Codes:**
- `200` – Success
- `201` – Created
- `204` – No content
- `400` – Bad request
- `401` – Unauthorized (missing/invalid JWT)
- `403` – Forbidden (insufficient permissions)
- `404` – Not found
- `409` – Conflict (resource exists)
- `429` – Too many requests (rate limited)
- `500` – Server error

---

## Rate Limiting

The API enforces rate limits per endpoint group:

| Endpoint Group | Limit | Window |
|---|---|---|
| Public endpoints | 100 requests | 1 minute |
| Protected endpoints | 60 requests | 1 minute |
| Scraper endpoints | 10 requests | 1 minute |

**Rate limit info in response headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1710768300
```

When rate limited, the API returns `429 Too Many Requests`:
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Try again in 45 seconds.",
  "statusCode": 429
}
```

---

## API Versioning

The current API version is **3.0.0** (accessible at `/api` path).

**Version History:**
- **v3.0.0** – Current (RBAC, comprehensive permissions)
- **v2.1.0** – Previous (legacy role system)

All new development targets v3.0.0. Legacy v2.x endpoints are no longer supported.

---

## Pagination

Endpoints that return lists support pagination:

```bash
# Get page 2 with 25 items per page
curl http://localhost:3000/api/cinemas?page=2&limit=25 \
  -H "Authorization: Bearer $TOKEN"

# Response includes pagination info:
{
  "cinemas": [...],
  "total": 150,
  "page": 2,
  "limit": 25
}
```

**Default Pagination:**
- Default `limit`: 50
- Max `limit`: 100
- Default `page`: 1

---

## Filtering & Search

Some endpoints support filtering:

```bash
# Filter films by cinema
curl http://localhost:3000/api/films?cinema_id=c12345 \
  -H "Authorization: Bearer $TOKEN"

# Search films
curl "http://localhost:3000/api/films/search?q=dune" \
  -H "Authorization: Bearer $TOKEN"

# Search cinemas
curl "http://localhost:3000/api/cinemas?search=paris" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Generating Client SDKs

The OpenAPI spec can be used to auto-generate client libraries for multiple languages:

```bash
# Generate JavaScript client
npx openapi-generator-cli generate -i docs/reference/openapi.yaml -g javascript -o ./generated/js-client

# Generate Python client
openapi-generator-cli generate -i docs/reference/openapi.yaml -g python -o ./generated/python-client

# Generate Go client
openapi-generator-cli generate -i docs/reference/openapi.yaml -g go -o ./generated/go-client
```

See [OpenAPI Generator](https://openapi-generator.tech/) for supported languages.

---

## Testing with Postman

Import the OpenAPI spec into Postman for integrated API testing:

1. Open **Postman**
2. Click **Import** (top left)
3. Select **Link** tab
4. Paste: `https://raw.githubusercontent.com/phbassin/allo-scrapper/develop/docs/reference/openapi.yaml`
5. Click **Import**

All endpoints will be pre-configured in Postman.

---

## Troubleshooting

### 401 Unauthorized

**Problem**: `{"error":"Unauthorized"}`

**Solutions:**
1. Check JWT token is valid (hasn't expired)
2. Re-login to get fresh token: `POST /auth/login`
3. Verify token is included in `Authorization: Bearer <token>` header

### 403 Forbidden

**Problem**: `{"error":"Forbidden","message":"You do not have permission"}`

**Solutions:**
1. Check user's role has required permission
2. See endpoint docs for required permission
3. Admin user can modify roles via `PUT /roles/{id}`

### 429 Too Many Requests

**Problem**: Rate limit exceeded

**Solutions:**
1. Wait for reset time (see `X-RateLimit-Reset` header)
2. Reduce request frequency
3. Contact admin to increase rate limits if needed

### 404 Not Found

**Problem**: Resource doesn't exist

**Solutions:**
1. Check resource ID is correct
2. Verify resource hasn't been deleted
3. List endpoint to see available resources

---

## Integration Examples

### Example 1: Scrape Cinema Showtimes

```bash
#!/bin/bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"operator","password":"pass123"}' | jq -r '.token')

# Add cinema
CINEMA_ID=$(curl -s -X POST http://localhost:3000/api/cinemas \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Cinema","url":"https://...","source":"allocine"}' | jq -r '.id')

# Trigger scraping
REPORT_ID=$(curl -s -X POST http://localhost:3000/api/scraper/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq -r '.reportId')

# Check scraping result
sleep 10
curl http://localhost:3000/api/scraper/reports/$REPORT_ID \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

### Example 2: Export Settings Backup

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"pass123"}' | jq -r '.token')

# Export settings
curl -X POST http://localhost:3000/api/settings/export \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  > settings-backup-$(date +%Y%m%d).json

# Restore settings later
curl -X POST http://localhost:3000/api/settings/import \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @settings-backup-20250318.json
```

---

## API Roadmap

**Planned Enhancements:**
- GraphQL endpoint (alongside REST)
- WebSocket support for real-time events
- Batch operation endpoints
- Advanced filtering DSL
- Caching headers (ETag, Cache-Control)
- Request/response compression

---

## Need Help?

- **Interactive Testing**: Use Swagger UI at https://editor.swagger.io
- **Report Issues**: [GitHub Issues](https://github.com/phbassin/allo-scrapper/issues)
- **Documentation**: [Full docs](../../README.md)
- **Discussions**: [GitHub Discussions](https://github.com/phbassin/allo-scrapper/discussions)

---

**OpenAPI Specification**: See `docs/reference/openapi.yaml` for complete details.

Last updated: **March 18, 2026**
