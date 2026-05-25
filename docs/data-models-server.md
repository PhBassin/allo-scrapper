# Data Models — Server (allo-scrapper)

> Generated: 2026-05-21 | Drizzle ORM + PostgreSQL 15 | Exhaustive schema scan

## Overview

The server uses **Drizzle ORM** with **PostgreSQL 15** for data persistence. Schema definitions are in `server/src/db/schema.ts`. Migrations are managed via `server/src/db/migrations.ts`.

**Connection:** Configured via `DATABASE_URL` environment variable in `server/src/db/client.ts`.

---

## Tables

| `users` | User accounts, authentication, profile data |
| `roles` | Role definitions with permissions |
| `user_roles` | Many-to-many user-role assignments |
| `movies` | Scraped movie/showtime data |
| `theaters` | Theater information and configuration |
| `showtimes` | Individual screening times linked to movies |
| `scrape_attempts` | Scraping job history and status |
| `schedules` | Scraping schedule configurations |
| `settings` | Application settings (white-label, config) |
| `rate_limits` | Rate limit configurations per endpoint |
| `reports` | Generated reports and analytics |
| `migrations` | Drizzle migration tracking |

---

## Entity Relationships

```
users ──< user_roles >── roles
users ──< settings
theaters ──< showtimes
movies ──< showtimes
theaters ──< scrape_attempts
schedules ──< scrape_attempts
```

---

## Query Layer

Each table has a dedicated query module in `server/src/db/`:

| Query Module | File |
|-------------|------|
| Movie queries | `db/movie-queries.ts` |
| Theater queries | `db/theater-queries.ts` |
| Showtime queries | `db/showtime-queries.ts` |
| User queries | `db/user-queries.ts` |
| Role queries | `db/role-queries.ts` |
| Schedule queries | `db/schedule-queries.ts` |
| Settings queries | `db/settings-queries.ts` |
| Rate limit queries | `db/rate-limit-queries.ts` |
| Report queries | `db/report-queries.ts` |
| Scrape attempt queries | `db/scrape-attempt-queries.ts` |
| System queries | `db/system-queries.ts` |

---

## Migrations

Migrations are versioned SQL files managed by Drizzle. The migration runner is in `server/src/db/migrations.ts`.

## Database Client

**File:** `server/src/db/client.ts`
**Package:** `drizzle-orm/postgres-js` + `postgres`
