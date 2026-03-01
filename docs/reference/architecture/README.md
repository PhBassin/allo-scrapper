# Architecture Documentation

System design, architecture diagrams, and technical decisions.

## 📑 Contents

### [System Design](./system-design.md)
High-level system architecture and component overview.

**What you'll learn:**
- System architecture diagram
- Component responsibilities
- Data flow
- Technology stack
- Design decisions
- Scalability considerations

**Components:**
- Express.js API server
- React frontend
- PostgreSQL database
- Redis (optional, for microservice mode)
- Scraper (in-process or microservice)
- Observability stack (Prometheus, Grafana, Loki, Tempo)

**Best for:** Understanding the big picture, architectural decisions

---

### [Scraper System](./scraper-system.md)
Detailed scraper architecture and design.

**What you'll learn:**
- In-process vs microservice architecture
- Job queue system (Redis)
- Progress tracking (SSE events)
- HTML parsing strategy
- Error handling and retries
- Concurrency control
- Scrape session management

**Modes:**
- **Legacy mode**: In-process scraping (default)
- **Microservice mode**: Standalone scraper service with Redis queue

**Best for:** Understanding scraping internals, troubleshooting scraper issues

---

### [White-Label System](./white-label-system.md)
White-label branding architecture.

**What you'll learn:**
- Settings management flow
- Theme generation system
- Admin panel architecture
- Role-based access control
- Image validation and storage
- CSS variable injection

**Data Flow:**
```
Admin Panel → Settings API → Database → Theme Generator → CSS Variables → Frontend
```

**Best for:** Understanding white-label features, extending branding options

---

## Architecture Diagrams

### High-Level System Architecture
```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       ↓
┌─────────────┐      ┌──────────────┐
│   Nginx     │─────→│ React Client │
│ (Reverse    │      │ (Port 5173)  │
│  Proxy)     │      └──────────────┘
└──────┬──────┘
       │
       ↓
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│ Express API │─────→│  PostgreSQL  │      │    Redis     │
│ (Port 3000) │      │  (Port 5432) │      │ (Port 6379)  │
└──────┬──────┘      └──────────────┘      └──────┬───────┘
       │                                           │
       │              ┌──────────────┐            │
       └─────────────→│   Scraper    │←───────────┘
                      │ Microservice │
                      │ (Port 3001)  │
                      └──────────────┘

Monitoring Stack:
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Prometheus  │  │   Grafana    │  │     Loki     │  │    Tempo     │
│  (Port 9090) │  │  (Port 3100) │  │  (Port 3101) │  │  (Port 3102) │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

### Scraper Data Flow (Legacy Mode)
```
User → [Start Scrape] → API Server → Scraper Service
                              ↓
                      Progress Tracker (SSE)
                              ↓
                         HTTP Client
                              ↓
                      Theater Parser
                              ↓
                         Database
                              ↓
                      [Scrape Complete]
```

### Scraper Data Flow (Microservice Mode)
```
User → [Start Scrape] → API Server → Redis Publisher
                              ↓
                      [Job Published]
                              ↓
                         Redis Queue
                              ↓
                    Scraper Microservice
                              ↓
                      HTTP Client + Parser
                              ↓
                         Database
                              ↓
                    Redis Progress Publisher
                              ↓
                      API Server (SSE)
                              ↓
                            User
```

---

## Design Principles

1. **Separation of Concerns**: Clear boundaries between scraping, API, and frontend
2. **Progressive Enhancement**: Start with simple in-process mode, scale to microservices
3. **Observability First**: Comprehensive logging, metrics, and tracing
4. **Configuration over Code**: Settings managed via database, not hardcoded
5. **Testability**: Unit tests, integration tests, E2E tests at all layers
6. **Backward Compatibility**: Support both legacy and new modes

---

## Related Documentation

- [Scraper Configuration](../../guides/administration/scraper.md) - Scraper settings
- [Monitoring Guide](../../guides/deployment/monitoring.md) - Observability stack
- [API Reference](../api/) - API endpoints and schemas
- [Database Schema](../database/schema.md) - Data model

---

[← Back to Reference](../README.md)
