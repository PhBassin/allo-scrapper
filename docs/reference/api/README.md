# API Reference

Complete REST API documentation for Allo-Scrapper.

## 📑 API Endpoints

### [Authentication](./auth.md)
User authentication and JWT token management.

**Endpoints:**
- `POST /api/auth/login` - Login and get JWT token
- `POST /api/auth/logout` - Logout (invalidate token)
- `GET /api/auth/me` - Get current user info

---

### [Theaters](./theaters.md)
Theater management and metadata.

**Endpoints:**
- `GET /api/theaters` - List all theaters
- `GET /api/theaters/:id` - Get theater details
- `POST /api/theaters` - Add new theater (admin only)
- `PUT /api/theaters/:id` - Update theater (admin only)
- `DELETE /api/theaters/:id` - Delete theater (admin only)
- `POST /api/theaters/sync` - Sync from config file (admin only)

---

### [Movies](./movies.md)
Movie information and showtimes.

**Endpoints:**
- `GET /api/movies` - List all movies
- `GET /api/movies/:id` - Get movie details
- `GET /api/movies/:id/showtimes` - Get showtimes for a movie

---

### [Scraper](./scraper.md)
Scraper control, progress tracking, SSE events, and schedule management.

**Endpoints:**
- `POST /api/scraper/trigger` - Trigger scrape (full or single theater) **[Auth]**
- `GET /api/scraper/status` - Get scraper status **[Auth]**
- `GET /api/scraper/progress` - SSE progress stream **[Auth]**
- `GET /api/scraper/schedules` - List scrape schedules **[Auth]**
- `POST /api/scraper/schedules` - Create schedule **[Auth]**
- `PUT /api/scraper/schedules/:id` - Update schedule **[Auth]**
- `DELETE /api/scraper/schedules/:id` - Delete schedule **[Auth]**

---

### [Reports](./reports.md)
Scrape report history and details.

**Endpoints:**
- `GET /api/reports` - List scrape reports (paginated)
- `GET /api/reports/:id` - Get specific report details

---

### [Settings](./settings.md)
Application settings and white-label configuration.

**Endpoints:**
- `GET /api/settings` - Get public settings
- `GET /api/settings/admin` - Get all settings (admin only)
- `PUT /api/settings` - Update settings (admin only)
- `POST /api/settings/reset` - Reset to defaults (admin only)
- `GET /api/settings/export` - Export settings JSON (admin only)
- `POST /api/settings/import` - Import settings JSON (admin only)

---

### [Roles](./roles.md)
Role and permission management.

**Endpoints:**
- `GET /api/roles` - List all roles (requires `roles:list`)
- `GET /api/roles/permissions` - List all available permissions
- `GET /api/roles/:id` - Get role with permissions (requires `roles:read`)
- `POST /api/roles` - Create custom role (requires `roles:create`)
- `PUT /api/roles/:id` - Update role (requires `roles:update`)
- `DELETE /api/roles/:id` - Delete role (requires `roles:delete`)
- `PUT /api/roles/:id/permissions` - Set role permissions (requires `roles:update`)

---

### [Users](./users.md)
User management and role assignment.

**Endpoints:**
- `GET /api/users` - List users (requires `users:list`)
- `GET /api/users/:id` - Get user by ID (requires `users:list`)
- `POST /api/users` - Create user (requires `users:create`)
- `PUT /api/users/:id/role` - Update user role (requires `users:update`)
- `POST /api/users/:id/reset-password` - Reset password (requires `users:update`)
- `DELETE /api/users/:id` - Delete user (requires `users:delete`)

---

### [System](./system.md)
System information, metrics, and health checks.

**Endpoints:**
- `GET /api/health` - Health check (rate-limited, cached 5 seconds)
- `GET /api/system/info` - System info (requires `system:info`)
- `GET /metrics` - Prometheus metrics **[Auth]**

---

### [Rate Limiting](./rate-limiting.md)
API rate limiting policies, headers, and admin configuration.

**What you'll learn:**
- Rate limit tiers
- Rate limit headers
- Handling 429 responses
- Exemptions

---

## API Conventions

### Base URL
```
http://localhost:3000/api
```

### Authentication
Most endpoints require JWT authentication via Bearer token:
```
Authorization: Bearer <token>
```

### Response Format
All responses follow this structure:
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

### Error Format
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

---

## Quick Examples

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'
```

### Trigger Scrape
```bash
curl -X POST http://localhost:3000/api/scraper/trigger \
  -H "Authorization: Bearer <token>"
```

### Get Reports
```bash
curl http://localhost:3000/api/reports \
  -H "Authorization: Bearer <token>"
```

---

[← Back to Reference](../README.md)
