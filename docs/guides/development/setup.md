# Development Setup

Complete guide for setting up a local development environment for Allo-Scrapper.

**Last updated:** March 6, 2026

**Related Documentation:**
- [Installation Guide](../../getting-started/installation.md) - Docker and production setup
- [Quick Start](../../getting-started/quick-start.md) - Get running in 5 minutes
- [Testing Guide](./testing.md) - Running and writing tests
- [Contributing Guide](./contributing.md) - Contribution workflow

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Clone Repository](#clone-repository)
- [Install Dependencies](#install-dependencies)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Git Hooks](#git-hooks)
- [IDE Setup](#ide-setup)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

| Software | Minimum Version | Installation |
|----------|----------------|--------------|
| **Node.js** | 20.x | [Download](https://nodejs.org/) |
| **npm** | 10.x | Included with Node.js |
| **Git** | 2.x | [Download](https://git-scm.com/) |
| **Docker** | 24.x | [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine |
| **Docker Compose** | v2.x | Included with Docker Desktop |

### Optional Software

| Software | Purpose | Installation |
|----------|---------|--------------|
| **PostgreSQL** | Local database (alternative to Docker) | [Download](https://www.postgresql.org/download/) |
| **Redis** | Microservice scraper mode | [Download](https://redis.io/download) |
| **VS Code** | Recommended IDE | [Download](https://code.visualstudio.com/) |

### System Requirements

- **OS**: Linux, macOS, or Windows (with WSL2 for Docker)
- **RAM**: 4 GB minimum (8 GB recommended)
- **Disk**: 5 GB free space

---

## Clone Repository

```bash
# Clone the repository
git clone https://github.com/PhBassin/allo-scrapper.git
cd allo-scrapper

# Verify you're on the develop branch
git checkout develop
git pull origin develop
```

---

## Install Dependencies

**CRITICAL**: Install dependencies from the correct directories.

```bash
# Install root dependencies (Playwright E2E tests)
npm install

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install

# Return to root
cd ..
```

### Common Installation Issues

**Problem**: `sharp` package fails to install
```bash
# Solution: Always install from server/ directory
cd server && npm install
```

**Problem**: Native module errors
```bash
# Solution: Rebuild native modules
cd server
rm -rf node_modules package-lock.json
npm install
```

---

## Environment Configuration

### 1. Create Environment File

```bash
# Copy example environment file
cp .env.example .env
```

### 2. Configure Essential Variables

Edit `.env` and update these critical settings:

```bash
# Database (when using Docker)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=ics
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password

# Server
PORT=3000
NODE_ENV=development

# CORS (required for Vite dev server)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# JWT Secret (generate secure secret for production)
JWT_SECRET=dev-secret-key-change-in-prod

# Client API URL (for Vite dev server)
VITE_API_BASE_URL=http://localhost:3000/api

# Auto-migrations (recommended for development)
AUTO_MIGRATE=true
```

### 3. Generate Secure JWT Secret (Optional for Dev)

```bash
# Using OpenSSL
openssl rand -base64 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Database Setup

You can run PostgreSQL via **Docker** (recommended) or install it **locally**.

### Option A: Docker Database (Recommended)

```bash
# Start PostgreSQL container
docker compose up -d ics-db

# Verify database is running
docker compose ps

# View database logs
docker compose logs ics-db
```

The database will be available at `localhost:5432` with credentials from `.env`.

**Auto-migrations enabled**: The server will automatically create tables and seed the admin user on first startup.

### Option B: Local PostgreSQL

If you prefer a local PostgreSQL installation:

```bash
# Create database
psql -U postgres -c "CREATE DATABASE ics;"

# Update .env to use local database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
```

---

## Running the Application

### Development Mode (Recommended)

**Option 1: Full Stack with Docker (Easiest)**

```bash
# Start all services (database, server, client)
npm run dev

# View logs
npm run dev:logs

# Stop services
npm run dev:down
```

This starts:
- PostgreSQL on port 5432
- Express API on port 3000
- React dev server (Vite) on port 5173

**Access the app**: http://localhost:5173

---

**Option 2: Manual Start (More Control)**

Start each component separately for maximum control:

```bash
# Terminal 1: Start database
docker compose up ics-db

# Terminal 2: Start API server (with hot reload)
cd server && npm run dev

# Terminal 3: Start client (with Vite HMR)
cd client && npm run dev
```

**Access the app**: http://localhost:5173

---

### Running the Scraper

**In-process scraper (default)**:
```bash
# Trigger a scrape via API
curl -X POST http://localhost:3000/api/scraper/trigger \
  -H "Authorization: Bearer <token>"
```

**Scraper microservice (optional)**:
```bash
# Enable Redis scraper in .env
USE_REDIS_SCRAPER=true

# Start Redis
docker compose up -d ics-redis

# Start scraper microservice
cd scraper && npm run dev
```

---

### Running Tests

```bash
# Server tests (Vitest)
cd server && npm test              # Watch mode
cd server && npm run test:run      # Single run
cd server && npm run test:coverage # With coverage

# Client tests
cd client && npm test

# Scraper microservice tests
cd scraper && npm test

# E2E tests (Playwright)
npm run e2e                        # Headless
npm run e2e:headed                 # With browser
npm run e2e:ui                     # Interactive UI
```

---

## Git Hooks

### Install Pre-Push Hook

The pre-push hook runs TypeScript type checking and tests before every push.

```bash
# Install hooks
./scripts/install-hooks.sh

# Verify hook is installed
ls -la .git/hooks/pre-push
```

### What the Hook Does

Before every `git push`, it automatically runs:
1. `tsc --noEmit` - TypeScript type checking
2. `npm run test:run` - All unit tests

**If either fails, the push is blocked** until you fix the issues.

### Bypass Hook (Emergency Only)

```bash
# Skip hook (NOT recommended)
git push --no-verify
```

---

## IDE Setup

### Visual Studio Code (Recommended)

**Recommended Extensions:**

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",           // ESLint
    "esbenp.prettier-vscode",           // Prettier
    "ms-vscode.vscode-typescript-next", // TypeScript
    "bradlc.vscode-tailwindcss",        // Tailwind CSS
    "humao.rest-client",                // HTTP requests
    "mtxr.sqltools",                    // SQL tools
    "mtxr.sqltools-driver-pg"           // PostgreSQL driver
  ]
}
```

**Workspace Settings** (`.vscode/settings.json`):

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

---

## Troubleshooting

### Database Connection Errors

**Symptom**: `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Solutions**:
```bash
# Verify database is running
docker compose ps

# Check database logs
docker compose logs ics-db

# Restart database
docker compose restart ics-db

# Verify connection settings in .env
echo $POSTGRES_HOST $POSTGRES_PORT
```

---

### Port Already in Use

**Symptom**: `Error: listen EADDRINUSE: address already in use :::3000`

**Solutions**:
```bash
# Find process using the port
lsof -i :3000        # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill the process
kill -9 <PID>        # macOS/Linux
taskkill /PID <PID> /F  # Windows

# Or use a different port in .env
PORT=3001
```

---

### Tests Failing After Fresh Install

**Symptom**: `Error: Cannot find package 'sharp'`

**Solution**:
```bash
# Reinstall dependencies from correct directory
cd server
rm -rf node_modules
npm install
```

See [Native Dependencies gotcha](../../project/agents.md#native-dependencies--sharp-package) for details.

---

### Hot Reload Not Working

**Vite not updating**:
```bash
# Clear Vite cache
cd client
rm -rf node_modules/.vite
npm run dev
```

**Nodemon not restarting**:
```bash
# Check nodemon.json configuration
cat server/nodemon.json

# Restart manually
cd server && npm run dev
```

---

## Default Credentials

After first startup, the system creates a default admin user:

- **Username**: `admin`
- **Password**: `admin`

**⚠️ Change these immediately in production!**

Access the admin panel at: http://localhost:5173/admin

---

## Next Steps

Now that your development environment is ready:

1. **Read the contributing guide**: [Contributing](./contributing.md)
2. **Understand the workflow**: [CI/CD](./cicd.md)
3. **Learn about testing**: [Testing Guide](./testing.md)
4. **Explore the architecture**: [Architecture Docs](../../reference/architecture/)

---

## Quick Reference

```bash
# Start development environment
npm run dev

# Run tests
cd server && npm test

# Install git hooks
./scripts/install-hooks.sh

# Create a feature branch
git checkout develop
git checkout -b feature/<issue-number>-description

# Default login
# Username: admin
# Password: admin
```

---

[← Back to Development Guides](./README.md)
