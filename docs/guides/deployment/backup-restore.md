# Database Backup & Restore

Comprehensive backup and restore workflows for both local development and production environments.

**Related Guides:**
- [Production Deployment](./production.md) - Full production setup
- [Docker Setup](./docker.md) - Container management
- [Monitoring](./monitoring.md) - Observability stack

---

## Table of Contents

- [Quick Reference](#quick-reference)
- [Features](#features)
- [Local Backup & Restore](#local-backup--restore)
- [Production Backup & Restore](#production-backup--restore)
- [Backup Scripts](#backup-scripts)
- [Backup Storage](#backup-storage)
- [Common Workflows](#common-workflows)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [Manual Commands](#manual-commands)

---

## Quick Reference

```bash
# Local Development
./scripts/backup-db.sh                    # Create local backup
./scripts/restore-db.sh <backup-file>     # Restore local database
./scripts/list-backups.sh                 # List all backups

# Production (via SSH)
./scripts/backup-production.sh            # Backup from production
./scripts/restore-production.sh <file>    # Restore to production
```

---

## Features

✅ **Local & Production Support** - Works with both Docker and remote SSH  
✅ **Safety Backups** - Automatic backup before restore  
✅ **Integrity Verification** - SHA256 checksums for production backups  
✅ **Compression** - gzip compression saves ~90% space  
✅ **No Auto-deletion** - All backups kept indefinitely  
✅ **Error Handling** - Comprehensive checks and error messages  

---

## Local Backup & Restore

### Create Local Backup

```bash
# Create compressed backup of local database
./scripts/backup-db.sh

# Example output:
# 🔄 Creating database backup...
# 📦 Dumping database to ./backups/ics_20260301_143022.sql...
# 🗜️  Compressing backup...
# ✅ Backup created successfully!
#    File: ./backups/ics_20260301_143022.sql.gz
#    Size: 1.2M
#    Total backups in directory: 5
```

**Features:**
- Compressed with gzip (saves ~90% space)
- Timestamped filename: `ics_YYYYMMDD_HHMMSS.sql.gz`
- Stored in `./backups/` directory
- All backups kept indefinitely (no auto-deletion)
- Automatic error handling

**Output:**
- Backup file: `./backups/ics_YYYYMMDD_HHMMSS.sql.gz`
- Compressed with gzip
- Displays file size and total backups

---

### Restore Local Database

```bash
# List available backups
./scripts/list-backups.sh

# Restore from backup (with safety backup)
./scripts/restore-db.sh ./backups/ics_20260301_143022.sql.gz

# Example output:
# ⚠️  WARNING: This will replace the current database!
#    Backup file: ./backups/ics_20260301_143022.sql.gz
# 
# Are you sure you want to continue? (yes/no): yes
# 💾 Creating safety backup before restore...
#    Safety backup saved: ./backups/before_restore_20260301_143530.sql.gz
# 🛑 Stopping web service...
# 🔄 Restoring database...
# 🚀 Restarting web service...
# ✅ Database restored successfully!
# 
# 🔍 Verify with:
#    docker compose exec ics-db psql -U postgres ics -c 'SELECT COUNT(*) FROM films;'
```

**Features:**
- Automatic safety backup before restore
- Stops web service during restore (prevents connection errors)
- Supports both `.sql` and `.sql.gz` files
- Interactive confirmation prompt
- Automatic service restart after restore
- Verification command provided

---

## Production Backup & Restore

### Prerequisites

Set up SSH key authentication to your production server:

```bash
# Generate SSH key (if you don't have one)
ssh-keygen -t ed25519 -C "your-email@example.com"

# Copy public key to production server
ssh-copy-id user@ics.opalkad.com

# Test connection (should not ask for password)
ssh user@ics.opalkad.com "echo 'SSH connection successful'"
```

---

### Create Production Backup

```bash
# Backup from production (default: user@ics.opalkad.com ~/allo-scrapper)
./scripts/backup-production.sh

# Custom SSH connection and path
./scripts/backup-production.sh myuser@production.example.com /opt/allo-scrapper

# Example output:
# 🌐 Production Database Backup
#    SSH: user@ics.opalkad.com
#    Remote path: ~/allo-scrapper
#    Backup file: ics_production_20260301_143022.sql.gz
# 
# 🔗 Testing SSH connection...
# 🐳 Checking remote Docker container...
# 💾 Creating backup on production server...
# ✅ Production backup completed successfully!
#    File: ./backups/production/ics_production_20260301_143022.sql.gz
#    Size: 2.4M
#    SHA256: a1b2c3d4e5f6789...
```

**Default values:**
- SSH connection: `user@ics.opalkad.com`
- Remote path: `~/allo-scrapper`

**Output:**
- Backup file: `./backups/production/ics_production_YYYYMMDD_HHMMSS.sql.gz`
- SHA256 checksum: `./backups/production/ics_production_YYYYMMDD_HHMMSS.sql.gz.sha256`

**Features:**
- Downloads backup via SSH
- Stored in `./backups/production/` directory
- SHA256 checksum for integrity verification
- Tests SSH connection before starting
- Verifies remote Docker container is running
- All backups kept indefinitely

---

### Restore to Production

**⚠️ DANGER: This replaces the production database. Use with extreme caution!**

```bash
# Restore production from backup
./scripts/restore-production.sh ./backups/production/ics_production_20260301_143022.sql.gz

# Custom SSH connection and path
./scripts/restore-production.sh ./backups/ics_local_20260301_120000.sql.gz myuser@production.example.com /opt/allo-scrapper

# Example output:
# ⚠️  WARNING: This will replace the PRODUCTION database!
#    SSH: user@ics.opalkad.com
#    Remote path: ~/allo-scrapper
#    Backup file: ./backups/production/ics_production_20260301_143022.sql.gz
# 
#    This operation will:
#    1. Create a safety backup on production
#    2. Stop the production web service
#    3. Restore the database
#    4. Restart the production web service
# 
# Are you ABSOLUTELY SURE you want to continue? Type 'yes' to proceed: yes
# 
# 🔍 Verifying backup integrity...
# ✅ Checksum verified
# 🔗 Testing SSH connection...
# 🐳 Checking remote Docker container...
# 💾 Creating safety backup on production...
#    Safety backup saved on production: ~/allo-scrapper/backups/before_restore_production_20260301_143530.sql.gz
# 🛑 Stopping production web service...
# 📤 Uploading backup to production...
# 🔄 Restoring database on production...
# 🧹 Cleaning up...
# 🚀 Restarting production web service...
# 🔍 Verifying restore...
# ✅ Production database restored successfully!
#    Films in database: 1234
#    Safety backup saved: ~/allo-scrapper/backups/before_restore_production_20260301_143530.sql.gz
```

**Features:**
- SHA256 checksum verification before upload
- Creates safety backup on production before restore
- Stops production web service during restore
- Uploads backup via SCP
- Restores database on remote server
- Automatic cleanup of temporary files
- Verification of restored data
- Provides command to download safety backup

---

## Backup Scripts

### `backup-db.sh`

Create a compressed backup of the local database.

**Usage:**
```bash
./scripts/backup-db.sh
```

**What it does:**
1. Creates timestamped SQL dump in `backups/` directory
2. Compresses with gzip
3. Displays file size and total backups

---

### `restore-db.sh`

Restore the local database from a backup file.

**Usage:**
```bash
./scripts/restore-db.sh <backup-file>
```

**What it does:**
1. Creates safety backup before restore
2. Stops web service
3. Drops and recreates database
4. Restores from backup
5. Restarts application

**⚠️ Warning:** This is a destructive operation. All current data will be lost.

---

### `backup-production.sh`

Download a backup from the production server via SSH.

**Usage:**
```bash
./scripts/backup-production.sh [ssh-connection] [remote-path]
```

**What it does:**
1. Tests SSH connection
2. Verifies Docker container on production
3. Creates backup on production server
4. Downloads backup via SCP
5. Generates SHA256 checksum
6. Cleans up temporary files on production

---

### `restore-production.sh`

Restore a backup to the production server via SSH.

**Usage:**
```bash
./scripts/restore-production.sh <backup-file> [ssh-connection] [remote-path]
```

**What it does:**
1. Verifies backup integrity (SHA256)
2. Creates safety backup on production
3. Stops production web service
4. Uploads backup to production
5. Restores database
6. Restarts production web service
7. Verifies restored data

---

### `list-backups.sh`

List all local and production backups with details.

**Usage:**
```bash
./scripts/list-backups.sh              # List all backups
./scripts/list-backups.sh --local      # List only local backups
./scripts/list-backups.sh --production # List only production backups
```

**Example output:**
```bash
📋 Database Backups

🏠 Local Backups (./backups)

   FILENAME                                           SIZE         DATE                
   -------------------------------------------------- ------------ --------------------
   before_restore_20260301_143530.sql.gz             1.2M         2026-03-01 14:35:30
   ics_20260301_143022.sql.gz                        1.2M         2026-03-01 14:30:22
   ics_20260228_120000.sql.gz                        1.1M         2026-02-28 12:00:00

🌐 Production Backups (./backups/production)

   FILENAME                                           SIZE         DATE                
   -------------------------------------------------- ------------ --------------------
   ics_production_20260301_143022.sql.gz             2.4M         2026-03-01 14:30:22 ✓
   ics_production_20260228_090000.sql.gz             2.3M         2026-02-28 09:00:00 ✓

📊 Summary

   Local backups: 3 files (3.5M total)
   Production backups: 2 files (4.7M total)

💡 Usage:
   Restore local backup:      ./scripts/restore-db.sh <backup-file>
   Restore to production:     ./scripts/restore-production.sh <backup-file>
   Create local backup:       ./scripts/backup-db.sh
   Create production backup:  ./scripts/backup-production.sh
```

**Note:** The ✓ symbol indicates a SHA256 checksum file exists.

---

## Backup Storage

Backups are organized in the following structure:

```
./backups/
├── ics_20260301_143022.sql.gz                    # Local backup
├── ics_20260228_120000.sql.gz                    # Local backup
├── before_restore_20260301_143530.sql.gz         # Safety backup
└── production/
    ├── ics_production_20260301_143022.sql.gz     # Production backup
    ├── ics_production_20260301_143022.sql.gz.sha256  # Checksum
    ├── ics_production_20260228_090000.sql.gz     # Production backup
    └── ics_production_20260228_090000.sql.gz.sha256  # Checksum
```

**Important:**
- All backups are kept indefinitely (no automatic deletion)
- You must manually delete old backups if needed
- The `./backups/` directory is excluded from git (see `.gitignore`)
- Production backups include SHA256 checksums for integrity verification
- Safety backups are created automatically before any restore operation

---

## Common Workflows

### Before Deploying to Production

```bash
# 1. Backup production database
./scripts/backup-production.sh

# 2. Deploy your changes
git push production main

# 3. If something goes wrong, restore from backup
./scripts/restore-production.sh ./backups/production/ics_production_YYYYMMDD_HHMMSS.sql.gz
```

---

### Copy Production Data to Local

```bash
# 1. Backup production
./scripts/backup-production.sh

# 2. Restore to local
./scripts/restore-db.sh ./backups/production/ics_production_YYYYMMDD_HHMMSS.sql.gz
```

---

### Test Local Changes Before Production

```bash
# 1. Backup local database
./scripts/backup-db.sh

# 2. Test your changes locally
# ... make changes ...

# 3. If something breaks, restore
./scripts/restore-db.sh ./backups/ics_YYYYMMDD_HHMMSS.sql.gz
```

---

### Complete System Backup

For a complete system backup (config + database):

```bash
# Create complete backup
tar -czf allo-scrapper-complete-$(date +%Y%m%d).tar.gz \
  .env \
  docker-compose.yml \
  server/src/config/cinemas.json \
  backups/

# Restore from complete backup
tar -xzf allo-scrapper-complete-20260301.tar.gz
```

---

## Best Practices

### 1. Regular Backups

- Create production backups before each deployment
- Create local backups before testing destructive operations
- Keep multiple versions for different time periods

### 2. Verify Backups

- Production backups include SHA256 checksums
- Periodically test restores on non-production environment
- Verify backup file sizes are reasonable (not 0 bytes)

### 3. Safety

- Safety backups created automatically before restore
- Always test restore process on local environment first
- Never restore to production without confirmation prompt

### 4. Storage

- Store production backups in `./backups/production/`
- Keep local backups separate from production backups
- Consider external backup storage for disaster recovery

### 5. SSH Security

- Use SSH key authentication (not passwords)
- Restrict SSH key permissions: `chmod 600 ~/.ssh/id_ed25519`
- Use a dedicated backup user on production server

---

## Troubleshooting

### SSH Connection Failed

**Problem:** Cannot connect to production server

**Solution:**
```bash
# Set up SSH key authentication
ssh-keygen -t ed25519 -C "your-email@example.com"
ssh-copy-id user@ics.opalkad.com

# Test connection
ssh user@ics.opalkad.com "echo 'Connection successful'"
```

---

### Database Container Not Running

**Problem:** Database container is not running

**Solution:**
```bash
# Local
docker compose up -d ics-db

# Production
ssh user@ics.opalkad.com "cd ~/allo-scrapper && docker compose up -d ics-db"
```

---

### Backup File Empty or Corrupted

**Problem:** Backup file is 0 bytes or corrupted

**Solution:**
```bash
# Check container logs
docker compose logs ics-db | tail -50

# Check disk space
df -h

# Try manual backup
docker compose exec -T ics-db pg_dump -U postgres ics > test-backup.sql

# Verify backup integrity (production backups only)
sha256sum -c ./backups/production/ics_production_20260301_143022.sql.gz.sha256
```

---

### Restore Failed

**Problem:** Restore fails with errors

**Solution:**
```bash
# Test if backup file is valid
gunzip -t ./backups/ics_20260301_143022.sql.gz

# Check database logs
docker compose logs ics-db | tail -100

# Restore from safety backup
./scripts/restore-db.sh ./backups/before_restore_20260301_143530.sql.gz
```

---

### Checksum Verification Failed

**Problem:** SHA256 checksum doesn't match

**Solution:**
```bash
# Manually verify checksum
sha256sum ./backups/production/ics_production_20260301_143022.sql.gz
cat ./backups/production/ics_production_20260301_143022.sql.gz.sha256

# If corrupted, create a new backup
./scripts/backup-production.sh
```

---

### Production Service Won't Start After Restore

**Problem:** Web service won't start after production restore

**Solution:**
```bash
# Check production logs via SSH
ssh user@ics.opalkad.com "cd ~/allo-scrapper && docker compose logs ics-web | tail -50"

# Restart all services
ssh user@ics.opalkad.com "cd ~/allo-scrapper && docker compose restart"
```

---

## Manual Commands

If you need to create backups manually without using the scripts:

```bash
# Local backup
docker compose exec -T ics-db pg_dump -U postgres ics | gzip > ./backups/manual_$(date +%Y%m%d_%H%M%S).sql.gz

# Production backup (via SSH)
ssh user@ics.opalkad.com "cd ~/allo-scrapper && docker compose exec -T ics-db pg_dump -U postgres ics" | gzip > ./backups/production/manual_$(date +%Y%m%d_%H%M%S).sql.gz

# Local restore
gunzip -c ./backups/manual_20260301_143022.sql.gz | docker compose exec -T ics-db psql -U postgres ics
```

---

## Related Documentation

- [Production Deployment](./production.md) - Full deployment guide
- [Docker Setup](./docker.md) - Container management
- [../../reference/database.md](../../reference/database.md) - Database schema
- [../../project/scripts.md](../../project/scripts.md) - Complete script reference

---

[← Back to Deployment Guides](./README.md)
