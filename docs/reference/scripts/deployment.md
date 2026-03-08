# Deployment Scripts Reference

Reference documentation for deployment and setup scripts.

**Last updated:** March 6, 2026

**Related Documentation:**
- [Production Deployment Guide](../../guides/deployment/production.md) - Production setup
- [Development Setup](../../guides/development/setup.md) - Local development
- [Docker Guide](../../guides/deployment/docker.md) - Docker configuration

---

## Table of Contents

- [Overview](#overview)
- [install-hooks.sh](#install-hookssh)
- [pull-and-deploy.sh](#pull-and-deploysh)
- [integration-test.sh](#integration-testsh)

---

## Overview

Allo-Scrapper provides **deployment and setup scripts** for various tasks:

| Script | Purpose | Best For |
|--------|---------|----------|
| `install-hooks.sh` | Install git pre-push hooks | Initial setup, development |
| `pull-and-deploy.sh` | Pull and restart Docker containers | Production deployments |
| `integration-test.sh` | Run integration tests | CI/CD, testing |

---

## install-hooks.sh

**Location**: `scripts/install-hooks.sh`

**Purpose**: Install git pre-push hooks to run TypeScript checks and tests before pushing.

### Usage

```bash
./scripts/install-hooks.sh
```

No arguments needed - copies hooks from `scripts/hooks/` to `.git/hooks/`.

---

### What It Does

1. Finds git repository root
2. Locates `.git/hooks/` directory
3. Copies all hooks from `scripts/hooks/` to `.git/hooks/`
4. Makes hooks executable (`chmod +x`)
5. Displays installed hooks

---

### Example Output

```
Installing git hooks from /home/user/allo-scrapper/scripts/hooks into /home/user/allo-scrapper/.git/hooks...
  installed: pre-push
Done. Git hooks installed successfully.
```

---

### Pre-Push Hook

The **pre-push hook** (`scripts/hooks/pre-push`) runs before every `git push`:

**What it does**:
1. Runs `tsc --noEmit` (TypeScript type checking)
2. Runs `npm run test:run` (all unit tests)
3. **Blocks push** if either fails

**Example**:
```bash
git push origin feature/my-branch

# Hook runs automatically:
Running pre-push checks...
✓ TypeScript check passed
✓ Tests passed (569 tests)

# Push proceeds
```

**If checks fail**:
```bash
git push origin feature/my-branch

# Hook runs:
Running pre-push checks...
✗ TypeScript check failed
  Error: Type 'string' is not assignable to type 'number'

# Push is blocked
```

---

### Bypass Hook (Emergency Only)

```bash
# Skip pre-push hook (NOT recommended)
git push --no-verify
```

**Only use this when**:
- CI server is down and you need to push urgently
- Fixing a production incident
- Hook itself is broken

---

### Prerequisites

- Git repository initialized (`.git/` directory exists)
- Bash shell (Linux, macOS, Git Bash on Windows)

---

### Uninstall Hook

```bash
# Remove pre-push hook
rm .git/hooks/pre-push

# Verify
ls -la .git/hooks/
```

---

## pull-and-deploy.sh

**Location**: `scripts/pull-and-deploy.sh`

**Purpose**: Pull latest Docker image and restart containers with zero-downtime deployment.

### Usage

```bash
./scripts/pull-and-deploy.sh [tag]
```

**Arguments**:
- `tag` - Docker image tag (default: `latest`)

**Examples**:
```bash
# Pull latest image
./scripts/pull-and-deploy.sh

# Pull specific tag
./scripts/pull-and-deploy.sh v1.2.3

# Pull stable tag
./scripts/pull-and-deploy.sh stable
```

---

### What It Does

1. Pulls Docker image from GitHub Container Registry
2. Stops current containers (`docker compose down`)
3. Starts updated containers (`docker compose up -d`)
4. Waits 5 seconds for services to start
5. Shows container status (`docker compose ps`)
6. Performs health check on API endpoint

---

### Example Output

```
🔄 Pulling Docker image: ghcr.io/phbassin/allo-scrapper:latest
latest: Pulling from phbassin/allo-scrapper
Digest: sha256:abc123...
Status: Downloaded newer image for ghcr.io/phbassin/allo-scrapper:latest

🔄 Stopping current containers...
[+] Running 3/3
 ✔ Container ics-web    Stopped
 ✔ Container ics-db     Stopped
 ✔ Container ics-redis  Stopped

🚀 Starting updated containers...
[+] Running 3/3
 ✔ Container ics-db     Started
 ✔ Container ics-redis  Started
 ✔ Container ics-web    Started

⏳ Waiting for services to be healthy...

🔍 Checking container status...
NAME        IMAGE                                    STATUS
ics-web     ghcr.io/phbassin/allo-scrapper:latest   Up 5 seconds (healthy)
ics-db      postgres:15-alpine                       Up 6 seconds (healthy)
ics-redis   redis:7-alpine                           Up 6 seconds (healthy)

✅ Deployment updated successfully!

📊 Quick health check:
  ✓ API is responding
{
  "status": "healthy",
  "timestamp": "2026-03-06T14:52:00.000Z",
  "version": "3.0.0"
}

📝 View logs with: docker compose logs -f web
```

---

### Image Tagging Strategy

| Tag | Purpose | Stability |
|-----|---------|-----------|
| `latest` | Latest build from `develop` branch | **Unstable** (bleeding edge) |
| `stable` | Latest stable release | **Stable** (recommended) |
| `v1.2.3` | Specific version | **Fixed** (for rollbacks) |
| `main` | Production branch | **Stable** |

**Recommendation**: Use `stable` tag for production deployments.

---

### Prerequisites

- Docker and Docker Compose installed
- Access to GitHub Container Registry (image is public)
- `docker-compose.yml` configured to use the image

---

### Health Check

The script performs an API health check:

```bash
curl -s http://localhost:3000/api/health
```

**Success** (API responding):
```
✓ API is responding
{
  "status": "healthy",
  "timestamp": "2026-03-06T14:52:00.000Z"
}
```

**Failure** (API not ready):
```
✗ API not responding yet (may still be starting up)
```

**Note**: If health check fails, containers may still be starting. Check logs:
```bash
docker compose logs -f ics-web
```

---

### Zero-Downtime Deployments

**Current approach**: Brief downtime during container restart (~5-10 seconds)

**Future improvements** (not yet implemented):
1. **Blue-green deployment**: Run new version alongside old, switch traffic
2. **Rolling updates**: Update one container at a time
3. **Health checks**: Wait for new version to be healthy before stopping old

---

### Rollback to Previous Version

```bash
# Rollback to specific version
./scripts/pull-and-deploy.sh v1.2.2

# Rollback to stable
./scripts/pull-and-deploy.sh stable
```

---

## integration-test.sh

**Location**: `scripts/integration-test.sh`

**Purpose**: Run full integration test suite (start containers, run tests, cleanup).

### Usage

```bash
./scripts/integration-test.sh
```

No arguments needed - handles full test lifecycle.

---

### What It Does

1. Starts test environment (`docker compose -f docker-compose.test.yml up -d`)
2. Waits for database to be ready
3. Runs database migrations
4. Runs integration tests (server + E2E)
5. Stops and cleans up test containers
6. Exits with test result code

---

### Example Output

```
🚀 Starting integration test environment...
[+] Running 2/2
 ✔ Container ics-db-test  Started
 ✔ Container ics-web-test Started

⏳ Waiting for database to be ready...
✅ Database is ready

🔄 Running database migrations...
Migrations applied successfully

🧪 Running integration tests...
✓ Server tests passed (569 tests)
✓ E2E tests passed (12 tests)

🧹 Cleaning up test environment...
[+] Running 2/2
 ✔ Container ics-web-test Removed
 ✔ Container ics-db-test  Removed

✅ Integration tests completed successfully!
```

---

### Prerequisites

- Docker and Docker Compose installed
- `docker-compose.test.yml` exists (test environment configuration)
- Playwright installed for E2E tests

---

### Use in CI/CD

This script is designed for **automated testing pipelines**:

**GitHub Actions example**:
```yaml
- name: Run integration tests
  run: ./scripts/integration-test.sh
```

**Exit codes**:
- `0` - All tests passed
- `1` - Tests failed or error occurred

---

## Quick Reference

```bash
# Install git hooks (run once after cloning)
./scripts/install-hooks.sh

# Deploy latest version
./scripts/pull-and-deploy.sh

# Deploy specific version
./scripts/pull-and-deploy.sh v1.2.3

# Run integration tests
./scripts/integration-test.sh

# View deployment logs
docker compose logs -f ics-web

# Check container status
docker compose ps

# Rollback deployment
./scripts/pull-and-deploy.sh v1.2.2
```

---

## Automated Deployment

### CI/CD Pipeline (GitHub Actions)

**Deploy on push to main**:
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: SSH to production
        run: |
          ssh user@ics.opalkad.com 'cd ~/allo-scrapper && ./scripts/pull-and-deploy.sh stable'
```

---

### Manual Production Deployment

**SSH to production server**:
```bash
ssh user@ics.opalkad.com
cd ~/allo-scrapper
./scripts/pull-and-deploy.sh stable
```

---

## Related Documentation

- [Production Deployment Guide](../../guides/deployment/production.md) - Complete deployment workflow
- [CI/CD Guide](../../guides/development/cicd.md) - Automated pipelines
- [Docker Guide](../../guides/deployment/docker.md) - Docker configuration

---

[← Back to Scripts Reference](./README.md)
