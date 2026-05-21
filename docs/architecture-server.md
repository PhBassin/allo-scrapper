# Architecture — Server (Express REST API)

## Executive Summary
REST API built with **Express 5.2** + **TypeScript 6.0**, backed by **PostgreSQL 15** and **Redis 7**. Provides JWT authentication, RBAC authorization, rate limiting, white-label theming, and a scraping job queue.

## Technology Stack
| Category | Technology | Version |
|----------|-----------|---------|
| Runtime | Node.js | >=24.0.0 |
| Framework | Express | 5.2.1 |
| Language | TypeScript | ~6.0.2 |
| Database | PostgreSQL (pg) | 15 / 8.20.0 |
| Cache/Queue | Redis (ioredis) | 7 / 5.10.0 |
| Auth | JWT + bcrypt | jsonwebtoken 9.0.3 |
| Security | Helmet + CORS | 8.1.0 / 2.8.5 |
| Rate Limiting | express-rate-limit | 8.3.1 |
| Logging | Winston + Morgan | 3.19.0 / 1.10.0 |
| Metrics | prom-client | 15.1.3 |
| Images | sharp | 0.34.5 |
| Cache | lru-cache | 11.2.6 |
| Testing | Vitest + Supertest | 4.1.1 / 7.2.2 |

## Architecture Pattern
**Layered REST API** with middleware pipeline:
```
Request → Morgan → Helmet → CORS → Rate Limiter → requireAuth → requirePermission → Route Handler → Response
                                                                                          ↓
                                                                                    Service Layer
                                                                                          ↓
                                                                                    DB Queries (pg)
```

## Middleware Pipeline
1. **Morgan** — Combined format HTTP logging
2. **Helmet** — Strict CSP (no unsafe-inline scripts, limited img-src to CDNs)
3. **CORS** — Origin-based (ALLOWED_ORIGINS)
4. **Rate Limiters** — 7 tiers: auth (5/15min), register (3/hr), protected (60/15min), scraper (10/15min), public (100/15min), health (10/min)
5. **requireAuth** — JWT Bearer token verification
6. **requirePermission** — RBAC permission check (admin bypass)
7. **errorHandler** — Global error → HTTP status mapping

## Service Layer (8 services)
| Service | Responsibility |
|---------|---------------|
| AuthService | Login (bcrypt + timing-safe), JWT signing with permissions, password change |
| ScraperService | Redis job publishing, SSE management, status queries |
| TheaterService | CRUD + smart-add via Allociné URL parsing |
| MovieService | Aggregation with concurrent DB queries, fuzzy search (pg_trgm) |
| RedisClient | Singleton ioredis (pub + sub connections), job/event channels |
| ProgressTracker | SSE fan-out broadcaster with replay buffer + heartbeats |
| SystemInfo | App metadata, server health (uptime/memory), DB stats |
| ThemeGenerator | Dynamic CSS from app_settings, Google Fonts detection (20 fonts) |

## Data Architecture
- **16 PostgreSQL tables** (see data-models-server.md)
- **Raw SQL** via pg — no ORM
- **Automatic migrations** with SHA-256 checksums
- **JSONB columns** for flexible data: genres, actors, experiences, footer_links, errors
- **pg_trgm extension** for fuzzy movie search
- **Redis** for job queue (scrape:jobs list) and pub/sub (scrape:progress, scraper:schedule:changed)

## Key Design Decisions
1. **Permissions in JWT payload** — No DB lookup per request
2. **Admin bypass** — is_system_role=true grants all permissions
3. **Timing-safe login** — Dummy hash comparison prevents user enumeration
4. **Singleton Redis client** — Separate pub/sub connections
5. **LRU cache for JSON.parse** — Memoized parsing for repeated operations
6. **ETag caching for theme** — 1h Cache-Control, If-None-Match
7. **SSE with replay buffer** — New subscribers get buffered events
