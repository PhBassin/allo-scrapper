# Troubleshooting

Solutions to common issues and debugging guides for Allo-Scrapper.

## 📑 Common Issues

### [Common Issues](./common-issues.md)
Frequently encountered problems and quick fixes.

**What you'll learn:**
- Port conflicts
- Permission errors
- Service startup failures
- Authentication issues
- Configuration errors
- Quick diagnostics

**Best for:** First troubleshooting step, common problems

---

### [Database Issues](./database.md)
PostgreSQL troubleshooting and debugging.

**What you'll learn:**
- Connection failures
- Migration errors
- Performance issues
- Backup/restore failures
- Data inconsistencies
- Query optimization

**Common Errors:**
- `ECONNREFUSED` - Database not accessible
- `FATAL: password authentication failed` - Credential mismatch
- `relation does not exist` - Missing migrations
- Slow queries and indexing

**Best for:** Database connectivity, migration problems, performance tuning

---

### [Docker Issues](./docker.md)
Container and Docker Compose troubleshooting.

**What you'll learn:**
- Container startup failures
- Volume mounting issues
- Network connectivity problems
- Build failures
- Resource constraints
- Profile configuration

**Common Issues:**
- Services not starting
- Port binding conflicts
- Volume permission errors
- Out of memory errors
- Image build failures

**Best for:** Docker deployment, container debugging

---

### [Networking Issues](./networking.md)
Network configuration and SSL troubleshooting.

**What you'll learn:**
- Reverse proxy configuration
- SSL certificate errors
- CORS problems
- WebSocket/SSE connection failures
- Port forwarding issues
- DNS resolution

**Common Issues:**
- `ERR_CONNECTION_REFUSED` - Service unreachable
- `Mixed Content` warnings - HTTP/HTTPS mismatch
- CORS policy errors
- SSL handshake failures

**Best for:** Public deployments, SSL setup, connectivity issues

---

### [Scraper Issues](./scraper.md)
Scraping failures and debugging.

**What you'll learn:**
- Scrape failures (404, timeouts)
- Parser errors
- HTML structure changes
- Rate limiting
- Progress tracking issues
- Microservice mode problems

**Common Issues:**
- Cinema pages not found (404)
- Timeout errors
- Parsing failures (HTML changes)
- No showtimes found
- Scrape stuck/hanging

**Best for:** Scraping problems, parser debugging, data quality issues

---

## Debugging Tools

### Check Service Health
```bash
# All services
docker compose ps

# Logs for specific service
docker compose logs ics-web
docker compose logs ics-db

# Follow logs
docker compose logs -f ics-web
```

### Database Access
```bash
# Connect to database
docker compose exec ics-db psql -U postgres -d ics

# Check tables
\dt

# Check connections
SELECT * FROM pg_stat_activity;
```

### API Testing
```bash
# Health check
curl http://localhost:3000/api/health

# Check authentication
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'
```

### Scraper Debugging
```bash
# Check scraper status
curl http://localhost:3000/api/scraper/status

# View progress (SSE stream)
curl -N http://localhost:3000/api/scraper/progress
```

---

## Getting Help

If you can't find a solution here:

1. **Check logs**: `docker compose logs <service>`
2. **Search issues**: [GitHub Issues](https://github.com/yourusername/allo-scrapper/issues)
3. **Create issue**: Use the bug report template
4. **Community**: [GitHub Discussions](https://github.com/yourusername/allo-scrapper/discussions)

---

## Related Documentation

- [Production Deployment](../guides/deployment/production.md) - Production setup
- [Docker Setup](../guides/deployment/docker.md) - Docker configuration
- [Monitoring](../guides/deployment/monitoring.md) - Observability tools
- [Database Reference](../reference/database/) - Database documentation

---

[← Back to Documentation](../README.md)
