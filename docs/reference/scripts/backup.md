# Backup Scripts Reference

Reference documentation for database backup scripts.

**Last updated:** March 6, 2026

**Related Documentation:**
- [Backup & Restore Guide](../../guides/deployment/backup-restore.md) - Step-by-step workflows
- [Database Troubleshooting](../../troubleshooting/database.md) - Backup/restore issues
- [Production Deployment](../../guides/deployment/production.md) - Production setup

---

## Table of Contents

- [Overview](#overview)
- [backup-db.sh](#backup-dbsh)
- [backup-production.sh](#backup-productionsh)
- [list-backups.sh](#list-backupssh)
- [Automated Backups](#automated-backups)

---

## Overview

Allo-Scrapper provides **three backup scripts** for different scenarios:

| Script | Purpose | Best For |
|--------|---------|----------|
| `backup-db.sh` | Local Docker database backup | Development, local testing |
| `backup-production.sh` | Remote SSH database backup | Production servers |
| `list-backups.sh` | List and inspect backups | Finding backups to restore |

**All backups**:
- Use PostgreSQL `pg_dump` format (SQL)
- Compressed with gzip (`.sql.gz`)
- Named with timestamps: `ics_YYYYMMDD_HHMMSS.sql.gz`
- Stored in `./backups/` directory

---

## backup-db.sh

**Location**: `scripts/backup-db.sh`

**Purpose**: Create a compressed backup of the local Docker database.

### Usage

```bash
./scripts/backup-db.sh
```

No arguments needed - uses Docker Compose to connect to `ics-db` container.

---

### What It Does

1. Creates `./backups/` directory if it doesn't exist
2. Checks if `ics-db` container is running
3. Runs `pg_dump` via Docker to export database
4. Compresses output with gzip
5. Saves to `./backups/ics_YYYYMMDD_HHMMSS.sql.gz`
6. Displays file size and backup count

---

### Example Output

```
🔄 Creating database backup...
📦 Dumping database to ./backups/ics_20260306_143052.sql...
🗜️  Compressing backup...
✅ Backup created successfully!
   File: ./backups/ics_20260306_143052.sql.gz
   Size: 1.2M
   Total backups in directory: 5

📋 Recent backups:
-rw-r--r-- 1 user user 1.2M Mar  6 14:30 ics_20260306_143052.sql.gz
-rw-r--r-- 1 user user 1.1M Mar  5 08:00 ics_20260305_080000.sql.gz
```

---

### Prerequisites

- Docker and Docker Compose installed
- `ics-db` container running (`docker compose up -d ics-db`)
- Write permissions in `./backups/` directory

---

### Errors

**"Database container is not running"**:
```bash
# Solution: Start the database container
docker compose up -d ics-db
```

---

### Backup Location

```
./backups/
├── ics_20260306_143052.sql.gz
├── ics_20260305_080000.sql.gz
└── ics_20260304_120000.sql.gz
```

---

## backup-production.sh

**Location**: `scripts/backup-production.sh`

**Purpose**: Create a backup of a remote production database via SSH.

### Usage

```bash
./scripts/backup-production.sh [ssh-connection] [remote-path]
```

**Arguments**:
- `ssh-connection` - SSH connection string (default: `user@ics.opalkad.com`)
- `remote-path` - Remote project directory (default: `~/allo-scrapper`)

**Examples**:
```bash
# Use defaults
./scripts/backup-production.sh

# Custom SSH connection
./scripts/backup-production.sh admin@example.com

# Custom SSH and path
./scripts/backup-production.sh admin@example.com /opt/allo-scrapper
```

---

### What It Does

1. Tests SSH connection to production server
2. Checks if remote `ics-db` container is running
3. Runs `pg_dump` on remote server via SSH
4. Streams compressed backup to local machine
5. Saves to `./backups/production/ics_production_YYYYMMDD_HHMMSS.sql.gz`
6. Creates SHA256 checksum file for verification

---

### Example Output

```
🌐 Production Database Backup
   SSH: user@ics.opalkad.com
   Remote path: ~/allo-scrapper
   Backup file: ics_production_20260306_143052.sql.gz

🔗 Testing SSH connection...
🐳 Checking remote Docker container...
💾 Creating backup on production server...

✅ Production backup completed successfully!
   File: ./backups/production/ics_production_20260306_143052.sql.gz
   Size: 5.3M
   SHA256: a1b2c3d4e5f6...

📋 List all production backups:
   ls -lh ./backups/production

🔄 Restore to local:
   ./scripts/restore-db.sh ./backups/production/ics_production_20260306_143052.sql.gz

🔄 Restore to production:
   ./scripts/restore-production.sh ./backups/production/ics_production_20260306_143052.sql.gz
```

---

### Prerequisites

- SSH access to production server (password or key-based)
- Remote `ics-db` container running
- SSH key authentication recommended for automation

**Set up SSH keys**:
```bash
# Generate SSH key (if you don't have one)
ssh-keygen -t ed25519

# Copy key to production server
ssh-copy-id user@ics.opalkad.com
```

---

### Backup Location

```
./backups/production/
├── ics_production_20260306_143052.sql.gz
├── ics_production_20260306_143052.sql.gz.sha256
├── ics_production_20260305_080000.sql.gz
└── ics_production_20260305_080000.sql.gz.sha256
```

---

### Checksum Verification

The script creates a SHA256 checksum file for each backup:

```bash
# Verify backup integrity
sha256sum -c ./backups/production/ics_production_20260306_143052.sql.gz.sha256

# Output:
# ics_production_20260306_143052.sql.gz: OK
```

---

## list-backups.sh

**Location**: `scripts/list-backups.sh`

**Purpose**: List available backups with metadata (size, date, age).

### Usage

```bash
./scripts/list-backups.sh
```

---

### Example Output

```
📋 Available Backups

Local backups (./backups/):
FILENAME                             SIZE    DATE            AGE
ics_20260306_143052.sql.gz          1.2M    Mar 06 14:30    0 days ago
ics_20260305_080000.sql.gz          1.1M    Mar 05 08:00    1 day ago
ics_20260304_120000.sql.gz          1.0M    Mar 04 12:00    2 days ago

Production backups (./backups/production/):
FILENAME                                      SIZE    DATE            AGE
ics_production_20260306_143052.sql.gz        5.3M    Mar 06 14:30    0 days ago
ics_production_20260305_080000.sql.gz        5.2M    Mar 05 08:00    1 day ago

Total: 5 backups (9.8M)
```

---

## Automated Backups

### Daily Backups with Cron

**Production server cron**:
```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * cd /opt/allo-scrapper && ./scripts/backup-db.sh >> /var/log/allo-scrapper-backup.log 2>&1
```

**Remote backup from local machine**:
```bash
# Daily production backup at 3 AM
0 3 * * * cd ~/allo-scrapper && ./scripts/backup-production.sh >> ~/backup-production.log 2>&1
```

---

### Retention Policy (Auto-Cleanup)

**Delete backups older than 30 days**:
```bash
# Add to cron (runs weekly on Sunday at 3 AM)
0 3 * * 0 find ./backups -name "ics_*.sql.gz" -mtime +30 -delete
```

**Manual cleanup**:
```bash
# Delete backups older than 7 days
find ./backups -name "ics_*.sql.gz" -mtime +7 -delete

# Keep only last 5 backups
ls -t ./backups/ics_*.sql.gz | tail -n +6 | xargs rm -f
```

---

## Backup Best Practices

1. **Regular schedule**: Backup daily (minimum) or after major changes
2. **Off-site storage**: Copy backups to another server or cloud storage
3. **Verify backups**: Periodically restore to test environment to ensure validity
4. **Retention policy**: Keep recent backups + monthly archives
5. **Document recovery**: Test restore procedures before disasters happen
6. **Checksum verification**: Always verify checksums before restoring

---

## Quick Reference

```bash
# Local backup
./scripts/backup-db.sh

# Production backup
./scripts/backup-production.sh

# List backups
./scripts/list-backups.sh

# Find specific backup
ls -lh ./backups/*20260306*

# Verify checksum
sha256sum -c ./backups/production/*.sha256
```

---

[← Back to Scripts Reference](./README.md)
