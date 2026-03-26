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

### [Cinemas](./cinemas.md)
Cinema management and metadata.

**Endpoints:**
- `GET /api/cinemas` - List all cinemas
- `GET /api/cinemas/:id` - Get cinema details
- `POST /api/cinemas` - Add new cinema (admin only)
- `PUT /api/cinemas/:id` - Update cinema (admin only)
- `DELETE /api/cinemas/:id` - Delete cinema (admin only)
- `POST /api/cinemas/sync` - Sync from config file (admin only)

---

### [Films](./films.md)
Film information and showtimes.

**Endpoints:**
- `GET /api/films` - List all films
- `GET /api/films/:id` - Get film details
- `GET /api/films/:id/showtimes` - Get showtimes for a film

---

### [Scraper](./scraper.md)
Scraper control, progress tracking, SSE events, and schedule management.

**Endpoints:**
- `POST /api/scraper/trigger` - Trigger scrape (full or single cinema)
- `GET /api/scraper/status` - Get scraper status
- `GET /api/scraper/progress` - SSE progress stream
- `GET /api/scraper/schedules` - List scrape schedules
- `POST /api/scraper/schedules` - Create schedule
- `PUT /api/scraper/schedules/:id` - Update schedule
- `DELETE /api/scraper/schedules/:id` - Delete schedule

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
System information and health checks.

**Endpoints:**
- `GET /api/health` - Health check (rate-limited, cached 5 seconds)
- `GET /api/system/info` - System info (requires `system:info`)

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
