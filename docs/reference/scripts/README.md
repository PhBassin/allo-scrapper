# 🔧 Utility Scripts Reference

Complete reference for all utility scripts included in the Allo-Scrapper project.

**Related Documentation:**
- [Backup & Restore Guide](../../guides/deployment/backup-restore.md) - Detailed backup procedures
- [Docker Deployment](../../guides/deployment/docker.md) - Deployment setup
- [CI/CD Guide](../../guides/development/cicd.md) - Integration testing
- [Contributing Guide](../../guides/development/contributing.md) - Git hooks

---

## Table of Contents

- [Overview](#overview)
- [Backup Scripts](#backup-scripts)
- [Deployment Scripts](#deployment-scripts)
- [Development Scripts](#development-scripts)
- [Git Hooks](#git-hooks)
- [Docker Utilities](#docker-utilities)

---

## Overview

All scripts are located in the `scripts/` directory and are designed to be run from the repository root:

```bash
# Run scripts from repository root
./scripts/script-name.sh
```

**Prerequisites:**
- Bash shell (macOS, Linux, WSL on Windows)
- Docker and Docker Compose installed
- Git installed (for git hooks)
- PostgreSQL client tools (for direct DB access)

---

## Backup Scripts

### backup-db.sh

**Purpose:** Create a backup of the local development database.

**Usage:**
```bash
./scripts/backup-db.sh
```

**What it does:**
- Connects to the local PostgreSQL container (`ics-db`)
- Creates a timestamped SQL dump: `backup_YYYYMMDD_HHMMSS.sql`
- Saves to `backups/` directory (created if doesn't exist)
- Includes schema + data for all tables

**Output:**
```
✅ Backup created: backups/backup_20240315_143022.sql
```

**See also:** [Backup & Restore Guide](../../guides/deployment/backup-restore.md)

---

### backup-production.sh

**Purpose:** Create a backup of a remote production database via SSH.

**Usage:**
```bash
./scripts/backup-production.sh
```

**What it does:**
- Prompts for SSH connection details (user, host, port)
- Connects to remote server via SSH
- Creates a backup using `pg_dump` on remote server
- Downloads the backup to local `backups/` directory
- Cleans up remote temporary file

**Interactive prompts:**
```
Enter SSH user (default: root):
Enter SSH host (default: your-server.com):
Enter SSH port (default: 22):
```

**Output:**
```
🔄 Connecting to production server via SSH...
✅ Backup created on remote: /tmp/ics_backup_20240315_143022.sql
📥 Downloading backup...
✅ Production backup saved: backups/prod_backup_20240315_143022.sql
```

**Requirements:**
- SSH access to production server
- PostgreSQL client tools on production server
- Sufficient disk space on both local and remote

**See also:** [Production Backup Guide](../../guides/deployment/backup-restore.md#production-backups)

---

### list-backups.sh

**Purpose:** List all available backups with metadata.

**Usage:**
```bash
./scripts/list-backups.sh
```

**What it does:**
- Lists all `*.sql` files in `backups/` directory
- Displays file size, modification date
- Shows total backup count and disk usage

**Output:**
```
📦 Available Backups:

1. backup_20240315_143022.sql
   Size: 15.2 MB
   Date: 2024-03-15 14:30:22

2. prod_backup_20240314_120000.sql
   Size: 142.8 MB
   Date: 2024-03-14 12:00:00

Total backups: 2
Total size: 158 MB
```

---

### restore-db.sh

**Purpose:** Restore a local development database from a backup.

**Usage:**
```bash
./scripts/restore-db.sh [backup-file]
```

**Examples:**
```bash
# Interactive: choose from list
./scripts/restore-db.sh

# Direct: specify backup file
./scripts/restore-db.sh backups/backup_20240315_143022.sql
```

**What it does:**
- Lists available backups (if no file specified)
- Prompts for confirmation (destructive operation!)
- Drops and recreates the database
- Restores from the selected backup file

**Output:**
```
⚠️  WARNING: This will DELETE all current data!
Continue? (yes/no): yes
🔄 Restoring from backup_20240315_143022.sql...
✅ Database restored successfully
```

**See also:** [Restore Guide](../../guides/deployment/backup-restore.md#restoring-from-backups)

---

### restore-production.sh

**Purpose:** Restore a remote production database from a local backup via SSH.

**Usage:**
```bash
./scripts/restore-production.sh [backup-file]
```

**Examples:**
```bash
# Interactive: choose from list
./scripts/restore-production.sh

# Direct: specify backup file
./scripts/restore-production.sh backups/prod_backup_20240314_120000.sql
```

**What it does:**
- Prompts for SSH connection details
- Uploads the backup file to remote server
- Restores the database on production
- Cleans up remote temporary file

**Interactive prompts:**
```
Enter SSH user (default: root):
Enter SSH host (default: your-server.com):
Enter SSH port (default: 22):
⚠️  WARNING: This will DELETE all current production data!
Type 'RESTORE PRODUCTION' to confirm:
```

**Security:**
- Requires exact confirmation phrase to prevent accidents
- Double confirmation for production operations

**See also:** [Production Restore Guide](../../guides/deployment/backup-restore.md#restoring-production)

---

## Deployment Scripts

### pull-and-deploy.sh

**Purpose:** Pull latest Docker image and restart services.

**Usage:**
```bash
./scripts/pull-and-deploy.sh [tag]
```

**Examples:**
```bash
# Pull latest stable version
./scripts/pull-and-deploy.sh stable

# Pull specific version
./scripts/pull-and-deploy.sh v1.2.0

# Pull development version
./scripts/pull-and-deploy.sh latest
```

**What it does:**
1. Pulls specified Docker image from GitHub Container Registry
2. Stops running containers
3. Starts containers with new image
4. Shows logs to verify startup

**Output:**
```
🔄 Pulling ghcr.io/phbassin/allo-scrapper:stable...
⏬ Stopping containers...
🚀 Starting services...
✅ Deployment complete!
```

**See also:** [Docker Deployment Guide](../../guides/deployment/docker.md)

---

## Development Scripts

### integration-test.sh

**Purpose:** Run full-stack integration tests with Docker.

**Usage:**
```bash
./scripts/integration-test.sh
```

**What it does:**
1. Stops any running containers
2. Builds Docker images from source
3. Starts all services (web, database, Redis)
4. Waits for services to be healthy
5. Runs Playwright E2E tests
6. Stops containers and cleans up

**Output:**
```
🔧 Building Docker images...
🚀 Starting services...
⏳ Waiting for services to be ready...
✅ Services are healthy

🧪 Running Playwright tests...

Running 5 tests using 1 worker
  ✓ [chromium] › scrape-progress.spec.ts:3:1 › should display scrape progress window (1s)
  ✓ [chromium] › scrape-progress.spec.ts:15:1 › should show real-time progress updates (2s)

5 passed (3s)

🧹 Cleaning up...
✅ Integration tests complete!
```

**Environment:**
- Uses `docker-compose.yml` configuration
- Runs against real database and Redis
- Cleans up after completion

**See also:** [Testing Guide](../../guides/development/testing.md#integration-tests-e2e)

---

### install-hooks.sh

**Purpose:** Install Git hooks for pre-commit and pre-push checks.

**Usage:**
```bash
./scripts/install-hooks.sh
```

**What it does:**
- Copies pre-push hook from `scripts/hooks/` to `.git/hooks/`
- Makes hooks executable
- Configures automatic type-checking and testing before push

**Installed Hooks:**

**Pre-push hook:**
- Runs TypeScript type-checking (`tsc --noEmit`)
- Runs unit tests (`npm run test:run`)
- Blocks push if either fails

**Output:**
```
🔧 Installing Git hooks...
✅ Pre-push hook installed
✅ Git hooks installed successfully!
```

**Manual trigger:**
```bash
# Test what the hook will do (without pushing)
cd server
npx tsc --noEmit && npm run test:run
```

**See also:** [Contributing Guide](../../guides/development/contributing.md)

---

## Git Hooks

### hooks/pre-push

**Purpose:** Automatically run checks before every `git push`.

**Triggered by:** `git push` command

**What it does:**
1. Navigates to `server/` directory
2. Runs TypeScript type-checking
3. Runs unit tests
4. Allows push only if both pass

**Sample output:**
```
[pre-push] Running TypeScript type-check...
[pre-push] Type-check passed.
[pre-push] Running tests...
✓ 570 tests passed
[pre-push] All checks passed. Pushing...
```

**Bypass (not recommended):**
```bash
# Skip hooks (use only in emergencies)
git push --no-verify
```

**See also:** [Contributing Guide](../../guides/development/contributing.md)

---

## Docker Utilities

### cleanup-old-docker-images.sh

**Purpose:** Remove old Docker images to free up disk space.

**Usage:**
```bash
./scripts/cleanup-old-docker-images.sh
```

**What it does:**
- Lists all local `allo-scrapper` images
- Removes images older than 7 days (configurable)
- Keeps images with tags: `stable`, `latest`, `develop`
- Shows disk space freed

**Output:**
```
🧹 Cleaning up old Docker images...

Found 15 allo-scrapper images:
  - Removing sha-abc1234 (14 days old) ✓
  - Removing sha-def5678 (10 days old) ✓
  - Keeping stable (tagged) ✓
  - Keeping latest (tagged) ✓

Removed: 2 images
Freed: 1.2 GB disk space
```

**Configuration:**
```bash
# Edit script to change retention period
DAYS_TO_KEEP=7  # Default: 7 days
```

**See also:** [CI/CD Cleanup Guide](../../guides/development/cicd.md#cleanup-workflows)

---

## Script Permissions

All scripts should have execute permissions. If you encounter "Permission denied":

```bash
# Make script executable
chmod +x scripts/script-name.sh

# Or make all scripts executable
chmod +x scripts/*.sh
```

---

## Error Handling

### Common Issues

**"Docker daemon not running"**
```bash
# Start Docker Desktop or Docker daemon
sudo systemctl start docker  # Linux
# Or start Docker Desktop app (macOS/Windows)
```

**"Database connection refused"**
```bash
# Ensure containers are running
docker compose ps

# Start containers if needed
docker compose up -d
```

**"Permission denied" on macOS**
```bash
# Grant Full Disk Access to Terminal app
# System Settings → Privacy & Security → Full Disk Access
```

---

## Best Practices

1. **Always run from repository root:**
   ```bash
   # ✅ Good
   ./scripts/backup-db.sh
   
   # ❌ Bad
   cd scripts && ./backup-db.sh
   ```

2. **Review confirmation prompts carefully:**
   - Restore operations are destructive
   - Production operations require exact confirmation phrases

3. **Keep backups before major operations:**
   ```bash
   ./scripts/backup-db.sh
   ./scripts/restore-db.sh backups/backup_20240315.sql
   ```

4. **Test integration tests locally before pushing:**
   ```bash
   ./scripts/integration-test.sh
   ```

---

## Related Documentation

- [Backup & Restore Guide](../../guides/deployment/backup-restore.md) - Detailed backup procedures
- [Docker Deployment](../../guides/deployment/docker.md) - Container deployment
- [CI/CD Guide](../../guides/development/cicd.md) - Continuous integration
- [Testing Guide](../../guides/development/testing.md) - Test automation
- [Contributing Guide](../../guides/development/contributing.md) - Development workflow

---

[← Back to Reference Docs](./README.md) | [Back to Documentation](../README.md)
