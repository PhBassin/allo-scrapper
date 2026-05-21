# Project Documentation Index — allo-scrapper

## Project Overview

- **Type:** Multi-part monorepo with 4 parts
- **Primary Language:** TypeScript (Node.js >=24)
- **Architecture:** Microservices with Redis queue bridge
- **Version:** 4.6.7
- **Generated:** 2026-05-21 (BMAD Document Project — exhaustive scan)

## Quick Reference

### client (React Frontend)
- **Type:** Web SPA
- **Tech Stack:** React 19.2, Vite 8, Tailwind 4.1, TanStack Query 5.90, TypeScript 6.0
- **Root:** `client/`

### server (Express API Backend)
- **Type:** REST API
- **Tech Stack:** Express 5.2, PostgreSQL 15, Redis 7, JWT, Helmet, TypeScript 6.0
- **Root:** `server/`

### scraper (Scraping Microservice)
- **Type:** Event-driven microservice
- **Tech Stack:** Cheerio 1.0, Puppeteer 24, node-cron 4, OpenTelemetry, TypeScript 6.0
- **Root:** `scraper/`

### packages (Shared Libraries)
- **Type:** Library
- **Tech Stack:** Winston (logger), SaaS extensions
- **Root:** `packages/`

---

## Generated Documentation

### Architecture
- [Architecture — Client](./architecture-client.md)
- [Architecture — Server](./architecture-server.md)
- [Architecture — Scraper](./architecture-scraper.md)
- [Architecture — Packages](./architecture-packages.md)
- [Integration Architecture](./integration-architecture.md)

### API & Data
- [API Contracts — Server](./api-contracts-server.md)
- [Data Models — Server](./data-models-server.md)

### Components & Analysis
- [Component Inventory — Client](./component-inventory-client.md)
- [Comprehensive Analysis — Client](./comprehensive-analysis-client.md)
- [Comprehensive Analysis — Scraper](./comprehensive-analysis-scraper.md)
- [Comprehensive Analysis — Packages](./comprehensive-analysis-packages.md)

### Development & Operations
- [Project Overview](./project-overview.md)
- [Source Tree Analysis](./source-tree-analysis.md)
- [Development Guide](./development-guide.md)
- [Deployment Guide](./deployment-guide.md)
- [Contribution Guide](./contribution-guide.md)

---

## Existing Documentation

### Getting Started
- [Quick Start](./getting-started/quick-start.md)
- [Installation](./getting-started/installation.md)
- [Configuration](./getting-started/configuration.md)

### API Reference
- [API Overview](./reference/api/overview.md)
- [Auth API](./reference/api/auth.md)
- [Movies API](./reference/api/movies.md)
- [Theaters API](./reference/api/theaters.md)
- [Scraper API](./reference/api/scraper.md)
- [Reports API](./reference/api/reports.md)
- [Settings API](./reference/api/settings.md)
- [Users API](./reference/api/users.md)
- [Roles API](./reference/api/roles.md)
- [System API](./reference/api/system.md)
- [Health API](./reference/api/health.md)
- [Rate Limiting](./reference/api/rate-limiting.md)
- [OpenAPI Spec](./reference/openapi.yaml)

### Architecture Reference
- [System Design](./reference/architecture/system-design.md)
- [Scraper System](./reference/architecture/scraper-system.md)
- [White-Label System](./reference/architecture/white-label-system.md)

### Database
- [Schema](./reference/database/schema.md)
- [Migrations](./reference/database/migrations.md)

### Guides
- [Development Setup](./guides/development/setup.md)
- [Testing](./guides/development/testing.md)
- [CI/CD](./guides/development/cicd.md)
- [Contributing](./guides/development/contributing.md)
- [Docker Deployment](./guides/deployment/docker.md)
- [Production](./guides/deployment/production.md)
- [Backup & Restore](./guides/deployment/backup-restore.md)
- [Monitoring](./guides/deployment/monitoring.md)
- [Networking](./guides/deployment/networking.md)
- [Admin Panel](./guides/administration/admin-panel.md)
- [White-Label](./guides/administration/white-label.md)
- [User Management](./guides/administration/user-management.md)
- [Admin Operations](./guides/advanced/admin-operations.md)
- [Production Scaling](./guides/advanced/production-scaling.md)
- [Custom Parser Development](./guides/advanced/custom-parser-development.md)

### Troubleshooting
- [Common Issues](./troubleshooting/common-issues.md)
- [Docker](./troubleshooting/docker.md)
- [Scraper](./troubleshooting/scraper.md)
- [Database](./troubleshooting/database.md)
- [Networking](./troubleshooting/networking.md)

### Project
- [README](./README.md)
- [Changelog](./project/changelog.md)
- [Security](./project/security.md)
- [White-Label Plan](./project/white-label-plan.md)
- [Agents](./project/agents.md)
- [Documentation Roadmap](./documentation-roadmap.md)

### Scripts
- [Backup](./reference/scripts/backup.md)
- [Restore](./reference/scripts/restore.md)
- [Deployment](./reference/scripts/deployment.md)
- [Maintenance](./reference/scripts/maintenance.md)

---

## Getting Started

### For Developers
1. Read [Development Guide](./development-guide.md) for setup
2. Read [Architecture — Server](./architecture-server.md) for API design
3. Read [Architecture — Client](./architecture-client.md) for frontend design
4. Read [Integration Architecture](./integration-architecture.md) for system flow

### For AI Agents (Brownfield PRD)
1. Point the PRD workflow to this index: `docs/index.md`
2. For UI-only features: Reference [Architecture — Client](./architecture-client.md)
3. For API-only features: Reference [Architecture — Server](./architecture-server.md) + [API Contracts](./api-contracts-server.md)
4. For full-stack features: Reference all part architectures + [Integration Architecture](./integration-architecture.md)

### For Operators
1. Read [Deployment Guide](./deployment-guide.md)
2. Monitor via [Grafana](http://localhost:3001) (if monitoring profile enabled)
3. Check health: `curl http://localhost:3000/api/health`
