# API Contracts — Server (allo-scrapper)

> Generated: 2026-05-21 | Exhaustive scan of 10 route files | TypeScript 6.0

## Overview

The server exposes a REST API built with **Express 5.2**. Routes are organized by domain in `server/src/routes/`. All endpoints return JSON. The API uses JWT authentication with role-based access control.

**Base URL:** `http://localhost:3001/api`

---

## Authentication & Authorization

| Mechanism | Description |
|-----------|-------------|
| JWT Tokens | Access + Refresh tokens via `/api/auth` |
| Role-Based | `user`, `admin` roles with granular permissions |
| Middleware | `authenticate` (required), `requireAdmin`, `requirePermission` |

---

## Route Summary

### Admin/Rate-Limits
**File:** `server/src/routes/admin/rate-limits.ts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/rate-limits` | authenticated | Validate updates against constraints |
| PUT | `/api/admin/rate-limits` | authenticated | Validate updates against constraints |
| POST | `/api/admin/rate-limits/reset` | authenticated | Validate updates against constraints |
| GET | `/api/admin/rate-limits/audit` | authenticated | Validate updates against constraints |
| GET | `/api/admin/rate-limits/constraints` | authenticated | Validate updates against constraints |

### Auth
**File:** `server/src/routes/auth.ts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | mixed (public + authenticated) | POST /api/auth/login - Login user |
| POST | `/api/auth/register` | mixed (public + authenticated) | POST /api/auth/login - Login user |
| POST | `/api/auth/change-password` | mixed (public + authenticated) | POST /api/auth/login - Login user |

### Movies
**File:** `server/src/routes/movies.ts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/movies` | public | GET /api/movies - Get weekly movies or movies by date |
| GET | `/api/movies/search` | public | GET /api/movies - Get weekly movies or movies by date |
| GET | `/api/movies/:id` | public | GET /api/movies - Get weekly movies or movies by date |

### Reports
**File:** `server/src/routes/reports.ts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/reports` | authenticated | GET /api/reports - Get all scrape reports (paginated) |
| GET | `/api/reports/:id` | authenticated | GET /api/reports - Get all scrape reports (paginated) |
| GET | `/api/reports/:id/details` | authenticated | GET /api/reports - Get all scrape reports (paginated) |

### Roles
**File:** `server/src/routes/roles.ts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/roles/permissions` | authenticated | Fetch with permissions |
| GET | `/api/roles/permission-categories` | authenticated | Fetch with permissions |
| GET | `/api/roles` | authenticated | Fetch with permissions |
| GET | `/api/roles/:id` | authenticated | Fetch with permissions |
| POST | `/api/roles` | authenticated | Fetch with permissions |
| PUT | `/api/roles/:id` | authenticated | Fetch with permissions |
| DELETE | `/api/roles/:id` | authenticated | Fetch with permissions |
| PUT | `/api/roles/:id/permissions` | authenticated | Fetch with permissions |

### Scraper
**File:** `server/src/routes/scraper.ts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/scraper/trigger` | authenticated | — |
| POST | `/api/scraper/resume/:reportId` | authenticated | — |
| GET | `/api/scraper/status` | authenticated | — |
| GET | `/api/scraper/progress` | authenticated | — |
| GET | `/api/scraper/schedules` | authenticated | — |
| GET | `/api/scraper/schedules/:id` | authenticated | — |
| POST | `/api/scraper/schedules` | authenticated | — |
| PUT | `/api/scraper/schedules/:id` | authenticated | — |
| DELETE | `/api/scraper/schedules/:id` | authenticated | — |
| POST | `/api/scraper/schedules/:id/trigger` | authenticated | — |

### Settings
**File:** `server/src/routes/settings.ts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/settings` | authenticated | — |
| GET | `/api/settings/admin` | authenticated | — |
| PUT | `/api/settings` | authenticated | — |
| POST | `/api/settings/reset` | authenticated | — |
| POST | `/api/settings/export` | authenticated | — |
| POST | `/api/settings/import` | authenticated | — |

### System
**File:** `server/src/routes/system.ts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/system/info` | authenticated | Get app info (synchronous, no errors expected) |
| GET | `/api/system/migrations` | authenticated | Get app info (synchronous, no errors expected) |
| GET | `/api/system/health` | authenticated | Get app info (synchronous, no errors expected) |

### Theaters
**File:** `server/src/routes/theaters.ts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/theaters` | authenticated | GET /api/theaters - Get all theaters |
| POST | `/api/theaters` | authenticated | GET /api/theaters - Get all theaters |
| PUT | `/api/theaters/:id` | authenticated | GET /api/theaters - Get all theaters |
| DELETE | `/api/theaters/:id` | authenticated | GET /api/theaters - Get all theaters |
| GET | `/api/theaters/:id` | authenticated | GET /api/theaters - Get all theaters |

### Users
**File:** `server/src/routes/users.ts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/users` | authenticated | — |
| GET | `/api/users/:id` | authenticated | — |
| POST | `/api/users` | authenticated | — |
| PUT | `/api/users/:id/role` | authenticated | — |
| POST | `/api/users/:id/reset-password` | authenticated | — |
| DELETE | `/api/users/:id` | authenticated | — |

---

## Detailed Endpoints

### Auth (`/api/auth`)
**File:** `server/src/routes/auth.ts`

The auth module handles user registration, login, token refresh, and logout.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | public | Create new user account |
| POST | `/api/auth/login` | public | Login, returns JWT tokens |
| POST | `/api/auth/refresh` | public (with refresh token) | Refresh access token |
| POST | `/api/auth/logout` | authenticated | Invalidate tokens |

### Movies (`/api/movies`)
**File:** `server/src/routes/movies.ts`

Movie listings and details from scraped showtime data.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/movies` | public | List all movies with showtimes |
| GET | `/api/movies/:id` | public | Get movie details |

### Theaters (`/api/theaters`)
**File:** `server/src/routes/theaters.ts`

Theater information and management.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/theaters` | public | List all theaters |
| GET | `/api/theaters/:id` | public | Get theater details |
| POST | `/api/theaters` | admin | Create new theater |
| PUT | `/api/theaters/:id` | admin | Update theater |
| DELETE | `/api/theaters/:id` | admin | Delete theater |

### Users (`/api/users`)
**File:** `server/src/routes/users.ts`

User management (admin only for most operations).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/users` | admin | List all users |
| GET | `/api/users/:id` | authenticated | Get user profile |
| PUT | `/api/users/:id` | authenticated | Update own profile |
| DELETE | `/api/users/:id` | admin | Delete user |

### Roles (`/api/roles`)
**File:** `server/src/routes/roles.ts`

Role and permission management.

### Scraper (`/api/scraper`)
**File:** `server/src/routes/scraper.ts`

Scraper control endpoints — trigger scrapes, view status, manage schedules.

### Reports (`/api/reports`)
**File:** `server/src/routes/reports.ts`

Analytics and reporting endpoints.

### Settings (`/api/settings`)
**File:** `server/src/routes/settings.ts`

Application settings (white-label, configuration).

### System (`/api/system`)
**File:** `server/src/routes/system.ts`

Health checks, metrics, system information.

### Admin — Rate Limits (`/api/admin/rate-limits`)
**File:** `server/src/routes/admin/rate-limits.ts`

Rate limit configuration management (admin only).

---

## Middleware Pipeline

| Middleware | File | Purpose |
|-----------|------|---------|
| Helmet | app.ts | Security headers |
| CORS | `utils/cors-config.ts` | Cross-origin requests |
| Rate Limiter | `middleware/rate-limiter.ts` | Request rate limiting |
| Authenticate | `middleware/auth.ts` | JWT verification |
| Require Permission | `middleware/permission.ts` | Role-based access |
| Error Handler | `middleware/error-handler.ts` | Centralized error handling |
| JSON Body Parser | app.ts | express.json() |

---

## Data Flow

```
Client Request
  → CORS check
  → Rate limiter
  → Helmet security headers
  → JSON body parsing
  → Route matching
  → Authentication (JWT verify)
  → Permission check
  → Route handler
    → Service layer (business logic)
    → Database queries (Drizzle ORM)
    → Redis (caching / queue)
  → Response
  → Error handler (if needed)
```

---

## Validation

Request validation uses **Zod** schemas defined alongside routes. Each route validates:
- Request body
- Query parameters
- URL parameters

---

## Error Handling

Standardized JSON error responses:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": []
  }
}
```

Common error codes: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`, `INTERNAL_ERROR`
