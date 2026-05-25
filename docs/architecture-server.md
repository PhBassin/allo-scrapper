# Architecture — Server (allo-scrapper)

> Generated: 2026-05-21 | Express 5.2 + PostgreSQL 15 + Redis 7

## Overview

The server is the central API backend for allo-scrapper. It follows a **layered architecture** pattern:

```
Routes (HTTP handlers) → Services (business logic) → DB Queries (data access) → PostgreSQL
                                                           ↕
                                                       Redis (cache/queue)
```

---

## Directory Structure

```
server/src/
├── app.ts              # Express app setup, middleware registration
├── index.ts            # Entry point — HTTP server bootstrap
├── config/             # Configuration constants
│   └── rate-limits.ts  
├── db/                 # Database layer (Drizzle ORM)
│   ├── client.ts       # PostgreSQL connection
│   ├── schema.ts       # Table definitions
│   ├── migrations.ts   # Migration runner
│   └── *-queries.ts    # Per-table query modules
├── middleware/          # Express middleware
│   ├── auth.ts         # JWT authentication
│   ├── permission.ts   # Role-based authorization
│   ├── rate-limit.ts   # Rate limit enforcement
│   ├── rate-limiter.ts # Rate limiter factory
│   └── error-handler.ts
├── routes/             # HTTP route handlers
│   ├── auth.ts         # Authentication endpoints
│   ├── movies.ts       
│   ├── theaters.ts     
│   ├── users.ts        
│   ├── roles.ts        
│   ├── scraper.ts      
│   ├── reports.ts      
│   ├── settings.ts     
│   ├── system.ts       
│   └── admin/          # Admin-only routes
│       └── rate-limits.ts
├── services/           # Business logic layer
│   ├── auth-service.ts
│   ├── movie-service.ts
│   ├── scraper-service.ts
│   ├── theater-service.ts
│   ├── system-info.ts
│   ├── theme-generator.ts
│   ├── progress-tracker.ts
│   └── redis-client.ts
├── types/              # TypeScript type definitions
│   ├── api.ts
│   ├── user.ts
│   ├── role.ts
│   ├── scraper.ts
│   └── settings.ts
└── utils/              # Utility functions
    ├── cors-config.ts
    ├── date.ts
    ├── errors.ts
    ├── html-decode.ts
    ├── image-validator.ts
    ├── json-parse-cache.ts
    ├── jwt-config.ts
    ├── jwt-secret-validator.ts
    ├── logger.ts
    ├── number.ts
    ├── security.ts
    ├── showtimes.ts
    └── url.ts
```

---

## Request Lifecycle

1. **HTTP Request** → `index.ts` (server.listen)
2. **CORS** → `utils/cors-config.ts`
3. **Security Headers** → Helmet
4. **Body Parsing** → express.json()
5. **Rate Limiting** → `middleware/rate-limiter.ts`
6. **Route Matching** → Express router
7. **JWT Auth** → `middleware/auth.ts` (if route requires)
8. **Permission Check** → `middleware/permission.ts` (if route requires)
9. **Route Handler** → `routes/*.ts`
10. **Business Logic** → `services/*.ts`
11. **Data Access** → `db/*-queries.ts`
12. **Response** → JSON
13. **Error Handling** → `middleware/error-handler.ts` (on error)

---

## Key Design Decisions

### Authentication
- JWT-based with access + refresh token pattern
- Secrets validated via `utils/jwt-secret-validator.ts`
- Token configuration in `utils/jwt-config.ts`

### Authorization
- Role-based access control (RBAC)
- Granular permissions per role
- Middleware: `requirePermission` checks against user roles

### Rate Limiting
- Configurable per-endpoint rate limits
- Stored in database (`rate_limits` table)
- Admin panel for configuration at `/api/admin/rate-limits`

### Redis Integration
- BullMQ for job queues (scraper communication)
- Connection via `services/redis-client.ts`
- Progress tracking via `services/progress-tracker.ts`

### Logging
- Winston logger via `utils/logger.ts`
- Structured JSON logging

### Security
- Helmet for HTTP headers
- CORS configuration
- Input validation with Zod
- HTML decode for XSS prevention
- Image validation for upload safety

---

## Configuration

| Env Variable | Purpose |
|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | JWT signing secret |
| `JWT_REFRESH_SECRET` | Refresh token secret |
| `PORT` | Server port (default: 3001) |
| `CORS_ORIGIN` | Allowed CORS origins |
| `NODE_ENV` | Environment (development/production) |

---

## Testing

- **Framework:** Vitest
- **Test files:** Co-located with source (`*.test.ts`)
- **Coverage targets:** 80% lines, 80% functions, 80% statements, 65% branches
