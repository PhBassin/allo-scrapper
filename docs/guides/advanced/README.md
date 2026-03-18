# Advanced Guides

Comprehensive guides for production deployments, advanced features, and operational best practices.

**Last updated:** March 18, 2026

---

## Quick Navigator

Choose a guide based on your current challenge:

### 🔧 I want to...

| Goal | Guide | Read Time |
|------|-------|-----------|
| **Scale scraper to multiple instances** | [Production Scaling](./production-scaling.md) | 25 min |
| **Tune scraper for rate limiting / 429 errors** | [Rate Limiting Tuning](./scraper-rate-limiting.md) | 20 min |
| **Add support for a new cinema source** | [Custom Parser Development](./custom-parser-development.md) | 30 min |
| **Manage users, roles, and permissions** | [Admin Operations](./admin-operations.md) | 25 min |
| **Deploy to Kubernetes** | [Production Scaling - Kubernetes section](./production-scaling.md#kubernetes-scaling) | 10 min |
| **Set up monitoring and alerts** | [Production Scaling - Monitoring section](./production-scaling.md#monitoring--alerting) | 15 min |

---

## Guide Summaries

### 1. Production Scaling: Redis Queue Management & Job Orchestration

**When to read**: After deploying a working instance, ready to scale.

**Topics covered**:
- **RUN_MODE Architecture** – Choose between oneshot (Kubernetes Jobs), consumer (Deployment), cron (Scheduled), or direct (local dev)
- **Queue Management** – Redis FIFO structure, queue depth monitoring, backpressure handling
- **Multi-Instance Deployment** – Docker Compose scaling, Kubernetes Deployments with HPA, auto-scaling based on queue depth
- **Job Orchestration** – Job types (scrape, add_cinema), job lifecycle, retry strategies
- **Monitoring & Alerting** – Key metrics (queue depth, success rate, duration), Prometheus queries, Grafana dashboards, alert rules
- **Performance Optimization** – Rate limiting tuning, database connection pooling, Redis optimization
- **Troubleshooting** – Queue growing, slow processing, memory leaks, Redis connection errors

**Key Takeaways**:
- `RUN_MODE=consumer` recommended for continuous background scraping
- Scale scraper instances based on queue depth (target 10 jobs per replica)
- Monitor job success rate and alert on > 50% failures
- Graceful shutdown required for multi-instance deployments
- Increase rate-limiting delays if 429 errors occur

**Read time**: ~25 minutes

---

### 2. Scraper Configuration & Rate Limiting Tuning

**When to read**: After first deployment, if experiencing 429/403 rate limiting errors.

**Topics covered**:
- **Rate Limiting Fundamentals** – AlloCiné detection mechanisms, why 429/403 happen, safe practices
- **Delay Configuration** – Theater delay, movie delay, movie list delay settings with safe ranges
- **Troubleshooting 429/403 Errors** – Decision tree: increase delays, add proxies, switch IP addresses, parallel vs sequential scraping
- **Performance Benchmarking** – How to measure throughput, identify bottlenecks
- **Timeout Settings** – Connection timeout, read timeout, retry strategies
- **Monitoring** – Track rate limit errors, detect patterns, proactive adjustment
- **Production Optimization** – Multi-instance scaling to process more cinemas in parallel
- **Advanced Techniques** – Rotating delays, circuit breakers, fallback strategies

**Key Takeaways**:
- Start with `SCRAPE_THEATER_DELAY_MS=3000`, `SCRAPE_MOVIE_DELAY_MS=500` (safe defaults)
- Increase delays if 429 errors spike (reduce to 5000/1000 for safety)
- Decrease delays if no 429 errors (reduce to 2000/300 for faster throughput)
- Monitor 429 error rate in Prometheus
- Use multiple scraper instances instead of reducing delays too far
- Circuit breaker: if 429 rate > 5%, exponentially back off

**Read time**: ~20 minutes

---

### 3. Custom Parser Development & Multi-Source Integration

**When to read**: Adding support for cinema sources beyond AlloCiné (e.g., UGC, Pathé, custom APIs).

**Topics covered**:
- **Strategy Pattern Architecture** – Why Strategy Pattern, IScraperStrategy interface, pluggable scrapers
- **Step-by-Step Development** – Create custom strategy class, implement parsing logic, write unit tests
- **HTML Parsing with Cheerio** – Selectors, DOM traversal, data extraction, error handling
- **Test Fixtures** – Real HTML from target website, fixture file management, isolated unit tests
- **Handling Parser Fragility** – Website redesigns break parsing, mitigation strategies, graceful fallbacks
- **Advanced Patterns** – Fallback chains (try A then B), result caching, batch processing
- **Testing & Validation** – Unit tests with fixtures, integration tests, regression tests for website changes

**Key Takeaways**:
- Each cinema source = new strategy implementation
- Use fixtures from actual HTML to ensure reliability
- Error handling essential (websites change frequently)
- Fallback chains reduce failures when parsing fails
- Start with single cinema, then scale to network

**Read time**: ~30 minutes

---

### 4. Advanced RBAC & Admin Operations

**When to read**: Setting up multi-team organization, custom role management, or disaster recovery.

**Topics covered**:
- **RBAC Design Patterns** – Multi-team orgs, role hierarchies, attribute-based access (ABAC) simulation
- **Custom Role Templates** – Content Manager, Analyst, System Engineer, Restricted Operator roles with SQL templates
- **Permission Delegation Models** – Delegate-all (trust), approval workflows, time-limited roles
- **Theme Management Workflows** – Multi-stage branding updates, font imports with validation
- **Disaster Recovery** – Recover from locked-out admins, permission corruption, accidental changes
- **Audit & Compliance** – Audit logging, compliance reports, tracking all admin actions
- **Troubleshooting** – Permission access issues, JWT caching, permission change recovery

**Key Takeaways**:
- Use system roles (admin, operator) as baselines for custom roles
- Implement approval workflows for production escalations
- Enable audit logging from day one
- Test permission changes in staging before production
- Users must re-login after permission changes (JWT expires)
- Always backup before importing settings

**Read time**: ~25 minutes

---

## Reading Paths by Role

### Site Reliability Engineer / DevOps
1. [Production Scaling](./production-scaling.md) – Master queue, orchestration, monitoring
2. [Monitoring & Alerting](./production-scaling.md#monitoring--alerting) – Set up observability
3. [Admin Operations - Disaster Recovery](./admin-operations.md#disaster-recovery) – Emergency procedures

**Time commitment**: ~45 minutes

### Content/Cinema Manager
1. [Custom Parser Development](./custom-parser-development.md) – Add new cinema sources
2. [Scraper Rate Limiting](./scraper-rate-limiting.md) – Troubleshoot 429 errors
3. [Production Scaling - Job Orchestration](./production-scaling.md#job-orchestration) – Understand job types

**Time commitment**: ~60 minutes

### System Administrator / Security Officer
1. [Admin Operations](./admin-operations.md) – Complete RBAC guide
2. [Admin Operations - Audit & Compliance](./admin-operations.md#audit--compliance) – Set up audit trails
3. [Production Scaling - Monitoring](./production-scaling.md#monitoring--alerting) – Health checks & alerts

**Time commitment**: ~55 minutes

### Software Engineer (Adding Features)
1. [Custom Parser Development](./custom-parser-development.md) – Understand extensibility
2. [Production Scaling - Job Orchestration](./production-scaling.md#job-orchestration) – Job lifecycle
3. [Admin Operations - RBAC Design Patterns](./admin-operations.md#rbac-design-patterns) – Permission modeling

**Time commitment**: ~70 minutes

---

## Related Documentation

- **[Getting Started](../getting-started/)** – Initial setup and deployment
- **[Deployment Guides](../deployment/)** – Docker, Kubernetes, monitoring
- **[Reference Docs](../../reference/)** – Complete API reference, schema details
- **[Troubleshooting](../../troubleshooting/)** – Common issues and solutions
- **[Architecture](../../reference/architecture/)** – System design and components

---

## FAQ

**Q: Should I use oneshot or consumer mode?**
A: Use `consumer` mode for continuous background scraping. Use `oneshot` only for Kubernetes Jobs where you want one container per job.

**Q: How many scraper instances do I need?**
A: Start with 1-2, monitor queue depth. Add instances when queue consistently > 20 jobs. Target 10 jobs per replica.

**Q: How do I add a new cinema source?**
A: Follow [Custom Parser Development](./custom-parser-development.md). You'll implement a new `IScraperStrategy` class and write unit tests.

**Q: What if users can't access the admin panel?**
A: See [Admin Operations - Troubleshooting](./admin-operations.md#troubleshooting). Usually a role/permission issue or expired JWT.

**Q: How do I prevent 429 rate limiting errors?**
A: Read [Rate Limiting Tuning](./scraper-rate-limiting.md). Increase delays, use multiple instances, or add rotating proxy support.

**Q: Can I recover from a database backup?**
A: Yes. See [Disaster Recovery](./admin-operations.md#disaster-recovery) for restore procedures.

---

## Contributing

Found an issue or have a suggestion? Open a GitHub issue with the `documentation` label:
- [Report a bug](https://github.com/phbassin/allo-scrapper/issues/new?labels=bug)
- [Request a feature](https://github.com/phbassin/allo-scrapper/issues/new?labels=enhancement)
- [Improve docs](https://github.com/phbassin/allo-scrapper/issues/new?labels=documentation)

---

## Version History

| Version | Changes |
|---------|---------|
| **Latest** | 4 advanced guides added: Production Scaling, Rate Limiting, Custom Parsers, Admin Operations |
| **v2.1.0** | Original advanced guides introduced (minimal coverage) |

Last updated: **March 18, 2026**
