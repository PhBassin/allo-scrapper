# Project Overview — allo-scrapper

## What is allo-scrapper?
**Theater showtimes aggregator** that scrapes movie screening schedules from external theater websites (Allociné), stores data in PostgreSQL, and exposes it via a REST API and React frontend.

- **Version**: 4.6.7
- **License**: MIT
- **Primary Language**: TypeScript (Node.js >=24)
- **Repository**: Monorepo (npm workspaces)

## Architecture Type
**Microservices** with Redis-backed job queue between Express API server and standalone scraper worker. Monorepo with 4 parts: React client, Express server, scraper microservice, shared libraries.

## Quick Reference
- **Frontend**: React 19.2 + Vite 8 + Tailwind 4 — SPA with admin dashboard
- **Backend**: Express 5.2 — 52 REST endpoints, JWT + RBAC auth
- **Database**: PostgreSQL 15 — 16 tables, raw SQL, automatic migrations
- **Queue**: Redis 7 — LPUSH/BLPOP job dispatch, Pub/Sub events
- **Scraper**: Node.js microservice — Cheerio + Puppeteer, cron scheduling
- **Observability**: Prometheus, Loki, Tempo, Grafana (monitoring profile)
- **CI/CD**: GitHub Actions — test, build, Docker push, version tagging

## Repository Structure
- `client/` — React frontend (web)
- `server/` — Express REST API (backend)
- `scraper/` — Scraping microservice (backend)
- `packages/` — Shared libraries (library)
- `migrations/` — SQL migration files
- `e2e/` — Playwright end-to-end tests
- `.github/` — CI/CD workflows

## Links
- [Architecture — Client](./architecture-client.md)
- [Architecture — Server](./architecture-server.md)
- [Architecture — Scraper](./architecture-scraper.md)
- [Integration Architecture](./integration-architecture.md)
- [API Contracts](./api-contracts-server.md)
- [Data Models](./data-models-server.md)
- [Source Tree](./source-tree-analysis.md)
- [Development Guide](./development-guide.md)
