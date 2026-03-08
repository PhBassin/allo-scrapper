# Database Reference

PostgreSQL database schema, migrations, and query reference.

## 📑 Contents

### [Schema](./schema.md)
Complete database schema documentation.

**What you'll learn:**
- Table definitions
- Column types and constraints
- Indexes
- Foreign key relationships
- Default values
- Triggers and functions

**Tables:**
- `cinemas` - Cinema locations and metadata
- `films` - Movie information
- `showtimes` - Screening schedules
- `scrape_sessions` - Scrape job tracking
- `users` - User accounts and authentication
- `app_settings` - Application configuration (singleton)

**Best for:** Understanding data model, writing queries

---

### [Migrations](./migrations.md)
Database migration system and history.

**What you'll learn:**
- Migration workflow
- Migration files structure
- Running migrations
- Rolling back migrations
- Creating new migrations
- Migration best practices

**Migration Files:**
- `001_initial_schema.sql` - Core tables (cinemas, films, showtimes)
- `002_scrape_sessions.sql` - Scrape tracking
- `003_users.sql` - Authentication and authorization
- `004_app_settings.sql` - White-label settings
- `005_add_user_role.sql` - Role-based access control

**Best for:** Database changes, version control

---

## Quick Reference

### Connection Details
```bash
# Development
Host: localhost
Port: 5432
Database: ics
Username: postgres
Password: postgres

# Docker
Host: ics-db
Port: 5432
Database: ics
Username: postgres
Password: postgres
```

### Common Queries

**Get all cinemas with showtimes:**
```sql
SELECT c.name, COUNT(s.id) as showtime_count
FROM cinemas c
LEFT JOIN showtimes s ON c.id = s.cinema_id
GROUP BY c.id, c.name;
```

**Get recent films:**
```sql
SELECT DISTINCT f.title, f.director, COUNT(s.id) as showtime_count
FROM films f
JOIN showtimes s ON f.id = s.film_id
WHERE s.date >= CURRENT_DATE
GROUP BY f.id, f.title, f.director
ORDER BY showtime_count DESC;
```

**Get scrape history:**
```sql
SELECT session_id, status, started_at, completed_at,
       total_cinemas, completed_cinemas, failed_cinemas
FROM scrape_sessions
ORDER BY started_at DESC
LIMIT 10;
```

### Backup Commands

**Create backup:**
```bash
./scripts/backup-db.sh
```

**Restore backup:**
```bash
./scripts/restore-db.sh /path/to/backup.sql
```

→ [Full Backup Guide](../../guides/deployment/backup-restore.md)

---

## Related Documentation

- [Backup & Restore Guide](../../guides/deployment/backup-restore.md) - Backup workflows
- [Database Troubleshooting](../../troubleshooting/database.md) - Common issues
- [Scripts Reference](../scripts/) - Database scripts

---

[← Back to Reference](../README.md)
