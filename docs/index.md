# Project Documentation Index — allo-scrapper

## Project Overview

- **Type:** Multi-part monorepo with 4 parts
- **Primary Language:** TypeScript (Node.js >=24)
- **Architecture:** Microservices with Redis queue bridge
- **Version:** 4.6.7
- **Updated:** 2026-05-21 (exhaustive code scan)

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

## Generated Documentation (from code scan)

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
- [Comprehensive Analysis — Server](./comprehensive-analysis-server.md)

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
- [Interactive API Reference](./reference/api-interactive.md)

### Database
- [Database Overview](./reference/database/README.md)
- [Schema Reference](./reference/database/schema.md)
- [Migrations](./reference/database/migrations.md)

### Architecture Reference
- [System Design](./reference/architecture/system-design.md)
- [Scraper System](./reference/architecture/scraper-system.md)
- [White-Label System](./reference/architecture/white-label-system.md)

### Guides
- [Development Setup](./guides/development/setup.md)
- [Testing Guide](./guides/development/testing.md)
- [CI/CD](./guides/development/cicd.md)
- [Contributing](./guides/development/contributing.md)
- [Docker Deployment](./guides/deployment/docker.md)
- [Production Deployment](./guides/deployment/production.md)
- [Networking](./guides/deployment/networking.md)
- [Backup & Restore](./guides/deployment/backup-restore.md)
- [Monitoring](./guides/deployment/monitoring.md)
- [Admin Panel](./guides/administration/admin-panel.md)
- [White-Label](./guides/administration/white-label.md)
- [User Management](./guides/administration/user-management.md)
- [Admin Operations](./guides/advanced/admin-operations.md)
- [Production Scaling](./guides/advanced/production-scaling.md)
- [Custom Parser Development](./guides/advanced/custom-parser-development.md)
- [Scraper Rate Limiting](./guides/advanced/scraper-rate-limiting.md)

### Reference
- [Roles & Permissions](./reference/roles-and-permissions.md)
- [Performance](./reference/performance.md)
- [Scraper Reference](./reference/scraper.md)
- [Scripts Reference](./reference/scripts/README.md)
  - [Deployment Scripts](./reference/scripts/deployment.md)
  - [Maintenance Scripts](./reference/scripts/maintenance.md)
  - [Backup Scripts](./reference/scripts/backup.md)
  - [Restore Scripts](./reference/scripts/restore.md)

### Troubleshooting
- [Common Issues](./troubleshooting/common-issues.md)
- [Docker Issues](./troubleshooting/docker.md)
- [Scraper Issues](./troubleshooting/scraper.md)
- [Database Issues](./troubleshooting/database.md)
- [Networking Issues](./troubleshooting/networking.md)

### Project
- [README](./project/agents.md)
- [Changelog](./project/changelog.md)
- [Security](./project/security.md)
- [White-Label Plan](./project/white-label-plan.md)
