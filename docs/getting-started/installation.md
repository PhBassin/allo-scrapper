# Installation

Detailed installation instructions for different environments and use cases.

## Table of Contents

- [System Requirements](#system-requirements)
- [Installation Methods](#installation-methods)
  - [Docker Compose (Recommended)](#method-1-docker-compose-recommended)
  - [Manual Setup (Local Development)](#method-2-manual-setup-local-development)
  - [Production Installation](#method-3-production-installation)
- [Post-Installation](#post-installation)
- [Verification](#verification)
- [Upgrading](#upgrading)

---

## System Requirements

### Minimum Requirements

- **CPU**: 2 cores
- **RAM**: 4 GB
- **Disk**: 10 GB free space
- **OS**: Linux, macOS, or Windows (with WSL2 for Docker)

### Recommended for Production

- **CPU**: 4 cores
- **RAM**: 8 GB
- **Disk**: 20 GB free space (for database growth and backups)
- **OS**: Ubuntu 22.04 LTS or Debian 12

### Software Dependencies

Choose based on your installation method:

**Docker Compose Method:**
- Docker Engine 24.0+ or Docker Desktop
- Docker Compose v2.0+
- Git

**Manual Setup Method:**
- Node.js 20.x or higher
- npm 10.x or higher
- PostgreSQL 15.x or higher
- Git
- Redis 7.x+ (optional, for microservice scraper mode)

---

## Installation Methods

### Method 1: Docker Compose (Recommended)

**Best for:** Quick start, development, small deployments, testing

#### 1. Install Docker

**Ubuntu/Debian:**
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group (optional, avoids sudo)
sudo usermod -aG docker $USER
newgrp docker
```

**macOS:**
```bash
# Install Docker Desktop
brew install --cask docker
# Open Docker Desktop from Applications
```

**Windows:**
- Download and install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
- Enable WSL2 backend

#### 2. Clone the Repository

```bash
git clone https://github.com/PhBassin/allo-scrapper.git
cd allo-scrapper
```

#### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` to customize (optional - defaults work for local development):
```bash
nano .env
```

#### 4. Start Services

```bash
# Development mode (hot-reload enabled)
npm run dev

# Production mode (optimized builds)
docker compose up -d
```

#### 5. Initialize Database

The database is automatically initialized on first startup. To manually run migrations:

```bash
docker compose exec ics-web npm run db:migrate
```

**Done!** Access the app at http://localhost:5173 (dev) or http://localhost:3000 (production)

---

### Method 2: Manual Setup (Local Development)

**Best for:** Contributing to the project, customizing the codebase, learning the architecture

#### 1. Install Node.js

**Ubuntu/Debian:**
```bash
# Install Node.js 20.x via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**macOS:**
```bash
brew install node@20
```

**Windows:**
- Download and install from [nodejs.org](https://nodejs.org/)

Verify installation:
```bash
node --version  # Should be 20.x or higher
npm --version   # Should be 10.x or higher
```

#### 2. Install PostgreSQL

**Ubuntu/Debian:**
```bash
# Install PostgreSQL 15
sudo apt install postgresql-15 postgresql-contrib

# Start service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database
sudo -u postgres createdb ics
```

**macOS:**
```bash
# Install PostgreSQL
brew install postgresql@15

# Start service
brew services start postgresql@15

# Create database
createdb ics
```

**Windows:**
- Download and install from [postgresql.org](https://www.postgresql.org/download/windows/)

#### 3. Clone Repository

```bash
git clone https://github.com/PhBassin/allo-scrapper.git
cd allo-scrapper
```

#### 4. Install Dependencies

```bash
# Root dependencies (convenience scripts)
npm ci

# Server dependencies
cd server
npm ci
cd ..

# Client dependencies
cd client
npm ci
cd ..
```

#### 5. Configure Environment

```bash
cp .env.example .env
nano .env
```

Update PostgreSQL connection settings:
```bash
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=ics
POSTGRES_USER=postgres
POSTGRES_PASSWORD=yourpassword
```

#### 6. Initialize Database

```bash
cd server
npm run db:migrate
cd ..
```

#### 7. Start Services

**Terminal 1 - API Server:**
```bash
cd server
npm run dev
# Runs on http://localhost:3000
```

**Terminal 2 - React Client:**
```bash
cd client
npm run dev
# Runs on http://localhost:5173
```

#### 8. Install Git Hooks (Optional but Recommended)

```bash
./scripts/install-hooks.sh
```

This installs pre-push hooks that run TypeScript checks and tests before pushing.

---

### Method 3: Production Installation

**Best for:** Production deployments, VPS/cloud hosting, high-traffic sites

For complete production deployment instructions, see:
- **[Production Deployment Guide](../../guides/deployment/production.md)** - Complete production setup
- **[Docker Setup Guide](../../guides/deployment/docker.md)** - Docker optimization for production

**Quick Production Start:**

```bash
# Clone repository
git clone https://github.com/PhBassin/allo-scrapper.git
cd allo-scrapper

# Configure environment for production
cp .env.example .env
nano .env  # Set JWT_SECRET, database password, etc.

# Pull pre-built images from GitHub Container Registry
npm run docker:pull

# Start production stack
docker compose up -d

# Verify health
curl http://localhost:3000/api/health
```

**Important Production Settings:**

In `.env`, configure:
```bash
NODE_ENV=production
JWT_SECRET=<generate with: openssl rand -base64 32>
POSTGRES_PASSWORD=<strong password>
LOG_LEVEL=warn
```

See [Configuration Guide](./configuration.md) for all environment variables.

---

## Post-Installation

### 1. Create Admin User

The database includes a default admin user:
- **Username**: `admin`
- **Password**: `admin`

**⚠️ Change this immediately for production:**

```bash
# Login to the app
# Navigate to User Management
# Change admin password or create new admin user
# Delete default admin user
```

Or via API:
```bash
# Login as admin
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  | jq -r '.data.token')

# Change password (coming soon)
# For now, use the admin panel UI
```

### 2. Configure Cinemas

Add cinemas you want to scrape:

**Option A: Edit config file** (server/src/config/cinemas.json):
```json
[
  {
    "id": "C0001",
    "name": "My Local Cinema",
    "url": "https://www.allocine.fr/seance/salle_gen_csalle=C0001.html"
  }
]
```

**Option B: Use the API**:
```bash
curl -X POST http://localhost:3000/api/cinemas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"url":"https://www.allocine.fr/seance/salle_gen_csalle=C0001.html"}'
```

See [SCRAPER.md](../../reference/scraper.md) for cinema configuration details.

### 3. Run First Scrape

```bash
# Via API
curl -X POST http://localhost:3000/api/scraper/start

# Or use the web interface
# Navigate to http://localhost:5173 and click "Start Scrape"
```

### 4. Set Up Backups (Production)

```bash
# Test backup
./scripts/backup-production.sh \
  --host localhost \
  --user postgres \
  --database ics

# Set up automated daily backups
crontab -e

# Add this line (daily backup at 2 AM):
0 2 * * * /path/to/allo-scrapper/scripts/backup-production.sh --host localhost --user postgres
```

See [Backup & Restore Guide](../../guides/deployment/backup-restore.md) for complete backup setup.

---

## Verification

### Check All Services

```bash
# Docker Compose installation
docker compose ps

# Manual installation
curl http://localhost:3000/api/health
curl http://localhost:5173
```

### Run Tests

```bash
# Server tests
cd server
npm test

# E2E tests (requires running stack)
cd ..
npm run e2e
```

### Check Logs

```bash
# Docker Compose
docker compose logs

# Manual installation
# Check terminal where services are running
```

---

## Upgrading

### Docker Compose Method

```bash
# Pull latest code
git pull origin main

# Pull latest images
docker compose pull

# Restart services (runs migrations automatically)
docker compose down
docker compose up -d
```

### Manual Setup Method

```bash
# Pull latest code
git pull origin main

# Update dependencies
cd server && npm ci && cd ..
cd client && npm ci && cd ..

# Run database migrations
cd server && npm run db:migrate && cd ..

# Rebuild and restart
# Stop running services (Ctrl+C in terminals)
cd server && npm run build && cd ..
cd client && npm run build && cd ..

# Restart services
```

### Check Changelog

Always review [CHANGELOG.md](../../project/changelog.md) before upgrading for:
- Breaking changes
- Migration notes
- New features
- Configuration changes

---

## Uninstalling

### Docker Compose

```bash
# Stop services
docker compose down

# Remove volumes (deletes database data)
docker compose down -v

# Remove images
docker rmi $(docker images 'allo-scrapper*' -q)

# Remove repository
cd ..
rm -rf allo-scrapper
```

### Manual Setup

```bash
# Stop services (Ctrl+C in terminals)

# Drop database
dropdb ics

# Remove repository
cd ..
rm -rf allo-scrapper

# Optionally uninstall PostgreSQL
# (macOS) brew uninstall postgresql@15
# (Ubuntu) sudo apt remove postgresql-15
```

---

## Troubleshooting Installation

### Port Conflicts

If ports are already in use, change them in `.env`:
```bash
PORT=8080              # API server (default 3000)
POSTGRES_PORT=5433     # PostgreSQL (default 5432)
```

### Database Connection Errors

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql  # Linux
brew services list                # macOS

# Check connection
psql -h localhost -U postgres -d ics
```

### Permission Errors (Docker)

```bash
# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Fix volume permissions
sudo chown -R $USER:$USER .
```

### Build Failures

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules server/node_modules client/node_modules
npm run install:all
```

For more troubleshooting, see [Troubleshooting Guide](../../troubleshooting/).

---

## Next Steps

After installation:

- **[Configuration Guide](./configuration.md)** - Complete environment variable reference
- **[Quick Start Guide](./quick-start.md)** - Get familiar with basic usage
- **[Development Setup](../../guides/development/setup.md)** - Set up for contributing
- **[Production Deployment](../../guides/deployment/production.md)** - Production best practices
- **[API Reference](../../reference/api/)** - Explore the API

---

[← Back to Getting Started](./README.md) | [Next: Configuration →](./configuration.md)
