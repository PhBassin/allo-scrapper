# Monitoring & Observability

Complete guide to the observability stack shipped with Allo-Scrapper.

**Related Guides:**
- [Production Deployment](./production.md) - Production setup
- [Docker Setup](./docker.md) - Container management
- [Networking](./networking.md) - LAN access and CORS

---

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Starting and Stopping](#starting-and-stopping)
- [Grafana Dashboards](#grafana-dashboards)
- [Metrics Reference](#metrics-reference)
- [Logging](#logging)
- [Distributed Tracing](#distributed-tracing)
- [Environment Variables](#environment-variables)
- [Adding Dashboards](#adding-dashboards)
- [Troubleshooting](#troubleshooting)

---

## Overview

| Tool | Role | Port |
|---|---|---|
| **Prometheus** | Metrics scraping & storage | 9090 |
| **Grafana** | Dashboards (metrics + logs + traces) | 3001 |
| **Loki** | Log aggregation | 3100 |
| **Promtail** | Log shipper (Docker → Loki) | — |
| **Tempo** | Distributed tracing (OTLP) | 3200 / 4317 |
| **postgres-exporter** | PostgreSQL → Prometheus | — |
| **redis-exporter** | Redis → Prometheus | — |

All monitoring services run under the `monitoring` Docker Compose profile.

---

## Quick Start

```bash
# Start monitoring alongside the main app
docker compose --profile monitoring up -d

# Open Grafana
open http://localhost:3001   # user: admin / password: admin
```

**Default credentials:**
- Username: `admin`
- Password: `admin` (you will be prompted to change on first login)

---

## Starting and Stopping

```bash
# Start only monitoring (assumes ics-db, ics-redis, ics-web are already up)
docker compose --profile monitoring up -d

# Start everything (app + scraper + monitoring)
docker compose --profile monitoring --profile scraper up -d

# Stop monitoring only
docker compose --profile monitoring down

# Stop everything
docker compose --profile monitoring --profile scraper down
```

**Note:** The monitoring stack requires the base application services (ics-db, ics-redis, ics-web) to be running.

---

## Grafana Dashboards

Dashboards are automatically provisioned from `docker/grafana/dashboards/`.

| Dashboard | UID | Description |
|---|---|---|
| **Scraper Performance** | `scraper-perf` | Job rate, duration histograms (p50/p95/p99), films & showtimes scraped |
| **Infrastructure** | `infra` | PostgreSQL connections/transactions, Redis memory/ops/queue depth, Node.js heap |
| **Application (API & Logs)** | `app` | HTTP request rate, error rate, response latency, structured logs |

**Access dashboards:**
1. Open Grafana: `http://localhost:3001`
2. Navigate to **Dashboards** → **Allo-Scrapper** folder
3. Select a dashboard

**Dashboard features:**
- Real-time metrics with auto-refresh
- Time range selection (Last 5m, 1h, 24h, etc.)
- Variable filters (by cinema, endpoint, etc.)
- Direct links to traces from logs

---

## Metrics Reference

### Scraper Microservice (`ics-scraper`, port 9091)

| Metric | Type | Labels | Description |
|---|---|---|---|
| `scrape_jobs_total` | Counter | `status` (success/failed), `trigger_type` | Total scrape jobs processed |
| `scrape_duration_seconds` | Histogram | `cinema_id` | Time to scrape a single cinema |
| `films_scraped_total` | Counter | — | Total films written to DB |
| `showtimes_scraped_total` | Counter | — | Total showtimes written to DB |

**Example queries:**
```promql
# Scrape success rate (last 5m)
rate(scrape_jobs_total{status="success"}[5m])

# P95 scrape duration by cinema
histogram_quantile(0.95, rate(scrape_duration_seconds_bucket[5m]))

# Total films scraped today
increase(films_scraped_total[24h])
```

---

### Backend API (`ics-web`, port 3000)

Default Node.js process metrics exposed at `/metrics` via `prom-client`.

**Key metrics:**
- `nodejs_heap_size_total_bytes` - Total heap size
- `nodejs_heap_size_used_bytes` - Used heap size
- `nodejs_external_memory_bytes` - External memory
- `process_cpu_user_seconds_total` - CPU usage
- `process_resident_memory_bytes` - Resident memory

**Example queries:**
```promql
# Heap usage percentage
100 * nodejs_heap_size_used_bytes / nodejs_heap_size_total_bytes

# Memory usage trend
rate(process_resident_memory_bytes[5m])
```

---

## Logging

Both `ics-web` and `ics-scraper` emit **structured JSON logs** in production (colorised plain text in development).

**Example log line:**
```json
{
  "level": "info",
  "message": "Scrape completed",
  "service": "ics-scraper",
  "timestamp": "2026-02-20T18:00:00.000Z",
  "cinema_id": "C0053",
  "duration_ms": 1234,
  "films_count": 15,
  "showtimes_count": 87
}
```

**Log levels:**
- `error` - Errors that need attention
- `warn` - Warnings and unexpected conditions
- `info` - General informational messages
- `debug` - Detailed debugging information

**Viewing logs in Grafana:**
1. Open Grafana: `http://localhost:3001`
2. Navigate to **Explore**
3. Select **Loki** datasource
4. Use LogQL queries:

```logql
# All logs from scraper
{container_name="ics-scraper"}

# Error logs from web service
{container_name="ics-web"} |= "error"

# Logs for specific cinema
{container_name="ics-scraper"} | json | cinema_id="C0053"

# Scrape duration > 5 seconds
{container_name="ics-scraper"} | json | duration_ms > 5000
```

**Log shipping:**
- Promtail ships all `ics-*` container stdout/stderr to Loki automatically
- No application changes needed - just write to stdout/stderr
- Logs are automatically labeled with container name, service, etc.

---

## Distributed Tracing

Set `OTEL_ENABLED=true` to enable OpenTelemetry tracing.  
Traces are exported via OTLP gRPC to Tempo (`OTEL_EXPORTER_OTLP_ENDPOINT`, default `http://ics-tempo:4317`).

**Enable tracing:**
```bash
# .env
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://ics-tempo:4317

# Restart services
docker compose restart ics-web ics-scraper
```

**Viewing traces in Grafana:**
1. Open Grafana: `http://localhost:3001`
2. Navigate to **Explore**
3. Select **Tempo** datasource
4. Search by:
   - Trace ID (from log lines)
   - Service name (`ics-scraper`, `ics-web`)
   - Tags (cinema_id, endpoint, etc.)

**Trace structure:**
- **Root span**: HTTP request or scrape job
- **Child spans**: Database queries, HTTP requests, parsing operations
- **Attributes**: cinema_id, film_count, duration, etc.

**Linking logs to traces:**
- Trace IDs appear in Loki log lines when `OTEL_ENABLED=true`
- Click trace ID in Grafana logs to jump directly to trace
- See full request flow across services

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `LOG_LEVEL` | `info` | Log verbosity (`error`, `warn`, `info`, `debug`) |
| `METRICS_PORT` | `9091` | Prometheus metrics port (scraper microservice only) |
| `OTEL_ENABLED` | `false` | Enable OpenTelemetry tracing |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://ics-tempo:4317` | OTLP gRPC endpoint |
| `GRAFANA_ADMIN_USER` | `admin` | Grafana admin username |
| `GRAFANA_ADMIN_PASSWORD` | `admin` | Grafana admin password |

**Update environment variables:**
```bash
# Edit .env
nano .env

# Restart services
docker compose restart ics-web ics-scraper
```

---

## Adding Dashboards

### Method 1: Automatic Provisioning (Recommended)

1. Create or export a Grafana dashboard JSON
2. Save it to `docker/grafana/dashboards/<name>.json`
3. Grafana polls the directory every 30 s and picks it up automatically (no restart needed)

**Example:**
```bash
# Download dashboard JSON
curl -o docker/grafana/dashboards/my-dashboard.json https://example.com/dashboard.json

# Wait 30 seconds or restart Grafana
docker compose restart ics-grafana
```

---

### Method 2: Manual Import

1. Open Grafana: `http://localhost:3001`
2. Navigate to **Dashboards** → **Import**
3. Upload JSON file or paste JSON
4. Select datasources (Prometheus, Loki, Tempo)
5. Click **Import**

**Note:** Manually imported dashboards are not persisted and will be lost on container restart. Use automatic provisioning for production.

---

## Troubleshooting

### Grafana shows "No data" on Prometheus panels

**Cause:** Prometheus is not scraping metrics

**Solution:**
```bash
# Verify Prometheus is running
curl http://localhost:9090/-/healthy

# Check targets (should show all services as UP)
open http://localhost:9090/targets

# Check Prometheus logs
docker compose logs ics-prometheus

# Restart Prometheus
docker compose restart ics-prometheus
```

---

### Logs not appearing in Loki

**Cause:** Promtail is not shipping logs

**Solution:**
```bash
# Check Promtail logs
docker compose logs ics-promtail

# Verify Docker socket is mounted
docker inspect ics-promtail | grep -A5 Mounts

# Verify Loki is running
curl http://localhost:3100/ready

# Restart Promtail
docker compose restart ics-promtail
```

**Note:** Promtail needs `/var/run/docker.sock` mounted to read container logs.

---

### Traces not arriving in Tempo

**Cause:** OpenTelemetry is not enabled or misconfigured

**Solution:**
```bash
# Ensure OTEL_ENABLED=true is set
cat .env | grep OTEL_ENABLED

# Verify Tempo is running
curl http://localhost:3200/ready

# Check Tempo logs
docker compose logs ics-tempo

# Verify OTLP endpoint is correct
cat .env | grep OTEL_EXPORTER_OTLP_ENDPOINT

# Restart services
docker compose restart ics-web ics-scraper
```

---

### Grafana admin password not working

**Cause:** Password was changed after first login

**Solution:**
```bash
# Reset admin password via Docker
docker compose exec ics-grafana grafana-cli admin reset-admin-password newpassword

# Or restart Grafana with fresh volume
docker compose down -v ics-grafana
docker compose up -d ics-grafana
```

---

### High memory usage by Prometheus

**Cause:** Prometheus retention period too long or too many metrics

**Solution:**
```bash
# Edit docker-compose.yml
# Add retention flags to prometheus command:
# --storage.tsdb.retention.time=7d
# --storage.tsdb.retention.size=5GB

# Restart Prometheus
docker compose restart ics-prometheus
```

---

### Missing metrics for PostgreSQL/Redis

**Cause:** Exporters not running

**Solution:**
```bash
# Check exporter status
docker compose ps ics-postgres-exporter ics-redis-exporter

# Check exporter logs
docker compose logs ics-postgres-exporter
docker compose logs ics-redis-exporter

# Verify Prometheus is scraping exporters
open http://localhost:9090/targets

# Restart exporters
docker compose restart ics-postgres-exporter ics-redis-exporter
```

---

## Configuration Files

### Prometheus Configuration

**Location:** `docker/prometheus.yml`

**Key sections:**
- `scrape_configs` - Define scrape targets (ics-web, ics-scraper, exporters)
- `global` - Scrape interval, evaluation interval
- `alerting` - Alert manager configuration (if enabled)

---

### Loki Configuration

**Location:** `docker/loki-config.yml`

**Key sections:**
- `schema_config` - Index and chunk schema
- `storage_config` - Local filesystem storage
- `limits_config` - Ingestion rate limits

---

### Promtail Configuration

**Location:** `docker/promtail-config.yml`

**Key sections:**
- `clients` - Loki endpoint
- `scrape_configs` - Docker container log scraping
- `pipeline_stages` - Log parsing and labeling

---

### Tempo Configuration

**Location:** `docker/tempo.yml`

**Key sections:**
- `distributor` - OTLP receiver configuration
- `ingester` - Trace ingestion
- `storage` - Local backend storage
- `compactor` - Trace compaction

---

### Grafana Datasources

**Location:** `docker/grafana/datasources/datasources.yml`

**Auto-provisioned datasources:**
- Prometheus (http://ics-prometheus:9090)
- Loki (http://ics-loki:3100)
- Tempo (http://ics-tempo:3200)

**Note:** All datasources are defined in a single YAML file and automatically configured on Grafana startup.

---

## Best Practices

### 1. Enable Monitoring in Production

Always run the monitoring stack in production:
```bash
docker compose --profile monitoring --profile scraper up -d
```

### 2. Set Appropriate Log Levels

- Production: `LOG_LEVEL=info`
- Debugging: `LOG_LEVEL=debug`
- High-traffic: `LOG_LEVEL=warn`

### 3. Configure Retention

Set appropriate retention for your disk space:
- Prometheus: 7-15 days (configurable)
- Loki: 7-30 days (configurable)
- Tempo: 7 days (configurable)

### 4. Monitor Resource Usage

Watch Grafana's **Infrastructure** dashboard for:
- PostgreSQL connection pool usage
- Redis memory usage
- Node.js heap usage
- Disk space

### 5. Set Up Alerts (Optional)

Configure Prometheus alerts for critical conditions:
- High error rate
- Long scrape duration
- Database connection failures
- High memory usage

---

## Related Documentation

- [Production Deployment](./production.md) - Complete production setup
- [Docker Setup](./docker.md) - Container management
- [Networking](./networking.md) - LAN access and CORS
- [../../reference/api/README.md](../../reference/api/README.md) - API metrics endpoints

---

[← Back to Deployment Guides](./README.md)
