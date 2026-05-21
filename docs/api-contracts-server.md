# API Contracts — Server (Express REST API)

## Overview
- **Base URL**: `http://localhost:3000/api`
- **Auth**: JWT Bearer token (except public endpoints)
- **Rate Limiting**: Multiple tiers (public: 100/15min, protected: 60/15min, auth: 5/15min, scraper: 10/15min)
- **Security**: Helmet CSP, CORS, bcrypt password hashing, timing-attack-safe login
- **Metrics**: `GET /metrics` — Prometheus endpoint (prefix: `ics_web_`)

## Endpoints (52 total)

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | None (authLimiter) | Login with username/password → JWT + user + permissions |
| POST | `/api/auth/register` | requireAuth + users:create | Register new user (admin-only) |
| POST | `/api/auth/change-password` | requireAuth | Change own password |

### Movies (Public)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/movies` | None (publicLimiter) | Weekly movies with showtimes. Query: `?date=YYYY-MM-DD` |
| GET | `/api/movies/search` | None (publicLimiter) | Fuzzy search via pg_trgm. Query: `?q=term` |
| GET | `/api/movies/:id` | None (publicLimiter) | Single movie with showtimes |

### Theaters
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/theaters` | None (publicLimiter) | List all theaters |
| GET | `/api/theaters/:id` | None (publicLimiter) | Theater schedule for current week |
| POST | `/api/theaters` | requireAuth + theaters:create | Add theater (smart-add via URL or manual) |
| PUT | `/api/theaters/:id` | requireAuth + theaters:update | Update theater config |
| DELETE | `/api/theaters/:id` | requireAuth + theaters:delete | Delete theater (cascades) |

### Scraper
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/scraper/trigger` | requireAuth + scraper:trigger | Trigger manual scrape via Redis |
| POST | `/api/scraper/resume/:reportId` | requireAuth + scraper:trigger | Resume failed scrape |
| GET | `/api/scraper/status` | None | Current scraper status |
| GET | `/api/scraper/progress` | None | SSE real-time progress stream |
| GET | `/api/scraper/schedules` | requireAuth + schedules:list | List schedules |
| GET | `/api/scraper/schedules/:id` | requireAuth + schedules:list | Get schedule |
| POST | `/api/scraper/schedules` | requireAuth + schedules:create | Create schedule |
| PUT | `/api/scraper/schedules/:id` | requireAuth + schedules:update | Update schedule |
| DELETE | `/api/scraper/schedules/:id` | requireAuth + schedules:delete | Delete schedule |
| POST | `/api/scraper/schedules/:id/trigger` | requireAuth + schedules:update | Trigger scheduled scrape |

### Reports
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/reports` | requireAuth + reports:list | Paginated scrape reports |
| GET | `/api/reports/:id` | requireAuth + reports:view | Single report |
| GET | `/api/reports/:id/details` | requireAuth + reports:view | Report with attempt breakdown |

### Settings
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/settings` | None | Public white-label settings |
| GET | `/api/settings/admin` | requireAuth + settings:read | Full settings (admin) |
| PUT | `/api/settings` | requireAuth + settings:update | Update settings (validates images) |
| POST | `/api/settings/reset` | requireAuth + settings:reset | Reset to defaults |
| POST | `/api/settings/export` | requireAuth + settings:export | Export as JSON |
| POST | `/api/settings/import` | requireAuth + settings:import | Import from JSON |

### Users
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/users` | requireAuth + users:list | List users (paginated) |
| GET | `/api/users/:id` | requireAuth + users:list | Get user |
| POST | `/api/users` | requireAuth + users:create | Create user |
| PUT | `/api/users/:id/role` | requireAuth + users:update | Change user role |
| POST | `/api/users/:id/reset-password` | requireAuth + users:update | Reset password |
| DELETE | `/api/users/:id` | requireAuth + users:delete | Delete user |

### System
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/system/info` | requireAuth + system:info | App version, server health, DB stats |
| GET | `/api/system/migrations` | requireAuth + system:migrations | Applied/pending migrations |
| GET | `/api/system/health` | requireAuth + system:health | Health check (DB, migrations, scraper) |
| GET | `/api/health` | None (healthLimiter) | Simple health + DB connectivity |

### Roles
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/roles` | requireAuth + roles:list | List roles with permissions |
| GET | `/api/roles/permissions` | requireAuth + roles:list | List all permissions |
| GET | `/api/roles/permission-categories` | requireAuth + roles:list | Permission category labels (en/fr) |
| GET | `/api/roles/:id` | requireAuth + roles:read | Get role |
| POST | `/api/roles` | requireAuth + roles:create | Create role |
| PUT | `/api/roles/:id` | requireAuth + roles:update | Update role |
| DELETE | `/api/roles/:id` | requireAuth + roles:delete | Delete role |
| PUT | `/api/roles/:id/permissions` | requireAuth + roles:update | Set role permissions |

### Rate Limits (Admin)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/rate-limits` | requireAuth + ratelimits:read | Current config |
| PUT | `/api/admin/rate-limits` | requireAuth + ratelimits:update | Update config |
| POST | `/api/admin/rate-limits/reset` | requireAuth + ratelimits:reset | Reset to defaults |
| GET | `/api/admin/rate-limits/audit` | requireAuth + ratelimits:audit | Audit log |
| GET | `/api/admin/rate-limits/constraints` | requireAuth + ratelimits:read | Validation constraints |

### Special
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/theme.css` | None (ETag cached) | Dynamic CSS from white-label settings |
| GET | `/metrics` | None | Prometheus metrics |

## Middleware Stack
1. **Morgan** — HTTP request logging (combined format)
2. **Helmet** — Strict CSP (default-src 'self', no unsafe-inline for scripts)
3. **CORS** — Origin-based via ALLOWED_ORIGINS
4. **Rate Limiting** — 7 pre-configured limiters (express-rate-limit)
5. **requireAuth** — JWT verification (Authorization: Bearer)
6. **requirePermission** — RBAC permission check (admin bypass)
7. **errorHandler** — Global error handler (AppError, JWT errors, 500)

## Auth Flow
1. Login → bcrypt compare → JWT sign (payload: id, username, role_name, is_system_role, permissions[])
2. JWT embedded with all needed permissions → no DB lookup per request
3. Admin role (is_system_role=true) bypasses all permission checks
