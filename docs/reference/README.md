# Reference Documentation

Technical reference documentation for APIs, database, scripts, and architecture.

## 📑 Categories

### [API Reference](./api/)
Complete REST API documentation with endpoints, schemas, and examples.

**Contents:**
- Authentication and JWT tokens
- Cinemas management
- Films and showtimes
- Scraper control and progress tracking
- Reports and statistics
- Settings management
- User management
- System information
- Rate limiting

**Best for:** API integration, frontend development, automation

---

### [Database](./database/)
Database schema, migrations, and queries.

**Contents:**
- Complete schema documentation
- Table relationships
- Migration system
- Query examples
- Indexing strategy

**Best for:** Database administrators, backend developers

---

### [Scripts](./scripts/)
Automation scripts reference and usage.

**Contents:**
- Backup scripts (`backup-db.sh`, `backup-production.sh`)
- Restore scripts (`restore-db.sh`, `restore-production.sh`)
- Utility scripts (`list-backups.sh`)
- Script parameters and options
- Scheduling and automation

**Best for:** DevOps, automation, backup administration

---

### [Architecture](./architecture/)
System design, architecture diagrams, and technical decisions.

**Contents:**
- System architecture overview
- Scraper system design (in-process vs microservice)
- White-label system architecture
- Database design
- Observability stack

**Best for:** Understanding system design, architectural decisions

---

## Quick Reference

### API Endpoints
- `POST /api/auth/login` - Authentication
- `GET /api/cinemas` - List cinemas
- `POST /api/scraper/start` - Start scraping
- `GET /api/reports/showtimes` - Showtimes report
- `GET /api/settings` - Public settings

→ [Full API Reference](./api/)

### Database Tables
- `cinemas` - Cinema locations
- `films` - Movie information
- `showtimes` - Screening schedules
- `scrape_sessions` - Scrape tracking
- `users` - User accounts
- `app_settings` - Application configuration

→ [Full Schema](./database/schema.md)

---

[← Back to Documentation](../README.md)
