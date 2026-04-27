# API Overview

Base URL in local development: `http://localhost:3000/api`

## Response shape

Most endpoints return:

```json
{
  "success": true,
  "data": {}
}
```

Errors typically return:

```json
{
  "success": false,
  "error": "Error message"
}
```

`GET /api/health` is the main exception and returns a direct health payload.

## Authentication

Login endpoint:

```http
POST /api/auth/login
```

Protected endpoints expect:

```http
Authorization: Bearer <token>
```

Notes:

- JWT payload includes permissions and role metadata
- permission changes require re-login because permissions are embedded in the token
- system admins authenticate through the same login route and receive `scope: 'superadmin'` automatically when applicable

## Current public routes

- `GET /api/health`
- `GET /api/theme.css`
- `GET /api/config`
- `GET /api/settings`
- `GET /api/films`
- `GET /api/films/search`
- `GET /api/films/:id`
- `GET /api/cinemas`
- `GET /api/cinemas/:id`
- `POST /api/auth/login`

## Rate limiting

The backend applies route-specific limiters.

Default fallback values from `.env.example`:

- general: `100` per `15 min`
- auth failures: `5` per `15 min`
- register: `3` per `1 hour`
- protected: `60` per `15 min`
- scraper: `10` per `15 min`
- public: `100` per `15 min`
- health: `10` per minute

These can also be managed through the admin rate-limits API.

## Related

- [API Index](./README.md)
- [Rate Limiting](./rate-limiting.md)
