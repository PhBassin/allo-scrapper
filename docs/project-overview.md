# Project Overview — allo-scrapper

> Generated: 2026-05-21 | Version 4.6.7

## What is Allo-Scrapper?

**Allo-Scrapper** is a theater showtimes aggregator that:
- Scrapes movie screening schedules from external theater websites (AlloCiné)
- Stores data in PostgreSQL
- Exposes a REST API (Express.js)
- Provides a React frontend for browsing and administration
- Supports white-label theming for multi-tenant deployments

---

## Architecture at a Glance

| Component | Technology | Role |
|-----------|-----------|------|
| **Client** | React 19.2, Vite 8, Tailwind 4.1 | SPA for browsing showtimes + admin panel |
| **Server** | Express 5.2, PostgreSQL 15, Redis 7 | REST API, auth, data management |
| **Scraper** | Cheerio, Puppeteer, BullMQ | Theater website scraping |
| **Packages** | Shared libraries | Logging, SaaS utilities |

---

## Key Features

- **Multi-theater aggregation** — Scrape multiple theater sources
- **Strategy pattern** — Extensible parser system for new sources
- **Real-time progress** — Live scraping status via Redis
- **White-label** — Customizable branding per deployment
- **Admin panel** — Theater/user/role/schedule management
- **Rate limiting** — Configurable per-endpoint limits
- **Observability** — OpenTelemetry metrics and tracing
- **Docker support** — Full containerized deployment

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React 19.2, Vite 8, Tailwind CSS 4.1, TanStack Query 5.90 |
| Backend | Express 5.2, Drizzle ORM, Zod validation |
| Database | PostgreSQL 15 (primary), Redis 7 (cache/queue) |
| Scraping | Cheerio 1.0, Puppeteer 24, node-cron 4 |
| Queue | BullMQ (Redis-backed) |
| Observability | OpenTelemetry, Winston, Prometheus metrics |
| Language | TypeScript 6.0 (strict mode) |
| Testing | Vitest (unit), Playwright (E2E) |
| CI/CD | GitHub Actions, Docker |
| Package Manager | npm workspaces (monorepo) |

---

## Quick Start

```bash
# Clone and install
git clone <repo-url>
cd allo-scrapper
npm install

# Start infrastructure
docker compose up -d postgres redis

# Run database migrations
cd server && npm run db:migrate

# Start services
npm run dev    # starts server + scraper
cd client && npm run dev  # starts frontend
```

---

## Repository

- **Type:** Multi-part monorepo (npm workspaces)
- **Branch strategy:** Git Flow (main, develop, feature/*)
- **Commit convention:** Conventional Commits
- **CI/CD:** GitHub Actions with Docker builds

---

## Documentation Index

See [index.md](./index.md) for the full documentation map.
