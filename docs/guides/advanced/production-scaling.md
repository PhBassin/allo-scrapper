# Production Scaling: Redis Queue Management & Job Orchestration

Deploy Allo-Scrapper at scale with multi-instance job processing, queue management, and architectural patterns for large cinema networks.

**Last updated:** March 18, 2026

---

## Table of Contents

- [Overview](#overview)
- [RUN_MODE Architecture](#run_mode-architecture)
- [Queue Management](#queue-management)
- [Multi-Instance Deployment](#multi-instance-deployment)
- [Job Orchestration](#job-orchestration)
- [Monitoring & Alerting](#monitoring--alerting)
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)

---

## Overview

Allo-Scrapper uses a **microservice architecture** where scraping work is decoupled from the web API via a Redis job queue. The scraper microservice processes jobs asynchronously, allowing you to scale both the API and scraper independently.

### Key Concepts

- **Job Queue**: Redis-backed task queue for scraping requests
- **RUN_MODE**: Controls how the scraper processes jobs (oneshot, consumer, cron, direct)
- **Multi-Instance**: Run multiple scraper instances to process jobs in parallel
- **Graceful Shutdown**: Safe cleanup when scaling down
- **Metrics**: Prometheus metrics for queue depth, job success rate, and duration

---

## RUN_MODE Architecture

The scraper's behavior is determined by the `RUN_MODE` environment variable. Choose the right mode for your deployment scenario.

### Mode Comparison Matrix

| Mode | Use Case | Startup | Shutdown | Scaling | Queue | Cost |
|------|----------|---------|----------|---------|-------|------|
| **oneshot** | Kubernetes Jobs, batch jobs | Fast | Immediate | Per-request | LPOP | Low (one job per container) |
| **consumer** | Kubernetes Deployment, Docker Compose | Fast | Graceful | Replicas | BLPOP | Medium (persistent containers) |
| **cron** | Scheduled tasks, nightly refresh | Medium | Graceful | Single | No | Low (single instance) |
| **direct** | Local dev, manual testing | Instant | Immediate | N/A | No | N/A |

### Mode Details

#### Oneshot Mode (Default)

**Config:**
```yaml
environment:
  RUN_MODE: oneshot
```

**Behavior:**
- Container starts, pops ONE job from `scrape:jobs` queue using LPOP
- Executes the job
- Exits (container stops)
- No graceful shutdown needed

**When to Use:**
- Kubernetes Jobs (one container per job)
- AWS ECS Task runs
- Spot instance fleets where rapid startup/shutdown is expected
- Low-frequency scraping with bursty demand

**Advantages:**
- Simple orchestration (no persistent state)
- Easy to scale (add job requests → container orchestrator adds containers)
- Cost-effective (containers only run when jobs exist)
- Ideal for stateless cloud environments

**Disadvantages:**
- Container startup overhead (~2-3 seconds)
- Inefficient if queue is frequently empty
- Not ideal for continuous background scraping

**Example Kubernetes Job:**
```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: scraper-oneshot-{{ .Values.jobId }}
spec:
  parallelism: 1
  completions: 1
  template:
    spec:
      containers:
      - name: scraper
        image: ghcr.io/phbassin/allo-scrapper-scraper:{{ .Values.imageTag }}
        env:
        - name: RUN_MODE
          value: "oneshot"
        - name: REDIS_URL
          value: "redis://redis:6379"
      restartPolicy: Never
  backoffLimit: 2
```

#### Consumer Mode (Recommended for Long-Running)

**Config:**
```yaml
services:
  ics-scraper:
    environment:
      RUN_MODE: consumer
    # Can scale with replicas:
    # docker compose up -d --scale ics-scraper=3
```

**Behavior:**
- Container starts and enters long-running loop
- Continuously polls Redis queue using BLPOP (blocking, 0 timeout)
- Processes jobs as they arrive
- On SIGTERM/SIGINT: stops accepting new jobs, waits for in-flight jobs, exits gracefully
- Container stays alive waiting for next job

**When to Use:**
- Docker Compose deployments
- Kubernetes Deployments with fixed replicas
- Dedicated cluster nodes for scraping
- Continuous background scraping with steady stream of jobs

**Advantages:**
- No startup overhead per job
- Efficient resource utilization (one container processes many jobs)
- Graceful shutdown (waits for in-flight jobs before exiting)
- Predictable scaling (add 1 replica = +33% throughput)

**Disadvantages:**
- Persistent container memory usage (even when idle)
- Requires graceful shutdown handling (orchestrator must send SIGTERM)
- More complex troubleshooting

**Graceful Shutdown Implementation:**

```typescript
// From scraper/src/index.ts (simplified)
async function runConsumer(): Promise<void> {
  logger.info('[scraper] Mode: consumer (long-running)');
  const consumer = getRedisConsumer();

  // Stop accepting new jobs on termination signal
  process.on('SIGTERM', async () => {
    logger.info('[scraper] SIGTERM received, shutting down...');
    consumer.stop(); // No more BLPOP calls
    // Wait for current job to complete (configurable timeout)
    await disconnectRedis();
    await db.end();
    process.exit(0);
  });

  // Start processing jobs from queue
  await consumer.start(async (job) => {
    await executeJob(job);
  });
}
```

**Kubernetes Deployment:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: allo-scrapper-scraper
spec:
  replicas: 3  # 3 concurrent job processors
  selector:
    matchLabels:
      app: allo-scrapper-scraper
  template:
    metadata:
      labels:
        app: allo-scrapper-scraper
    spec:
      containers:
      - name: scraper
        image: ghcr.io/phbassin/allo-scrapper-scraper:stable
        env:
        - name: RUN_MODE
          value: "consumer"
        - name: REDIS_URL
          value: "redis://redis:6379"
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 15"]  # Grace period for in-flight jobs
        livenessProbe:
          exec:
            command: ["ps", "aux"]  # Simple liveness check
          initialDelaySeconds: 30
          periodSeconds: 30
```

**Docker Compose Scale:**
```bash
# Start with 3 replicas
docker compose up -d --scale ics-scraper=3

# View all instances
docker compose ps

# Scale to 5 instances
docker compose up -d --scale ics-scraper=5

# Scale down to 1
docker compose up -d --scale ics-scraper=1
```

#### Cron Mode (Scheduled Runs)

**Config:**
```yaml
environment:
  RUN_MODE: cron
  CRON_SCHEDULE: "0 8 * * 3"  # Every Wednesday at 8 AM
```

**Behavior:**
- Container starts and loads cron schedules from database
- Watches for schedule changes via Redis pub/sub
- Executes scraper on schedule (e.g., daily, weekly)
- Can trigger ad-hoc scrapes from admin panel
- Runs single-instance (no scaling needed)

**When to Use:**
- Scheduled nightly/weekly full scrapes
- Fixed refresh intervals
- Predictable resource usage patterns
- Single persistent scraper with dynamic schedule management

**Cron Expression Examples:**
```
"0 8 * * *"         # Every day at 8 AM
"0 8 * * 3"         # Every Wednesday at 8 AM (from docker-compose.yml default)
"0 0,6,12,18 * * *" # Every 6 hours
"*/30 * * * *"      # Every 30 minutes
```

**Database-Driven Scheduling:**

Schedules are stored in the database and can be managed via the admin panel. The scraper watches for changes and updates its active cron tasks dynamically:

```sql
-- View active schedules
SELECT id, name, cron_expression, enabled, last_run_status
FROM scraper_schedules
WHERE enabled = true
ORDER BY name;

-- Create a new schedule
INSERT INTO scraper_schedules (name, cron_expression, enabled)
VALUES ('Weekly Full Scrape', '0 8 * * 1', true);  -- Monday 8 AM

-- Disable a schedule
UPDATE scraper_schedules SET enabled = false WHERE id = 5;
```

**Admin Panel Integration:**

From the admin panel, you can:
1. Create new schedules with custom cron expressions
2. Enable/disable schedules without restarting
3. View last run status and timing
4. Manually trigger an immediate scrape

Changes are pushed to the scraper via Redis pub/sub in real-time—no restart required.

#### Direct Mode (Development Only)

**Config:**
```bash
export RUN_MODE=direct
npm run start:scraper
```

**Behavior:**
- Runs scraper immediately once
- Exits after completion
- No queue interaction
- Used for local testing and manual debugging

---

## Queue Management

### Queue Structure

Allo-Scrapper uses a single Redis list for job queueing:

```
Key: scrape:jobs
Type: List (Redis FIFO queue)
```

**Queue Operations:**

```bash
# Check queue depth
redis-cli LLEN scrape:jobs

# View pending jobs (first 10)
redis-cli LRANGE scrape:jobs 0 9

# View all jobs (large queues may timeout)
redis-cli LRANGE scrape:jobs 0 -1

# Clear entire queue (dangerous!)
redis-cli DEL scrape:jobs
```

### Job Structure

Each job in the queue is a JSON object:

```json
{
  "reportId": 42,
  "type": "scrape",
  "triggerType": "manual",
  "options": {
    "mode": "from_today_limited",
    "days": 7
  }
}
```

**Job Fields:**
- `reportId`: Reference to scrape_reports table (tracks progress)
- `type`: "scrape" or "add_cinema"
- `triggerType`: "manual", "cron", "api"
- `options`: Scraper configuration (mode, days, etc.)

### Queue Depth Monitoring

**Check current queue depth:**
```bash
# From Redis CLI
redis-cli LLEN scrape:jobs

# From metrics endpoint
curl http://localhost:9091/metrics | grep scraper_jobs

# Expected output
scraper_jobs_pending{instance="scraper-1"} 12
scraper_jobs_processing 1
```

### Backpressure Handling

If the queue grows faster than your scraper can process, implement backpressure strategies:

#### Strategy 1: Queue Depth Alerts

Set up Prometheus alert when queue depth exceeds threshold:

```yaml
# In docker/prometheus.yml or Grafana alert rules
alert: ScrapeQueueBacklog
expr: redis_llen{key="scrape:jobs"} > 50
for: 5m
annotations:
  summary: "Scrape queue backlog detected ({{ $value }} jobs)"
  description: "Queue has {{ $value }} jobs. Consider scaling up scraper replicas."
```

#### Strategy 2: Auto-Scale Scraper Instances

For Kubernetes, create a Horizontal Pod Autoscaler based on queue depth:

```yaml
apiVersion: autoscaling.custom.io/v1
kind: CustomMetricAutoscaler
metadata:
  name: scraper-queue-autoscaler
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: allo-scrapper-scraper
  minReplicas: 1
  maxReplicas: 10
  metrics:
  - type: External
    external:
      metric:
        name: redis_scrape_queue_depth
      targetValue: "10"  # Target 10 jobs per replica
```

#### Strategy 3: Request Rate Limiting (API)

Limit how many scrape jobs the API can enqueue per minute:

```typescript
// server/src/routes/scraper.ts (conceptual)
const scrapeRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,             // Max 10 scrape requests per minute
  keyGenerator: (req) => req.user.id,
  handler: (req, res) =>
    res.status(429).json({ error: 'Too many scrape requests' })
});

router.post('/scraper/trigger', scrapeRateLimiter, async (req, res) => {
  // ... create job and add to queue ...
});
```

### Queue Cleanup

**Remove failed jobs after timeout:**

```typescript
// Cleanup stale jobs older than 24 hours
async function cleanupStaleJobs(): Promise<void> {
  const scrapeReports = await db.query(
    `SELECT id FROM scrape_reports
     WHERE status = 'pending' AND created_at < NOW() - INTERVAL '24 hours'`
  );

  for (const report of scrapeReports.rows) {
    await db.query(
      `UPDATE scrape_reports SET status = 'failed', 
       errors = '[{"cinema_name":"System","error":"Job timeout after 24 hours"}]'
       WHERE id = $1`,
      [report.id]
    );
  }

  logger.info(`Cleaned up ${scrapeReports.rows.length} stale jobs`);
}

// Run daily at 3 AM
const cleanupCron = cron.schedule('0 3 * * *', cleanupJobs);
```

---

## Multi-Instance Deployment

### Docker Compose Scaling

Scale the consumer mode scraper to 3 instances:

```bash
# Start entire stack with 3 scraper replicas
docker compose up -d --scale ics-scraper=3

# View running instances
docker compose ps | grep ics-scraper
# ics-scraper-1  |  Running
# ics-scraper-2  |  Running
# ics-scraper-3  |  Running

# Scale up to 5
docker compose up -d --scale ics-scraper=5

# Scale down to 1
docker compose up -d --scale ics-scraper=1
```

**Key Points:**
- Each instance has unique container name (ics-scraper-1, ics-scraper-2, etc.)
- All instances share the same Redis queue
- Each instance processes jobs independently
- Network isolation: all instances on same `ics-network` bridge

### Kubernetes Scaling

Deploy scraper as a Kubernetes Deployment with auto-scaling:

```yaml
# scraper-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: allo-scrapper-scraper
spec:
  replicas: 3
  selector:
    matchLabels:
      app: allo-scrapper-scraper
  template:
    metadata:
      labels:
        app: allo-scrapper-scraper
    spec:
      containers:
      - name: scraper
        image: ghcr.io/phbassin/allo-scrapper-scraper:stable
        imagePullPolicy: IfNotPresent
        env:
        - name: RUN_MODE
          value: "consumer"
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-credentials
              key: connection-string
        - name: POSTGRES_HOST
          value: postgres.default.svc.cluster.local
        - name: LOG_LEVEL
          value: info
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        lifecycle:
          preStop:
            exec:
              # Allow 15 seconds for graceful shutdown
              command: ["/bin/sh", "-c", "sleep 15"]
        livenessProbe:
          exec:
            command: ["node", "-e", "require('fs').existsSync('/tmp/healthy')"]
          initialDelaySeconds: 30
          periodSeconds: 10
      serviceAccountName: allo-scrapper-scraper
```

**Auto-Scaling with CPU/Memory:**

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: scraper-autoscaler
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: allo-scrapper-scraper
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
```

---

## Job Orchestration

### Job Types

#### Scrape Jobs

Full cinema scraping with configurable options:

```typescript
interface ScrapeJob {
  reportId: number;
  type: 'scrape';
  triggerType: 'manual' | 'cron' | 'api';
  options: {
    mode: 'from_today_limited' | 'all';
    days?: number;
  };
}
```

**Enqueue from API:**

```bash
curl -X POST http://localhost:3000/api/scraper/trigger \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"triggerType":"manual"}'
```

#### Add Cinema Jobs

Add new cinema to system and scrape immediately:

```typescript
interface ScrapeJobAddCinema {
  reportId: number;
  type: 'add_cinema';
  triggerType: 'api';
  url: string;  // Cinema URL (e.g., allocine.fr cinema page)
}
```

**Enqueue from API:**

```bash
curl -X POST http://localhost:3000/api/cinemas/add-and-scrape \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.allocine.fr/seance/salle_gen_csalle=C1234.html",
    "name": "My Cinema"
  }'
```

### Job Lifecycle

```
Created → Queued → Processing → Completed/Failed
   ↓        ↓         ↓            ↓
  API    Redis     Scraper   Database
```

**State Transitions:**

1. **Created** (`pending`): API creates scrape_report and enqueues job
2. **Queued**: Job waits in Redis list for scraper to process
3. **Processing** (`running`): Scraper pops job from queue and starts work
4. **Completed** (`success`/`partial_success`/`failed`): Report updated with results

**Track Job Progress:**

```bash
# Get report status
curl http://localhost:3000/api/reports/42 \
  -H "Authorization: Bearer $JWT_TOKEN"

# Response
{
  "id": 42,
  "status": "running",
  "triggerType": "manual",
  "created_at": "2025-03-18T10:30:00Z",
  "completed_at": null,
  "total_cinemas": 50,
  "successful_cinemas": 45,
  "failed_cinemas": 5,
  "errors": [...]
}
```

### Retry Strategy

Jobs that fail are NOT automatically retried. Failed jobs remain in `scrape_reports` with status `failed` and error details.

**Manual Retry:**

```bash
# Trigger a new scrape (creates new job)
curl -X POST http://localhost:3000/api/scraper/trigger \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Automatic Retry (Custom Implementation):**

If you need automatic retries, implement a background task in the server:

```typescript
// server/src/services/job-retry.ts
async function retryFailedJobs(): Promise<void> {
  const failedReports = await db.query(
    `SELECT id FROM scrape_reports
     WHERE status = 'failed' 
     AND created_at > NOW() - INTERVAL '6 hours'
     AND retry_count < 3`
  );

  for (const report of failedReports.rows) {
    logger.info(`Retrying failed job ${report.id}`);
    const publisher = getRedisPublisher();
    const job = createScrapeJob(report.id);
    publisher.lpush('scrape:jobs', JSON.stringify(job));
    
    await db.query(
      `UPDATE scrape_reports SET retry_count = retry_count + 1 WHERE id = $1`,
      [report.id]
    );
  }
}

// Run every 30 minutes
cron.schedule('*/30 * * * *', retryFailedJobs);
```

---

## Monitoring & Alerting

### Key Metrics to Track

```
scraper_jobs_total{status="success|partial_success|failed",trigger="manual|cron|api"}
scraper_jobs_duration_seconds{cinema="all"}
redis_llen{key="scrape:jobs"}  # Queue depth
scraper_films_scraped_total{cinema="all"}
scraper_showtimes_scraped_total{cinema="all"}
```

### Prometheus Queries

**Queue depth over time:**
```promql
redis_llen{key="scrape:jobs"}
```

**Job success rate (5-minute window):**
```promql
sum(rate(scraper_jobs_total{status="success"}[5m])) 
/ sum(rate(scraper_jobs_total[5m]))
```

**Average scrape duration:**
```promql
avg(rate(scraper_jobs_duration_seconds_sum[5m])) 
/ avg(rate(scraper_jobs_duration_seconds_count[5m]))
```

**Jobs processing per instance:**
```promql
sum by (instance) (rate(scraper_jobs_total[5m]))
```

### Alert Rules

```yaml
# prometheus.yml or Grafana alert rules
groups:
- name: scraper-alerts
  rules:
  - alert: ScrapeQueueBacklog
    expr: redis_llen{key="scrape:jobs"} > 100
    for: 10m
    annotations:
      summary: "Large scrape queue backlog"
      description: "Queue has {{ $value }} pending jobs"
      action: "Scale up scraper instances or investigate failures"

  - alert: ScrapeJobFailureRate
    expr: |
      sum(rate(scraper_jobs_total{status="failed"}[5m]))
      / sum(rate(scraper_jobs_total[5m])) > 0.5
    for: 5m
    annotations:
      summary: "High scrape job failure rate (>50%)"
      description: "{{ $value | humanizePercentage }} jobs failing"
      action: "Check scraper logs and AlloCiné rate limiting"

  - alert: ScrapeJobDurationHigh
    expr: histogram_quantile(0.95, rate(scraper_jobs_duration_seconds_bucket[5m])) > 300
    for: 10m
    annotations:
      summary: "Scrape jobs taking >5 minutes (p95)"
      description: "95th percentile duration: {{ $value }}s"
      action: "Check network/cinema availability or optimize scraper"

  - alert: ScrapeConsumerDown
    expr: up{job="scraper"} == 0
    for: 2m
    annotations:
      summary: "Scraper consumer instance down"
      description: "Instance {{ $labels.instance }} not responding"
      action: "Check container logs and orchestrator health"
```

### Grafana Dashboard

Create a dashboard to visualize:

1. **Queue Depth** (time series): Monitor backlog growth/shrinkage
2. **Job Success Rate** (gauge): % of jobs completing successfully
3. **Average Duration** (time series): Trend of scrape speed
4. **Jobs Per Minute** (bar chart): Throughput by trigger type
5. **Error Heatmap** (heatmap): Failure patterns by time/cinema
6. **Scraper Instance Health** (table): Status of each replica

**Dashboard JSON** (Grafana import):
```json
{
  "dashboard": {
    "title": "Allo-Scrapper Production Monitoring",
    "panels": [
      {
        "title": "Scrape Queue Depth",
        "targets": [{"expr": "redis_llen{key=\"scrape:jobs\"}"}],
        "type": "graph"
      },
      {
        "title": "Job Success Rate (%)",
        "targets": [{
          "expr": "100 * sum(rate(scraper_jobs_total{status=\"success\"}[5m])) / sum(rate(scraper_jobs_total[5m]))"
        }],
        "type": "gauge"
      }
    ]
  }
}
```

---

## Performance Optimization

### Rate Limiting Tuning

**Scraper Configuration:**
```yaml
environment:
  SCRAPE_THEATER_DELAY_MS: 3000    # Delay between theater requests
  SCRAPE_MOVIE_DELAY_MS: 500       # Delay between movie requests
  SCRAPE_MOVIE_LIST_DELAY_MS: 2000 # Delay for movie lists
```

**For High Throughput:**
- Reduce delays if 429/403 errors are not occurring
- Example: Theater=2000, Movie=300 (faster but riskier)

**For Reliability:**
- Increase delays to reduce AlloCiné rate limiting
- Example: Theater=5000, Movie=1000 (slower but safer)

**Monitor 429 Errors:**
```promql
# Prometheus query for rate-limit errors
sum(rate(scraper_http_errors_total{status="429"}[5m]))
```

If 429 errors spike, increase delay values and scale up scraper instances.

### Database Connection Pooling

**Scraper database configuration:**
```yaml
environment:
  # Connection pool for scraper
  PG_POOL_MIN: 5
  PG_POOL_MAX: 20
```

**Tuning:**
- `min`: Minimum connections to maintain (default 5)
- `max`: Maximum concurrent connections (default 20)
- For high job volume: Increase max to match scraper instance count × 4

### Redis Connection Optimization

**Queue throughput settings:**
```typescript
// scraper/src/redis/client.ts
const redisOptions = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT ?? '6379'),
  retryStrategy: (times) => Math.min(times * 50, 2000),  // Exponential backoff
  enableReadyCheck: true,
  enableOfflineQueue: true,
  maxRetriesPerRequest: 3,
};
```

**Blocking Timeout (Consumer Mode):**
```typescript
// BLPOP timeout in seconds (0 = block forever)
const timeout = 0;
const job = await redis.blpop('scrape:jobs', timeout);
```

Lower timeout = Higher CPU usage but faster job processing
Higher timeout = Lower CPU but slower job pickup

---

## Troubleshooting

### Symptom: Queue Growing Indefinitely

**Diagnosis:**
```bash
# Check queue depth
redis-cli LLEN scrape:jobs  # Returns 1000+

# Check scraper is running
docker compose ps ics-scraper

# Check scraper logs
docker compose logs -f ics-scraper | grep -i error
```

**Solutions:**

1. **Scraper Crashed:**
   ```bash
   # Restart scraper
   docker compose restart ics-scraper
   
   # Or scale up instances
   docker compose up -d --scale ics-scraper=3
   ```

2. **Rate Limiting (429/403):**
   ```bash
   # Check logs for 429 errors
   docker compose logs ics-scraper | grep "429"
   
   # Increase delays
   docker compose down
   export SCRAPE_THEATER_DELAY_MS=5000
   export SCRAPE_MOVIE_DELAY_MS=1000
   docker compose up -d
   ```

3. **Database Connection Issues:**
   ```bash
   # Check database is healthy
   docker compose exec ics-db pg_isready
   
   # Check connection count
   docker compose exec ics-db psql -U postgres -c \
     "SELECT count(*) FROM pg_stat_activity;"
   ```

### Symptom: Jobs Processing Slowly

**Check scraper duration:**
```bash
# Prometheus query
histogram_quantile(0.95, rate(scraper_jobs_duration_seconds_bucket[5m]))

# Result should be < 60s for typical cinema networks
```

**Optimize:**

1. **Reduce delays (if 429 errors are low):**
   ```yaml
   SCRAPE_THEATER_DELAY_MS: 2000
   SCRAPE_MOVIE_DELAY_MS: 300
   ```

2. **Scale up scraper instances:**
   ```bash
   docker compose up -d --scale ics-scraper=5
   ```

3. **Check AlloCiné availability:**
   ```bash
   curl -I https://www.allocine.fr/seance/
   # Should return 200
   ```

### Symptom: Memory Leak in Scraper Containers

**Monitor memory usage:**
```bash
# Check container memory
docker stats ics-scraper

# Expected: stable memory (256MB+), not constantly growing
```

**If growing:**

1. **Check for unfinished connections:**
   ```typescript
   // scraper/src/scraper/http-client.ts
   // Ensure browser.close() is called after each job
   ```

2. **Restart scraper instances periodically:**
   ```yaml
   # In docker-compose.yml
   restart: on-failure:3  # Restart after 3 failures
   ```

3. **Monitor with memory profiler:**
   ```bash
   # Enable heap snapshots
   export NODE_DEBUG=worker
   npm run start:scraper
   ```

### Symptom: Redis Connection Errors

**Check Redis health:**
```bash
# Test connection
redis-cli PING  # Should return PONG

# Check memory usage
redis-cli INFO memory
# Check ops per second
redis-cli INFO stats

# Check queue operations
redis-cli LLEN scrape:jobs
redis-cli LRANGE scrape:jobs 0 0
```

**If connection drops:**

1. **Verify network connectivity:**
   ```bash
   docker compose exec ics-scraper ping ics-redis
   ```

2. **Check Redis logs:**
   ```bash
   docker compose logs ics-redis | tail -50
   ```

3. **Increase connection timeout:**
   ```yaml
   environment:
     REDIS_RETRY_TIMEOUT: 10000  # 10 seconds
   ```

---

## Best Practices

1. **Always use consumer mode for production** – easier scaling and graceful shutdown
2. **Monitor queue depth continuously** – set up alerts at 50+ pending jobs
3. **Scale scraper instances based on queue depth, not CPU** – queue is better scaling signal
4. **Test graceful shutdown in staging** – verify in-flight jobs complete before container stops
5. **Track job success rate** – alert on > 50% failure rate (usually rate-limiting issue)
6. **Update rate-limiting delays based on AlloCiné feedback** – too fast = 429 errors
7. **Clean up stale reports monthly** – delete reports older than 90 days to save database space
8. **Use cron mode only for scheduled scrapes** – not for ad-hoc or continuous scraping
9. **Always test new RUN_MODE before deploying to production** – in staging environment first
10. **Implement retry logic for transient failures** – network timeouts, database locks, etc.
