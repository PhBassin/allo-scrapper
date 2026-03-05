# 🌐 Networking Troubleshooting

Network configuration, SSL, and connectivity troubleshooting for Allo-Scrapper.

**Related Documentation:**
- [Networking Guide](../guides/deployment/networking.md) - Network setup
- [Production Deployment](../guides/deployment/production.md) - Production configuration
- [Common Issues](./common-issues.md) - General troubleshooting

---

## Table of Contents

- [CORS Issues](#cors-issues)
- [Container Networking](#container-networking)
- [SSL/TLS Issues](#ssltls-issues)
- [WebSocket and SSE](#websocket-and-sse)
- [Rate Limiting](#rate-limiting)
- [DNS and Service Discovery](#dns-and-service-discovery)
- [Common Commands](#common-commands)

---

## CORS Issues

### CORS Policy Error in Browser

**Error:**

```
Access to fetch at 'http://localhost:3000/api/...' from origin 'http://localhost:5173' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present.
```

**Cause:** Frontend origin not allowed in CORS configuration.

**Solution:**

```bash
# Check CORS_ORIGIN in .env
cat .env | grep CORS_ORIGIN

# Allow frontend origin (development)
echo "CORS_ORIGIN=http://localhost:5173" >> .env

# Allow multiple origins (production)
echo "CORS_ORIGIN=https://app.example.com,https://www.example.com" >> .env

# Restart server
docker compose restart ics-web
```

**Default:** `CORS_ORIGIN=http://localhost:5173` (Vite dev server)

---

### Preflight Request Failures

**Error:**

```
Response to preflight request doesn't pass access control check
```

**Cause:** OPTIONS request not handled correctly.

**Check preflight:**

```bash
# Test OPTIONS request
curl -X OPTIONS http://localhost:3000/api/cinemas \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -v

# Expected headers in response:
# Access-Control-Allow-Origin: http://localhost:5173
# Access-Control-Allow-Methods: GET,POST,PUT,DELETE
# Access-Control-Allow-Credentials: true
```

**Solution:** CORS middleware handles OPTIONS automatically. Check `CORS_ORIGIN` is set correctly.

---

### Credentials Mode Issues

**Error:**

```
The value of the 'Access-Control-Allow-Credentials' header in the response is '' 
which must be 'true' when the request's credentials mode is 'include'.
```

**Cause:** Frontend sending credentials but server not configured.

**Application behavior:**
- CORS middleware sets `credentials: true` automatically
- Cookies/auth headers allowed

**Frontend must use:**

```javascript
fetch('http://localhost:3000/api/...', {
  credentials: 'include'  // Send cookies
})
```

---

## Container Networking

### Service Name vs Localhost

**In Docker Compose, use service names:**

```bash
# ✅ CORRECT - service names
POSTGRES_HOST=ics-db
REDIS_URL=redis://ics-redis:6379

# ❌ WRONG - localhost (doesn't work between containers)
POSTGRES_HOST=localhost
REDIS_URL=redis://localhost:6379
```

**Why:** Each container has its own network namespace. `localhost` refers to the container itself, not other containers.

---

### Connection Refused Between Containers

**Error:**

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Cause:** Using `localhost` instead of service name in `.env`.

**Solution:**

```bash
# Fix environment variables
POSTGRES_HOST=ics-db      # Not localhost
REDIS_URL=redis://ics-redis:6379

# Restart services
docker compose restart ics-web
```

**Test connectivity:**

```bash
# From ics-web container, ping database
docker compose exec ics-web ping ics-db

# Check DNS resolution
docker compose exec ics-web nslookup ics-db

# Test database connection
docker compose exec ics-web psql -h ics-db -U postgres -d ics -c "SELECT 1;"
```

---

### Port Mapping Confusion

**External (host) vs Internal (container) ports:**

```yaml
services:
  ics-web:
    ports:
      - "3000:3000"  # host:container
      #   ↑    ↑
      #   |    └─ Port inside container (internal)
      #   └────── Port on host machine (external)
```

**Access patterns:**

```bash
# From host machine (or external)
curl http://localhost:3000/api/health

# From another container
curl http://ics-web:3000/api/health
```

**Common mistake:**

```bash
# ❌ WRONG - trying to use host port from container
POSTGRES_HOST=ics-db:5432  # Don't specify port, use default

# ✅ CORRECT
POSTGRES_HOST=ics-db  # Uses PostgreSQL default port 5432
```

---

## SSL/TLS Issues

### No Built-in HTTPS Support

**Application does NOT include HTTPS/SSL support.**

**For HTTPS, use reverse proxy:**

- Nginx
- Traefik
- Caddy
- Apache

**Example nginx configuration:**

```nginx
server {
    listen 443 ssl http2;
    server_name app.example.com;

    ssl_certificate /etc/ssl/certs/cert.pem;
    ssl_certificate_key /etc/ssl/private/key.pem;

    location / {
        proxy_pass http://ics-web:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**See:** [Networking Guide](../guides/deployment/networking.md) for full reverse proxy setup.

---

### Self-Signed Certificate Errors

**Browser error:**

```
NET::ERR_CERT_AUTHORITY_INVALID
```

**Solution for development:**

```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -nodes \
  -keyout key.pem -out cert.pem -days 365

# Use in reverse proxy
# Or click "Advanced" > "Proceed" in browser (dev only)
```

**Production:** Use Let's Encrypt with Certbot or Traefik automatic SSL.

---

### Mixed Content Warnings

**Error:**

```
Mixed Content: The page at 'https://app.example.com' was loaded over HTTPS, 
but requested an insecure resource 'http://api.example.com/...'
```

**Cause:** Frontend served over HTTPS, API served over HTTP.

**Solution:**

```bash
# Ensure API also uses HTTPS via reverse proxy
# Or use relative URLs in frontend (same origin)

# Frontend API config:
const API_URL = window.location.origin + '/api'  # Same protocol
```

---

## WebSocket and SSE

### SSE Progress Tracking

**Endpoint:** `GET /api/scraper/progress`

**Connection details:**
- **Event stream:** Server-Sent Events (SSE)
- **Heartbeat:** Every 15 seconds (`: heartbeat\n\n`)
- **Auto-cleanup:** Disconnected clients removed silently
- **No automatic reconnection** on client side

**Test SSE connection:**

```bash
# Connect to progress stream
curl -N http://localhost:3000/api/scraper/progress

# Expected output:
# : heartbeat
#
# event: cinema_started
# data: {"type":"cinema_started","cinema_name":"UGC Ciné Cité Les Halles"}
```

**Common issues:**

1. **Connection drops after 15 seconds of inactivity**
   - Normal behavior if no active scrape
   - Heartbeat sent every 15s during scrape

2. **No events received**
   - Check if scrape is actually running: `GET /api/scraper/status`
   - Verify client accepts `text/event-stream` content type

3. **Buffering by reverse proxy**
   - Nginx: Add `proxy_buffering off;`
   - Apache: Add `ProxyPass ... disablereuse=On`

---

### SSE Through Reverse Proxy

**Nginx configuration for SSE:**

```nginx
location /api/scraper/progress {
    proxy_pass http://ics-web:3000;
    proxy_set_header Connection '';
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 24h;
}
```

---

## Rate Limiting

### No HTTP 429 Detection

**⚠️ Important:** Scraper **does NOT detect or handle HTTP 429 (Too Many Requests)**.

**Current behavior:**
- Fixed delays between requests
- No automatic retry on rate limit
- 429 errors logged as generic HTTP error

**Configuration:**

```bash
# Delay between cinemas (milliseconds)
SCRAPE_THEATER_DELAY_MS=3000  # Default: 3 seconds

# Delay between film detail fetches (milliseconds)
SCRAPE_MOVIE_DELAY_MS=500  # Default: 500ms

# Restart to apply
docker compose restart ics-web
```

**If AlloCiné rate limits you:**

1. **Increase delays:**

```bash
echo "SCRAPE_THEATER_DELAY_MS=5000" >> .env  # 5 seconds between cinemas
echo "SCRAPE_MOVIE_DELAY_MS=1000" >> .env   # 1 second between films
docker compose restart ics-web
```

2. **Scrape fewer cinemas at once** (use API to scrape specific cinemas)

3. **Monitor for 403/429 errors in logs:**

```bash
docker compose logs ics-web | grep "Failed to fetch"
```

---

### API Rate Limiting

**Application has rate limiting for API endpoints:**

- `/api/auth/*` - Limited per IP
- `/api/scraper/*` - Limited for non-admin users
- Admin users bypass rate limits

**Rate limit headers:**

```bash
curl -I http://localhost:3000/api/auth/login

# Response headers:
# X-RateLimit-Limit: 100
# X-RateLimit-Remaining: 99
# X-RateLimit-Reset: 1234567890
```

**If rate limited:**

```
HTTP/1.1 429 Too Many Requests
Retry-After: 60
```

---

## DNS and Service Discovery

### Docker DNS Resolution

**Automatic service discovery:**

```bash
# Each service can resolve other service names
docker compose exec ics-web ping ics-db
docker compose exec ics-web nslookup ics-redis

# Expected: Resolves to container IP
```

**Custom DNS:**

```yaml
services:
  ics-web:
    dns:
      - 8.8.8.8
      - 8.8.4.4
```

---

### External DNS Issues

**Error:**

```
getaddrinfo ENOTFOUND www.allocine.fr
```

**Cause:** Container can't resolve external domains.

**Solution:**

```bash
# Test DNS from container
docker compose exec ics-web nslookup www.allocine.fr

# If fails, check Docker DNS config
# Or add custom DNS servers (see above)
```

---

### SSRF Protection

**AlloCiné requests only:**

Application validates that all scraper HTTP requests go to `www.allocine.fr` only.

**Error if different hostname:**

```
SSRF guard: unexpected host in constructed URL https://evil.com/...
```

**This is intentional security feature.** Cannot be disabled.

---

## Common Commands

### Test Connectivity

```bash
# Health check
curl http://localhost:3000/api/health

# Test API endpoint
curl http://localhost:3000/api/cinemas

# Test with authentication
curl http://localhost:3000/api/scraper/status \
  -H "Authorization: Bearer <token>"

# Test SSE stream
curl -N http://localhost:3000/api/scraper/progress
```

### Debug Container Networking

```bash
# Ping between containers
docker compose exec ics-web ping ics-db

# Check DNS resolution
docker compose exec ics-web nslookup ics-db

# Check listening ports
docker compose exec ics-web netstat -tulpn

# Check network interfaces
docker compose exec ics-web ip addr

# Inspect network
docker network inspect allo-scrapper_default
```

### Test CORS

```bash
# Preflight request
curl -X OPTIONS http://localhost:3000/api/cinemas \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -v

# Actual request with origin
curl http://localhost:3000/api/cinemas \
  -H "Origin: http://localhost:5173" \
  -v
```

### Monitor Network Traffic

```bash
# Monitor requests (from container logs)
docker compose logs -f ics-web | grep "GET\|POST\|PUT\|DELETE"

# View all connections
docker compose exec ics-web netstat -an | grep ESTABLISHED
```

---

## Configuration

### Environment Variables

```bash
# CORS configuration
CORS_ORIGIN=http://localhost:5173

# Host/port binding
HOST=0.0.0.0  # Listen on all interfaces (Docker default)
PORT=3000     # Internal port

# Database connection (use service name)
POSTGRES_HOST=ics-db
POSTGRES_PORT=5432

# Redis connection (use service name)
REDIS_URL=redis://ics-redis:6379
```

### Network Mode

**Default:** Bridge network (automatic service discovery).

**To use host network (not recommended):**

```yaml
services:
  ics-web:
    network_mode: host  # Use host networking
```

**Note:** Host networking disables service name resolution.

---

## Related Documentation

- [Networking Guide](../guides/deployment/networking.md) - Reverse proxy setup
- [Production Deployment](../guides/deployment/production.md) - Production configuration
- [Docker Troubleshooting](./docker.md) - Docker issues
- [Common Issues](./common-issues.md) - General troubleshooting

---

[← Back to Troubleshooting](./README.md)
