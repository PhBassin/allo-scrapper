# Network Access & CORS

Guide for accessing the application from external devices (LAN/network access).

**Related Guides:**
- [Production Deployment](./production.md) - Production setup
- [Docker Setup](./docker.md) - Container management
- [../../getting-started/configuration.md](../../getting-started/configuration.md) - Environment variables

---

## Table of Contents

- [Overview](#overview)
- [Accessing from Another Machine](#accessing-from-another-machine)
- [How It Works](#how-it-works)
- [Development Mode](#development-mode)
- [Port Forwarding (Internet Access)](#port-forwarding-internet-access)
- [Custom Domain](#custom-domain)
- [Troubleshooting](#troubleshooting)
- [Testing Network Access](#testing-network-access)

---

## Overview

The application can be accessed from other devices on your local network (LAN access).

**Key Requirements:**
1. **Find your server's IP address**
2. **Update CORS configuration** to allow the IP
3. **Access from browser** using the server's IP

---

## Accessing from Another Machine

### When Running via Docker

**Step 1: Find your server's IP address**

```bash
# On Linux
hostname -I
# or
ip addr show | grep "inet "

# On macOS
ipconfig getifaddr en0  # for Wi-Fi
ipconfig getifaddr en1  # for Ethernet

# Example output: 192.168.1.100
```

---

**Step 2: Update CORS configuration**

CORS (Cross-Origin Resource Sharing) must allow the origin that browsers use to reach the app.

```bash
# Edit .env file
nano .env

# Add your server's IP to ALLOWED_ORIGINS
ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.100:3000
#                                      ^^^^^^^^^^^^^^^^^^^
#                                      Add your server's LAN IP

# Restart the container to apply changes
docker compose restart ics-web
```

---

**Step 3: Access from another device**

On the other device (phone, tablet, another computer), open a browser and navigate to:

```
http://192.168.1.100:3000
```

---

## How It Works

- **Production (Docker)**: The React frontend is served by the same Express server that hosts the API on port 3000
- **API calls use relative paths** (`/api/films`) instead of absolute URLs like `http://localhost:3000/api/films`
- **Works with any hostname**: `localhost`, LAN IP (`192.168.x.x`), or custom domain name
- **CORS must include the origin** that browsers use to reach the app (the full URL including protocol)

### Architecture

```
┌─────────────────────────────────────┐
│  Browser on Device A                │
│  http://192.168.1.100:3000          │
└──────────────┬──────────────────────┘
               │ HTTP GET /
               │ HTTP GET /api/films
               ▼
┌─────────────────────────────────────┐
│  Server (192.168.1.100:3000)        │
│  ┌─────────────────────────────────┐│
│  │ Express Server                  ││
│  │ - Serves React SPA (/)          ││
│  │ - Serves API (/api/*)           ││
│  │ - CORS check: allowed origins   ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

### CORS Flow

1. Browser makes request from `http://192.168.1.100:3000`
2. Request includes `Origin: http://192.168.1.100:3000` header
3. Server checks if origin is in `ALLOWED_ORIGINS`
4. If allowed, server responds with `Access-Control-Allow-Origin: http://192.168.1.100:3000`
5. Browser allows the response

**Note:** CORS is a security feature that prevents unauthorized cross-origin requests. The origin must match exactly (including protocol and port).

---

## Development Mode

When running `npm run dev` for local development:

**Services:**
- **Frontend**: `http://localhost:5173` (Vite dev server with hot-reload)
- **Backend API**: `http://localhost:3000` (Express server)

**Proxy:**
- Vite automatically forwards `/api/*` requests to port 3000

**CORS:**
- Must include both origins: `http://localhost:3000,http://localhost:5173`

---

### LAN Access in Dev Mode

```bash
# Find your IP
ipconfig getifaddr en0  # macOS
hostname -I             # Linux

# Update .env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://192.168.1.100:5173,http://192.168.1.100:3000

# Restart Vite dev server (it needs to bind to 0.0.0.0)
cd client
npm run dev -- --host

# Access from another device
# http://192.168.1.100:5173
```

**Note:** Vite dev server must be started with `--host` flag to bind to `0.0.0.0` instead of `localhost`:

```bash
# In client/package.json
{
  "scripts": {
    "dev": "vite --host"
  }
}
```

---

## Port Forwarding (Internet Access)

To access the application from outside your local network (e.g., from a mobile phone on cellular data), you need to set up port forwarding on your router.

**⚠️ Security Warning:** Exposing the application to the internet without proper security measures (HTTPS, authentication, firewall) can be dangerous. Only do this for testing purposes or with proper security hardening.

---

### Steps

**1. Find your public IP:**
```bash
curl ifconfig.me
# Example: 203.0.113.45
```

---

**2. Configure router port forwarding:**
- Log in to your router admin panel (usually `192.168.1.1` or `192.168.0.1`)
- Find "Port Forwarding" or "Virtual Server" section
- Add rule: External Port `3000` → Internal IP `192.168.1.100` → Internal Port `3000`

---

**3. Update CORS:**
```bash
ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.100:3000,http://203.0.113.45:3000

docker compose restart ics-web
```

---

**4. Access from internet:**
```
http://203.0.113.45:3000
```

**Recommended:** Use a reverse proxy (nginx) with HTTPS and authentication for production internet access. See [Production Deployment](./production.md) for details.

---

## Custom Domain

If you have a custom domain (e.g., `cinema.example.com`), you can use it instead of IP addresses.

**Requirements:**
- Domain DNS points to your server's IP
- Reverse proxy (nginx, Caddy) handles HTTPS
- CORS includes the domain

```bash
# .env
ALLOWED_ORIGINS=http://localhost:3000,https://cinema.example.com

# Reverse proxy forwards requests to localhost:3000
```

See [Production Deployment](./production.md) for complete custom domain setup.

---

## Troubleshooting

### Problem: "Network Error" or "Failed to fetch" in browser

**Symptoms:**
- Homepage loads but shows "Failed to load data" or network errors
- Browser console shows network errors

**Solution:**

```bash
# 1. Verify CORS configuration includes your server IP
cat .env | grep ALLOWED_ORIGINS
# Should show: ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.100:3000

# 2. If missing, add your server IP
echo "ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.100:3000" >> .env

# 3. Restart container
docker compose restart ics-web

# 4. Clear browser cache and reload page
```

**Verify the fix:**
- Open browser DevTools (F12)
- Go to Network tab
- Reload the page
- Check API requests - they should use your server's IP (e.g., `http://192.168.1.100:3000/api/films`)
- NOT `http://localhost:3000/api/films`

---

### Problem: CORS error in browser console

**Error message:**
```
Access to fetch at 'http://192.168.1.100:3000/api/films' from origin 
'http://192.168.1.100:3000' has been blocked by CORS policy
```

**Solution:**

Add the exact origin (including `http://`) to `ALLOWED_ORIGINS` in `.env`, then restart:

```bash
# Add the origin shown in the error message
ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.100:3000

docker compose restart ics-web
```

**Multiple IPs:**

If you access the server from multiple IPs (e.g., localhost + LAN IP + public IP), add all of them:

```bash
ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.100:3000,http://10.0.0.50:3000
```

---

### Problem: Cannot connect to server from another device

**Checklist:**

**1. Verify server is accessible:**
```bash
# From the other device
ping 192.168.1.100
```

---

**2. Check firewall:** Ensure port 3000 is open on the server
```bash
# On Linux (Ubuntu/Debian)
sudo ufw status
sudo ufw allow 3000/tcp

# On macOS
# System Preferences → Security & Privacy → Firewall → Firewall Options
# Allow incoming connections for Docker or the app
```

---

**3. Verify Docker container is running:**
```bash
docker compose ps
# Should show ics-web as "running"
```

---

**4. Test API directly:**
```bash
# From the other device
curl http://192.168.1.100:3000/api/health
# Should return: {"status":"ok","timestamp":"..."}
```

---

**5. Check network connectivity:**
```bash
# Ensure both devices are on the same network
# Check router settings for client isolation (should be disabled)
```

---

### Problem: Works on localhost but not on LAN IP

**Cause:** CORS configuration only includes `http://localhost:3000`

**Solution:**

```bash
# Update CORS to include LAN IP
ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.100:3000

docker compose restart ics-web
```

---

### Problem: Port 3000 already in use

**Symptoms:**
- Docker fails to start with "port is already allocated" error

**Solution:**

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change the port in docker-compose.yml
# ports:
#   - "3001:3000"  # Map to port 3001 instead

# Update ALLOWED_ORIGINS accordingly
ALLOWED_ORIGINS=http://localhost:3001,http://192.168.1.100:3001
```

---

## Testing Network Access

### Quick Test Script

```bash
#!/bin/bash
# test-network-access.sh

SERVER_IP="192.168.1.100"
PORT="3000"

echo "Testing network access to $SERVER_IP:$PORT"

# Test 1: Ping
echo "1. Ping server..."
ping -c 3 $SERVER_IP

# Test 2: Port connectivity
echo "2. Test port $PORT..."
nc -zv $SERVER_IP $PORT

# Test 3: Health check
echo "3. Health check..."
curl -s http://$SERVER_IP:$PORT/api/health | jq

# Test 4: Films endpoint
echo "4. Films endpoint..."
curl -s http://$SERVER_IP:$PORT/api/films | jq '.success'

echo "All tests complete!"
```

**Usage:**
```bash
chmod +x test-network-access.sh
./test-network-access.sh
```

---

### Manual Testing

```bash
# From another device on the network

# 1. Ping test
ping 192.168.1.100

# 2. Port test
telnet 192.168.1.100 3000
# or
nc -zv 192.168.1.100 3000

# 3. API test
curl http://192.168.1.100:3000/api/health

# 4. Browser test
# Open http://192.168.1.100:3000 in a browser
```

---

## CORS Configuration Reference

### Environment Variable

```bash
# .env
ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.100:3000
```

### Format

- Comma-separated list
- Include protocol (`http://` or `https://`)
- Include port if not default (80 for HTTP, 443 for HTTPS)
- No trailing slashes
- No spaces

### Examples

```bash
# Local only
ALLOWED_ORIGINS=http://localhost:3000

# Local + LAN
ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.100:3000

# Local + LAN + public IP
ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.100:3000,http://203.0.113.45:3000

# Production with custom domain
ALLOWED_ORIGINS=https://cinema.example.com

# Development mode (Vite + Express)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Development mode with LAN access
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://192.168.1.100:3000,http://192.168.1.100:5173
```

---

## Security Considerations

### 1. CORS is not authentication

CORS only controls which origins can make requests from browsers. It does not prevent:
- Direct API access via curl/Postman
- Server-to-server requests
- Malicious scripts on allowed origins

### 2. Use HTTPS in production

Always use HTTPS for production deployments:
```bash
ALLOWED_ORIGINS=https://cinema.example.com
```

### 3. Be specific with allowed origins

Avoid wildcards (`*`) in production:
```bash
# Bad (allows all origins)
ALLOWED_ORIGINS=*

# Good (specific origins)
ALLOWED_ORIGINS=https://cinema.example.com,https://www.cinema.example.com
```

### 4. Limit network exposure

- Use firewall rules to restrict access
- Consider VPN for remote access
- Use reverse proxy with authentication
- Enable rate limiting

---

## Related Documentation

- [Production Deployment](./production.md) - Custom domain and HTTPS setup
- [Docker Setup](./docker.md) - Container management
- [../../getting-started/configuration.md](../../getting-started/configuration.md) - Environment variables
- [../../troubleshooting/network.md](../../troubleshooting/network.md) - Network issues

---

[← Back to Deployment Guides](./README.md)
