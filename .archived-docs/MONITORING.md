# Monitoring Stack

This document describes the observability stack shipped with Allo-Scrapper.

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

---

## Grafana Dashboards

Dashboards are automatically provisioned from `docker/grafana/dashboards/`.

| Dashboard | UID | Description |
|---|---|---|
| **Scraper Performance** | `scraper-perf` | Job rate, duration histograms (p50/p95/p99), films & showtimes scraped |
| **Infrastructure** | `infra` | PostgreSQL connections/transactions, Redis memory/ops/queue depth, Node.js heap |
| **Application (API & Logs)** | `app` | HTTP request rate, error rate, response latency, structured logs |

Navigate to `http://localhost:3001` → **Dashboards** → **Allo-Scrapper** folder.

---

## Metrics Reference

### Scraper microservice (`ics-scraper`, port 9091)

| Metric | Type | Labels | Description |
|---|---|---|---|
| `scrape_jobs_total` | Counter | `status` (success/failed), `trigger_type` | Total scrape jobs processed |
| `scrape_duration_seconds` | Histogram | `cinema_id` | Time to scrape a single cinema |
| `films_scraped_total` | Counter | — | Total films written to DB |
| `showtimes_scraped_total` | Counter | — | Total showtimes written to DB |

### Backend API (`ics-web`, port 3000)

Default Node.js process metrics exposed at `/metrics` via `prom-client`.

---

## Logging

Both `ics-web` and `ics-scraper` emit **structured JSON logs** in production (colorised plain text in development).

```jsonc
// Example log line
{
  "level": "info",
  "message": "Scrape completed",
  "service": "ics-scraper",
  "timestamp": "2026-02-20T18:00:00.000Z"
}
```

Log level is controlled via the `LOG_LEVEL` environment variable (default: `info`).  
Promtail ships all `ics-*` container stdout/stderr to Loki automatically.

---

## Distributed Tracing

Set `OTEL_ENABLED=true` to enable OpenTelemetry tracing.  
Traces are exported via OTLP gRPC to Tempo (`OTEL_EXPORTER_OTLP_ENDPOINT`, default `http://ics-tempo:4317`).

```bash
# .env
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://ics-tempo:4317
```

In Grafana, open the **Tempo** datasource explorer or use trace IDs that appear in Loki log lines to jump directly to a trace.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `LOG_LEVEL` | `info` | Log verbosity (`error`, `warn`, `info`, `debug`) |
| `OTEL_ENABLED` | `false` | Enable OpenTelemetry tracing |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://ics-tempo:4317` | OTLP gRPC endpoint |
| `GRAFANA_ADMIN_USER` | `admin` | Grafana admin username |
| `GRAFANA_ADMIN_PASSWORD` | `admin` | Grafana admin password |

---

## Adding a New Dashboard

1. Create or export a Grafana dashboard JSON.
2. Save it to `docker/grafana/dashboards/<name>.json`.
3. Grafana polls the directory every 30 s and picks it up automatically (no restart needed).

---

## Troubleshooting

**Grafana shows "No data" on Prometheus panels**  
→ Verify Prometheus is running: `curl http://localhost:9090/-/healthy`  
→ Check targets: `http://localhost:9090/targets`

**Logs not appearing in Loki**  
→ Check Promtail: `docker compose logs ics-promtail`  
→ Verify Docker socket is mounted (Promtail needs `/var/run/docker.sock`)

**Traces not arriving in Tempo**  
→ Ensure `OTEL_ENABLED=true` is set in the service's environment  
→ Check Tempo is healthy: `curl http://localhost:3200/ready`
