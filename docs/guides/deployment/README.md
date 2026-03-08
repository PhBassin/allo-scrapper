# Deployment Guides

Step-by-step guides for deploying and maintaining Allo-Scrapper in production.

## 📑 Contents

### [Production Deployment](./production.md)
Complete guide to deploying Allo-Scrapper in a production environment.

**What you'll learn:**
- Production checklist
- Environment configuration
- Database setup
- SSL/TLS configuration
- Security hardening
- Performance tuning

**Best for:** First-time production deployment, production readiness review

---

### [Docker Setup](./docker.md)
Docker and Docker Compose configuration guide.

**What you'll learn:**
- Docker Compose profiles (base, scraper, monitoring)
- Container architecture
- Volume management
- Multi-container orchestration
- Resource limits

**Best for:** Understanding Docker architecture, container troubleshooting

---

### [Backup & Restore](./backup-restore.md)
Database backup and disaster recovery workflows.

**What you'll learn:**
- Automated backup scripts
- Manual backup procedures
- Restore workflows (development and production)
- Backup verification
- Retention policies

**Best for:** Setting up backup automation, disaster recovery planning

---

### [Monitoring](./monitoring.md)
Observability stack setup and configuration.

**What you'll learn:**
- Prometheus metrics
- Grafana dashboards
- Loki log aggregation
- Tempo distributed tracing
- Alert configuration

**Best for:** Production monitoring, performance analysis, debugging

---

### [Networking](./networking.md)
Network configuration, reverse proxy, and SSL setup.

**What you'll learn:**
- Nginx reverse proxy configuration
- SSL certificate setup (Let's Encrypt)
- Port mapping
- CORS configuration
- WebSocket and SSE configuration

**Best for:** Public-facing deployments, SSL setup, network troubleshooting

---

## Related Documentation

- [Docker Issues](../../troubleshooting/docker.md) - Troubleshooting Docker problems
- [Networking Issues](../../troubleshooting/networking.md) - Network and SSL issues
- [Scripts Reference](../../reference/scripts/) - Automation scripts documentation

---

[← Back to Documentation](../../README.md)
