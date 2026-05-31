# System Design

High-level system architecture, component overview, and design decisions for Allo-Scrapper.

**Last updated:** March 6, 2026

**Related Documentation:**
- [Scraper System Architecture](./scraper-system.md) - Detailed scraper design
- [White-Label System Architecture](./white-label-system.md) - Branding system design
- [Database Schema](../database/schema.md) - Data model
- [API Reference](../api/) - REST API endpoints

---

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Component Responsibilities](#component-responsibilities)
- [Data Flow](#data-flow)
- [Technology Stack](#technology-stack)
- [Design Decisions](#design-decisions)
- [Scalability Considerations](#scalability-considerations)

---

## Overview

Allo-Scrapper is a **full-stack theater showtimes aggregator** that scrapes movie screening schedules from external theater websites, stores them in a PostgreSQL database, and exposes them via a REST API and React frontend.

### Key Features

- **Automated scraping**: Scheduled and on-demand scraping of theater showtimes
- **REST API**: Express.js backend with comprehensive endpoints
- **Modern frontend**: React SPA with Tailwind CSS
- **White-label branding**: Fully customizable branding system
- **User management**: Role-based access control (admin/viewer)
- **Observability**: Structured logging, metrics, and distributed tracing
- **Two scraper modes**: In-process (legacy) or microservice (Redis-based)

---

## System Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Browser (Client)                          │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTP/HTTPS
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    Nginx (Reverse Proxy)                            │
│                      Optional in production                         │
└──────────────┬────────────────────────────┬─────────────────────────┘
               │                            │
               ↓                            ↓
    ┌──────────────────┐         ┌──────────────────┐
    │  Express API     │         │  React Client    │
    │  (Port 3000)     │         │  (Static Files)  │
    │                  │         │  or (Port 5173)  │
    │  - REST API      │←────────│  for dev         │
    │  - Auth (JWT)    │  Fetch  └──────────────────┘
    │  - Scraper       │
    │  - Admin routes  │
    └────────┬─────────┘
             │
             ├─────────────────┐
             │                 │
             ↓                 ↓
    ┌──────────────────┐  ┌──────────────────┐
    │   PostgreSQL     │  │      Redis       │
    │   (Port 5432)    │  │   (Port 6379)    │
    │                  │  │   Optional for   │
    │  - Theaters       │  │   microservice   │
    │  - Movies         │  │   scraper mode   │
    │  - Showtimes     │  └────────┬─────────┘
    │  - Users         │           │
    │  - Settings      │           │ Job Queue
    └──────────────────┘           ↓
                          ┌──────────────────┐
                          │ Scraper Service  │
                          │  (Port 3001)     │
                          │  Optional        │
                          │  Microservice    │
                          └──────────────────┘

Monitoring Stack (Optional):
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Prometheus  │  │   Grafana    │  │     Loki     │  │    Tempo     │
│  (Port 9090) │  │  (Port 3100) │  │  (Port 3101) │  │  (Port 3102) │
│   Metrics    │  │  Dashboards  │  │     Logs     │  │    Traces    │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

### Deployment Architecture

**Docker Compose Services:**

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `ics-web` | Node.js 20 | 3000 | Express API + React frontend |
| `ics-db` | PostgreSQL 15 | 5432 | Database |
| `ics-redis` | Redis 7 | 6379 | Job queue (optional) |
| `ics-scraper` | Node.js 20 | - | Scraper microservice (optional) |
| `ics-scraper-cron` | Node.js 20 | - | Scheduled scraper (optional) |
| `ics-prometheus` | Prometheus | 9090 | Metrics collection (optional) |
| `ics-grafana` | Grafana | 3100 | Monitoring dashboards (optional) |
| `ics-loki` | Loki | 3101 | Log aggregation (optional) |
| `ics-tempo` | Tempo | 3102 | Distributed tracing (optional) |

---

## Component Responsibilities

### 1. Express API Server (`server/`)

**Technology**: Node.js 20 + Express.js + TypeScript

**Responsibilities**:
- REST API endpoints for theaters, movies, showtimes, users, settings
- JWT-based authentication and authorization
- Rate limiting and security middleware
- Redis job publishing for scraper dispatch
- Server-Sent Events (SSE) for real-time scrape progress
- Database migrations (automatic on startup)
- Static file serving (production frontend)
- Scheduled scraping via cron jobs
- Theme CSS generation for white-label branding

**Key Files**:
- `server/src/routes/` - API route handlers
- `server/src/services/scraper/` - In-process scraping logic
- `server/src/middleware/` - Auth, admin, rate-limit middleware
- `server/src/db/` - Database queries and migrations

---

### 2. React Frontend (`client/`)

**Technology**: React 18 + TypeScript + Vite + Tailwind CSS

**Responsibilities**:
- User interface for browsing theaters and showtimes
- Admin panel for managing theaters, users, and settings
- Authentication (login/logout)
- Real-time scrape progress via SSE
- White-label branding with dynamic theme CSS
- Responsive design (mobile-first)

**Key Files**:
- `client/src/pages/` - Page components
- `client/src/components/` - Reusable UI components
- `client/src/contexts/` - Global state (auth, settings)
- `client/src/api/` - API client (axios)

---

### 3. PostgreSQL Database

**Technology**: PostgreSQL 15

**Responsibilities**:
- Persistent data storage
- Relational data model with foreign keys
- Automatic schema migrations
- Full-text search capabilities
- Transactional integrity

**Schema**:
- `theaters` - Theater information
- `movies` - Movie metadata
- `showtimes` - Screening schedules
- `users` - User accounts and roles
- `settings` - White-label branding configuration
- `scrape_sessions` - Scrape session tracking

See [Database Schema](../database/schema.md) for complete details.

---

### 4. Scraper Service

All scraping is dispatched via Redis to the standalone scraper microservice (`ics-scraper` container), always included in `docker-compose.yaml`.

**Responsibilities**:
- Fetch HTML from theater websites
- Parse showtimes, movies, and metadata
- Update database with new/changed data
- Report progress via Redis pub/sub
- Error handling and retries
- Rate limiting to avoid blocking

See [Scraper System Architecture](./scraper-system.md) for details.

---

### 5. Redis

**Technology**: Redis 7

**Responsibilities**:
- Job queue for scraper microservice
- Progress updates from scraper to API server
- Pub/sub for real-time events

**When to use**: Production deployments needing horizontal scalability

---

### 6. Monitoring Stack (Optional)

**Components**:
- **Prometheus**: Metrics collection and storage
- **Grafana**: Dashboards and visualization
- **Loki**: Log aggregation and querying
- **Tempo**: Distributed tracing (OpenTelemetry)
- **Promtail**: Log shipping to Loki

**When to use**: Production deployments requiring observability

See [Monitoring Guide](../../guides/deployment/monitoring.md) for setup.

---

## Data Flow

### 1. User Browsing Showtimes

```
Browser → Express API → PostgreSQL
   ↑                         ↓
   └────── JSON Response ────┘
```

1. User navigates to homepage
2. React app fetches `/api/movies` and `/api/theaters`
3. Express queries PostgreSQL
4. Results returned as JSON
5. React renders the UI

---

### 2. Scraping Showtimes

```
Admin → [Trigger Scrape] → Express API
                               ↓
                      Redis Job Publisher
                               ↓
                          Redis Queue
                               ↓
                   Scraper Microservice (ics-scraper)
                               ↓
                         HTTP Client
                               ↓
                      Theater Parser (HTML)
                               ↓
                         PostgreSQL
                               ↓
                    Redis Progress Events
                               ↓
                        SSE → Browser
```

1. Admin triggers scrape via UI or cron job
2. Express publishes job to Redis queue
3. Scraper microservice picks up the job
4. Scraper fetches HTML from theater websites
5. Parser extracts showtimes
6. Data written to PostgreSQL
7. Progress events published back via Redis
8. Browser receives real-time progress via SSE

---

### 3. User Authentication

```
Browser → [Login] → POST /api/auth/login
                          ↓
                    Validate credentials
                          ↓
                    Generate JWT token
                          ↓
              Browser stores token (localStorage)
                          ↓
    All subsequent requests include:
    Authorization: Bearer <token>
```

---

### 5. White-Label Theme Loading

```
Browser → GET /api/theme.css
              ↓
      Express API (theme-generator.ts)
              ↓
      PostgreSQL (settings table)
              ↓
      Generate CSS with custom colors/logo
              ↓
      Browser applies CSS variables
```

---

## Technology Stack

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 20.x | Runtime |
| **Express.js** | 4.x | Web framework |
| **TypeScript** | 5.x | Type safety |
| **PostgreSQL** | 15.x | Database |
| **Redis** | 7.x | Job queue (optional) |
| **Winston** | 3.x | Structured logging |
| **node-cron** | 3.x | Scheduled tasks |
| **JWT** | 9.x | Authentication |
| **Vitest** | 1.x | Testing framework |

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.x | UI framework |
| **TypeScript** | 5.x | Type safety |
| **Vite** | 5.x | Build tool |
| **Tailwind CSS** | 3.x | Styling |
| **Axios** | 1.x | HTTP client |
| **React Router** | 6.x | Routing |

### DevOps

| Technology | Version | Purpose |
|------------|---------|---------|
| **Docker** | 24.x | Containerization |
| **Docker Compose** | 2.x | Multi-container orchestration |
| **Prometheus** | Latest | Metrics |
| **Grafana** | Latest | Dashboards |
| **Loki** | Latest | Logs |
| **Tempo** | Latest | Traces |

---

## Design Decisions

### 1. Monorepo Structure

**Decision**: Single repository with `server/`, `client/`, `scraper/` packages

**Rationale**:
- Easier to coordinate changes across frontend/backend
- Shared TypeScript types
- Simpler CI/CD pipeline
- Better for small teams

---

### 2. Scraper Architecture

**Decision**: All scraping is dispatched via Redis to the standalone scraper microservice

**Rationale**:
- **Fault isolation**: Scraper failures don't affect API availability
- **Scalability**: Multiple scraper workers can run in parallel
- **Observability**: Per-service metrics and distributed tracing
- **Simplicity**: Single code path, no feature flags required

> Prior to v4.x, an in-process mode coexisted with the microservice. It was removed to simplify the architecture.

---

### 3. Automatic Migrations

**Decision**: Run database migrations automatically on server startup (`AUTO_MIGRATE=true`, hardcoded in `docker-compose.yaml`)

**Rationale**:
- Zero-config deployments
- No manual SQL execution required
- Safe: migrations are idempotent
- Can be disabled by editing `docker-compose.yaml` (`AUTO_MIGRATE=false`)

---

### 4. JWT Authentication

**Decision**: Stateless JWT tokens instead of session-based auth

**Rationale**:
- No session storage required
- Scales horizontally (no shared session store)
- Works well with REST APIs
- Supports API clients (mobile, scripts)

---

### 5. PostgreSQL over NoSQL

**Decision**: Relational database (PostgreSQL) instead of NoSQL (MongoDB, etc.)

**Rationale**:
- Complex relational data (theaters ↔ showtimes ↔ movies)
- Strong ACID guarantees
- Foreign key constraints prevent data corruption
- Full-text search capabilities
- Mature ecosystem

---

### 6. Server-Sent Events (SSE) for Progress

**Decision**: SSE for real-time scrape progress instead of WebSockets

**Rationale**:
- Simpler than WebSockets (one-way communication)
- Built-in browser support
- No need for Socket.io or WS libraries
- Works through HTTP/2

---

### 7. White-Label System

**Decision**: Database-driven branding instead of build-time configuration

**Rationale**:
- Change branding without rebuilding frontend
- Supports multi-tenant deployments
- Admin UI for non-technical users
- Dynamic theme CSS generation

See [White-Label System Architecture](./white-label-system.md) for details.

---

## Scalability Considerations

### Horizontal Scaling

**Current limitations**:
- SSE events tied to specific server instance (doesn't work behind load balancer without sticky sessions)
- Cron jobs run on every instance (can cause duplicate scrapes)

**Solutions for production scale**:
1. **Use Redis scraper mode**: Decouple scraping from API server
2. **Redis pub/sub for SSE**: Share progress events across instances
3. **Leader election**: Only one instance runs cron jobs
4. **Nginx sticky sessions**: Route SSE connections to same instance

---

### Database Scaling

**Current approach**: Single PostgreSQL instance

**Future options**:
- **Read replicas**: Separate read/write traffic
- **Connection pooling**: PgBouncer for better connection management
- **Partitioning**: Partition `showtimes` table by date
- **Indexing**: Add indexes for common queries (already implemented)

---

### Caching

**Not currently implemented**

**Future options**:
- **Redis cache**: Cache API responses (theaters, movies)
- **HTTP caching**: ETag / Cache-Control headers
- **CDN**: Cache static assets (frontend bundle, images)

---

## Security Considerations

### Implemented

- ✅ JWT authentication
- ✅ Role-based access control (admin/viewer)
- ✅ Rate limiting (by route)
- ✅ Password hashing (bcrypt)
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS prevention (React escapes by default)
- ✅ CORS configuration
- ✅ Environment variable secrets

### Future Enhancements

- 🔲 HTTPS enforcement (Nginx configuration)
- 🔲 CSP headers
- 🔲 CSRF tokens
- 🔲 Two-factor authentication
- 🔲 API key authentication for scripts

---

## Related Documentation

- [Scraper System Architecture](./scraper-system.md) - Detailed scraper design
- [White-Label System Architecture](./white-label-system.md) - Branding system
- [Database Schema](../database/schema.md) - Data model
- [API Reference](../api/) - REST API documentation
- [Deployment Guide](../../guides/deployment/production.md) - Production setup

---

[← Back to Architecture](./README.md)
