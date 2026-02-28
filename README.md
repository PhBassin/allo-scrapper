# 🎬 Allo-Scrapper

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

**Cinema showtimes aggregator** that scrapes and centralizes movie screening schedules from the source website cinema pages. Built with Express.js, React, and PostgreSQL, fully containerized with Docker.

---

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Quick Start](#-quick-start)
- [Documentation](#-documentation)
- [Contributing](#-contributing)
- [License](#-license)
- [Support](#-support)

---

## ✨ Features

- **Automated Scraping**: Scheduled scraping of cinema showtimes from the source website
- **RESTful API**: Complete Express.js backend with TypeScript
- **Modern UI**: React SPA with Vite for fast development
- **Real-time Progress**: Server-Sent Events (SSE) for live scraping updates
- **Weekly Reports**: Track cinema programs and identify new releases
- **JWT Authentication**: Secure user authentication with token-based sessions
- **Password Management**: Change password functionality for authenticated users
- **Rate Limiting**: Comprehensive rate limiting per endpoint type (auth, public, protected)
- **Docker Ready**: Full containerization with multi-stage builds (linux/amd64)
- **CI/CD**: GitHub Actions workflow for automated Docker image builds
- **Redis Job Queue**: Scraper microservice mode via Redis pub/sub (`USE_REDIS_SCRAPER=true`)
- **Observability**: Prometheus metrics, Grafana dashboards, Loki log aggregation, Tempo distributed tracing
- **Production Ready**: Health checks, error handling, and database migrations

---

## 🏗 Architecture

```
┌─────────────────┐
│   React SPA     │  Port 80 (production) / 5173 (dev)
│   (Vite + TS)   │
└────────┬────────┘
         │ HTTP API / SSE
         ▼
┌─────────────────┐    Redis pub/sub    ┌───────────────────┐
│  Express.js API │◄───────────────────►│ Scraper           │
│  (TypeScript)   │   scrape:jobs queue │ Microservice      │
│                 │───────────────────►│ (ics-scraper)     │
│  feature flag:  │                    │                   │
│  USE_REDIS_     │    (legacy mode)   │  ┌─────────────┐  │
│  SCRAPER=false  │◄───in-process──────┤  │ Cron        │  │
│  → in-process   │                    │  │ (ics-scraper│  │
│  SCRAPER=true   │                    │  │  -cron)     │  │
│  → Redis queue  │                    │  └─────────────┘  │
└────────┬────────┘                    └────────┬──────────┘
         │ SQL                                  │ SQL
         └──────────────────┬───────────────────┘
                            ▼
              ┌─────────────────────────┐
              │   PostgreSQL  Port 5432 │
              │  cinemas / films /      │
              │  showtimes / reports    │
              └─────────────────────────┘

              ┌─────────────────────────┐
              │   Redis  (in-memory)    │  Message queue + pub/sub
              └─────────────────────────┘

  Monitoring (--profile monitoring):
  Prometheus :9090 → Grafana :3001
  Loki + Promtail (logs) → Grafana
  Tempo :3200 (traces, OTLP :4317) → Grafana
```

**Data Flow:**
1. Client makes HTTP requests to Express API (`/api/*`)
2. API routes handle business logic and validate requests
3. Scraper fetches data from the source website — either in-process (default) or via a Redis job queue (`USE_REDIS_SCRAPER=true`)
4. Progress events flow back to the API via Redis pub/sub → SSE → client
5. PostgreSQL stores structured cinema, film, and showtime data
6. Client receives JSON responses and renders UI

> See [MONITORING.md](./MONITORING.md) for the full observability stack documentation.

---

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Ports 3000 and 5432 available

### Option A: Using Pre-built Images (Recommended)

The easiest way to deploy is using pre-built Docker images from GitHub Container Registry.

```bash
# Clone the repository (for configuration files)
git clone https://github.com/PhBassin/allo-scrapper.git
cd allo-scrapper

# Copy environment file
cp .env.example .env

# Pull the latest image and start services
docker compose up -d

# Initialize database (runs automatically on first startup)
docker compose exec ics-web npm run db:migrate

# Trigger first scrape
curl -X POST http://localhost:3000/api/scraper/trigger
```

**Access the application:**
- Web UI: http://localhost:3000
- API: http://localhost:3000/api
- Health check: http://localhost:3000/api/health

**Update to latest version:**
```bash
docker compose pull ics-web
docker compose up -d
```

### Option B: Building Locally

If you want to build the Docker image from source:

```bash
# Clone the repository
git clone https://github.com/PhBassin/allo-scrapper.git
cd allo-scrapper

# Copy environment file
cp .env.example .env

# Build and start services
docker compose up --build -d

# Initialize database
docker compose exec ics-web npm run db:migrate

# Trigger first scrape
curl -X POST http://localhost:3000/api/scraper/trigger
```

For production deployment and advanced configuration, see [DEPLOYMENT.md](./DEPLOYMENT.md) and [DOCKER.md](./DOCKER.md).

---

## 📚 Documentation

### Core Documentation
- **[API.md](./API.md)** - Complete REST API reference with all endpoints
- **[SETUP.md](./SETUP.md)** - Development setup and environment variables
- **[DATABASE.md](./DATABASE.md)** - Database schema, tables, and queries
- **[SCRAPER.md](./SCRAPER.md)** - Cinema configuration and scraping behavior

### Operations & Deployment
- **[DOCKER.md](./DOCKER.md)** - Docker deployment, optimization, and profiles
- **[NETWORKING.md](./NETWORKING.md)** - LAN access and CORS configuration
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Production deployment guide
- **[MONITORING.md](./MONITORING.md)** - Observability stack (Prometheus, Grafana, Loki, Tempo)

### Development & CI/CD
- **[TESTING.md](./TESTING.md)** - Unit tests, E2E tests, and coverage
- **[CICD.md](./CICD.md)** - GitHub Actions, releases, and tag strategy
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Contribution guidelines
- **[AGENTS.md](./AGENTS.md)** - AI agent workflow and instructions

### Reference
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Common issues and solutions
- **[CHANGELOG.md](./CHANGELOG.md)** - Version history and release notes

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- Code of Conduct
- Development workflow (Issue → Branch → TDD → PR)
- Coding standards
- Commit message conventions (Conventional Commits)
- Testing requirements

For AI coding agents, see [AGENTS.md](./AGENTS.md) for mandatory workflow and TDD requirements.

**Quick contribution checklist:**
1. Create an issue first (bug/feature/task)
2. Create a feature branch from `develop`
3. Write tests before implementation (TDD)
4. Follow Conventional Commits format
5. Ensure all tests pass and Docker builds
6. Create PR referencing the issue
7. Wait for review before merging

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/PhBassin/allo-scrapper/issues)
- **Discussions**: [GitHub Discussions](https://github.com/PhBassin/allo-scrapper/discussions)
- **Documentation**: See [Documentation](#-documentation) section above

---

**Made with ❤️ for cinema enthusiasts**
