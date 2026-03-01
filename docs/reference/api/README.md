# API Reference

Complete REST API documentation for Allo-Scrapper.

## 📑 API Endpoints

### [Authentication](./authentication.md)
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
Scraper control, progress tracking, and SSE events.

**Endpoints:**
- `POST /api/scraper/start` - Start scraping
- `GET /api/scraper/status` - Get scraper status
- `GET /api/scraper/progress` - SSE progress stream
- `POST /api/scraper/cancel` - Cancel running scrape (admin only)

---

### [Reports](./reports.md)
Cinema and showtimes statistics.

**Endpoints:**
- `GET /api/reports/showtimes` - Showtimes report by cinema
- `GET /api/reports/cinemas` - Cinema statistics
- `GET /api/reports/films` - Film statistics

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

### [Users](./users.md)
User management and role assignment.

**Endpoints:**
- `GET /api/users` - List users (admin only)
- `GET /api/users/:id` - Get user by ID (admin only)
- `POST /api/users` - Create user (admin only)
- `PUT /api/users/:id/role` - Update user role (admin only)
- `POST /api/users/:id/reset-password` - Reset password (admin only)
- `DELETE /api/users/:id` - Delete user (admin only)

---

### [System](./system.md)
System information and health checks.

**Endpoints:**
- `GET /api/health` - Health check
- `GET /api/version` - Version info
- `GET /api/stats` - System statistics

---

### [Rate Limiting](./rate-limiting.md)
API rate limiting policies and headers.

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

### Start Scrape
```bash
curl -X POST http://localhost:3000/api/scraper/start \
  -H "Authorization: Bearer <token>"
```

### Get Showtimes Report
```bash
curl http://localhost:3000/api/reports/showtimes
```

---

[← Back to Reference](../README.md)
