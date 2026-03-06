# Restore Scripts Reference

Reference documentation for database restore scripts.

**Last updated:** March 6, 2026

**Related Documentation:**
- [Backup & Restore Guide](../../guides/deployment/backup-restore.md) - Step-by-step workflows
- [Database Troubleshooting](../../troubleshooting/database.md) - Restore issues
- [Backup Scripts](./backup.md) - Creating backups

---

## Table of Contents

- [Overview](#overview)
- [restore-db.sh](#restore-dbsh)
- [restore-production.sh](#restore-productionsh)
- [Safety Features](#safety-features)
- [Troubleshooting](#troubleshooting)

---

## Overview

Allo-Scrapper provides **two restore scripts** for different scenarios:

| Script | Purpose | Best For |
|--------|---------|----------|
| `restore-db.sh` | Restore to local Docker database | Development, testing |
| `restore-production.sh` | Restore to remote production via SSH | Production recovery |

**Safety Features**:
- ✅ Interactive confirmation required
- ✅ Automatic safety backup before restore
- ✅ Service shutdown during restore (prevents data corruption)
- ✅ Checksum verification (production only)

---

## restore-db.sh

**Location**: `scripts/restore-db.sh`

**Purpose**: Restore a backup to the local Docker database.

### Usage

```bash
./scripts/restore-db.sh <backup-file>
```

**Arguments**:
- `backup-file` - Path to backup file (`.sql` or `.sql.gz`)

**Examples**:
```bash
# Restore from compressed backup
./scripts/restore-db.sh ./backups/ics_20260306_143052.sql.gz

# Restore from uncompressed backup
./scripts/restore-db.sh ./backups/ics_20260306_143052.sql

# Restore production backup to local
./scripts/restore-db.sh ./backups/production/ics_production_20260306_143052.sql.gz
```

---

### What It Does

1. **Validates** backup file exists
2. **Prompts** for confirmation (shows file path)
3. **Checks** if `ics-db` container is running
4. **Stops** `ics-web` service (prevents active connections)
5. **Creates** safety backup before restore
6. **Restores** database from backup file
7. **Restarts** `ics-web` service
8. **Displays** verification commands

---

### Example Output

```
⚠️  WARNING: This will replace the current database!
   Backup file: ./backups/ics_20260306_143052.sql.gz

Are you sure you want to continue? (yes/no): yes

🛑 Stopping web service...
💾 Creating safety backup before restore...
   Safety backup saved: ./backups/before_restore_20260306_144523.sql.gz
🔄 Restoring database...
🚀 Restarting web service...

✅ Database restored successfully!

🔍 Verify with:
   docker compose exec ics-db psql -U postgres ics -c 'SELECT COUNT(*) FROM films;'
```

---

### Interactive Confirmation

The script requires **explicit confirmation** before proceeding:

```
Are you sure you want to continue? (yes/no): 
```

**Type "yes" to proceed**, anything else cancels the restore.

---

### Safety Backup

Before restoring, the script **automatically creates a safety backup** of the current database:

```
💾 Creating safety backup before restore...
   Safety backup saved: ./backups/before_restore_20260306_144523.sql.gz
```

This allows you to **rollback** if the restore causes issues:

```bash
# Rollback to state before restore
./scripts/restore-db.sh ./backups/before_restore_20260306_144523.sql.gz
```

---

### Prerequisites

- Docker and Docker Compose installed
- `ics-db` container running
- Valid backup file (`.sql` or `.sql.gz`)

---

### Errors

**"Database container is not running"**:
```bash
# Solution: Start the database
docker compose up -d ics-db
```

**"Backup file not found"**:
```bash
# Solution: Check file path
ls -lh ./backups/

# List available backups
./scripts/list-backups.sh
```

---

## restore-production.sh

**Location**: `scripts/restore-production.sh`

**Purpose**: Restore a backup to a remote production database via SSH.

### Usage

```bash
./scripts/restore-production.sh <backup-file> [ssh-connection] [remote-path]
```

**Arguments**:
- `backup-file` - Path to backup file (required)
- `ssh-connection` - SSH connection string (default: `user@ics.opalkad.com`)
- `remote-path` - Remote project directory (default: `~/allo-scrapper`)

**Examples**:
```bash
# Restore with defaults
./scripts/restore-production.sh ./backups/production/ics_production_20260306_143052.sql.gz

# Custom SSH connection
./scripts/restore-production.sh ./backups/ics_20260306.sql.gz admin@example.com

# Custom SSH and path
./scripts/restore-production.sh ./backups/ics_20260306.sql.gz admin@example.com /opt/allo-scrapper
```

---

### What It Does

1. **Validates** backup file exists
2. **Verifies** checksum if `.sha256` file exists
3. **Prompts** for confirmation (shows SSH details)
4. **Tests** SSH connection
5. **Checks** if remote `ics-db` container is running
6. **Creates** safety backup on production server
7. **Stops** remote `ics-web` service
8. **Uploads** backup to production server
9. **Restores** database on production
10. **Restarts** remote `ics-web` service
11. **Verifies** restore success

---

### Example Output

```
🔍 Verifying backup integrity...
✅ Checksum verified

⚠️  WARNING: This will replace the PRODUCTION database!
   SSH: user@ics.opalkad.com
   Remote path: ~/allo-scrapper
   Backup file: ./backups/production/ics_production_20260306_143052.sql.gz

   This operation will:
   1. Create a safety backup on production
   2. Stop the production web service
   3. Restore the database
   4. Restart the production web service

Are you ABSOLUTELY SURE you want to continue? Type 'yes' to proceed: yes

🔗 Testing SSH connection...
🐳 Checking remote Docker container...
💾 Creating safety backup on production...
   Safety backup: /tmp/ics_production_backup_20260306_144523.sql.gz
📤 Uploading backup to production...
🔄 Restoring database on production...
🚀 Restarting production web service...

✅ Production database restored successfully!

🔍 Verify with:
   ssh user@ics.opalkad.com 'cd ~/allo-scrapper && docker compose exec ics-db psql -U postgres ics -c "SELECT COUNT(*) FROM films;"'
```

---

### Checksum Verification

If a `.sha256` file exists alongside the backup, the script **automatically verifies** integrity:

```
🔍 Verifying backup integrity...
✅ Checksum verified
```

**If verification fails**:
```
❌ Error: Backup file checksum verification failed!
   The backup file may be corrupted.
```

The restore **will not proceed** if checksum verification fails.

---

### Interactive Confirmation

The script requires **very explicit confirmation** for production restores:

```
Are you ABSOLUTELY SURE you want to continue? Type 'yes' to proceed:
```

**You must type exactly "yes"** - anything else cancels the restore.

---

### Safety Backup (Production)

The script creates a safety backup **on the production server** before restoring:

```
💾 Creating safety backup on production...
   Safety backup: /tmp/ics_production_backup_20260306_144523.sql.gz
```

**Download safety backup** if needed:
```bash
# Download from production
scp user@ics.opalkad.com:/tmp/ics_production_backup_20260306_144523.sql.gz ./backups/production/
```

---

### Prerequisites

- SSH access to production server (key-based authentication recommended)
- Remote `ics-db` container running
- Valid backup file with checksum (recommended)

**Set up SSH keys**:
```bash
# Generate SSH key (if you don't have one)
ssh-keygen -t ed25519

# Copy key to production server
ssh-copy-id user@ics.opalkad.com
```

---

### Errors

**"Cannot connect to production server"**:
```bash
# Solution: Set up SSH key authentication
ssh-copy-id user@ics.opalkad.com

# Test connection
ssh user@ics.opalkad.com "echo 'Connection successful'"
```

**"Database container is not running on production"**:
```bash
# Solution: Start remote database
ssh user@ics.opalkad.com 'cd ~/allo-scrapper && docker compose up -d ics-db'
```

---

## Safety Features

### 1. Confirmation Prompts

Both scripts require **explicit user confirmation** before proceeding:

- `restore-db.sh`: Type **"yes"**
- `restore-production.sh`: Type **"yes"** (more emphatic warning)

---

### 2. Automatic Safety Backups

Both scripts **automatically create a safety backup** before restoring:

| Script | Safety Backup Location |
|--------|------------------------|
| `restore-db.sh` | `./backups/before_restore_YYYYMMDD_HHMMSS.sql.gz` |
| `restore-production.sh` | `/tmp/ics_production_backup_YYYYMMDD_HHMMSS.sql.gz` (on production) |

---

### 3. Service Shutdown

Both scripts **stop the web service** during restore to prevent:
- Active database connections interfering with restore
- Users experiencing errors during restore
- Data corruption from concurrent writes

---

### 4. Checksum Verification (Production)

`restore-production.sh` verifies backup integrity **before** restoring:

```
🔍 Verifying backup integrity...
✅ Checksum verified
```

If no `.sha256` file exists, a warning is shown but restore can proceed.

---

## Troubleshooting

### Restore Hangs or Times Out

**Cause**: Large backup file + slow network

**Solution**:
```bash
# Increase SSH timeout
ssh -o ServerAliveInterval=60 user@ics.opalkad.com

# Or restore on production directly
ssh user@ics.opalkad.com
cd ~/allo-scrapper
./scripts/restore-db.sh /path/to/backup.sql.gz
```

---

### Restore Fails with "relation already exists"

**Cause**: Backup contains `CREATE TABLE` statements for existing tables

**Solution**: Use `--clean` option (requires manual `pg_restore`):

```bash
# Extract backup
gunzip backup.sql.gz

# Edit SQL file to add DROP TABLE statements
# Or use pg_restore with --clean flag (for custom format backups)
```

---

### Service Won't Restart After Restore

**Cause**: Database migrations failed or schema incompatible

**Check logs**:
```bash
docker compose logs ics-web

# Look for migration errors
```

**Solution**:
```bash
# Rollback to safety backup
./scripts/restore-db.sh ./backups/before_restore_YYYYMMDD_HHMMSS.sql.gz
```

---

## Quick Reference

```bash
# Restore to local
./scripts/restore-db.sh ./backups/ics_20260306_143052.sql.gz

# Restore to production
./scripts/restore-production.sh ./backups/production/ics_production_20260306_143052.sql.gz

# Rollback (use safety backup)
./scripts/restore-db.sh ./backups/before_restore_20260306_144523.sql.gz

# Verify restore
docker compose exec ics-db psql -U postgres ics -c 'SELECT COUNT(*) FROM films;'

# Test database connectivity
docker compose exec ics-db psql -U postgres ics -c 'SELECT version();'
```

---

[← Back to Scripts Reference](./README.md)
