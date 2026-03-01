# Database Backup Scripts

Comprehensive backup and restore scripts for both local development and production environments.

## Quick Start

```bash
# Local Development
./scripts/backup-db.sh                    # Create backup
./scripts/list-backups.sh                 # List backups
./scripts/restore-db.sh <backup-file>     # Restore backup

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

## Scripts Overview

### `backup-db.sh`

Create a compressed backup of the local database.

**Usage:**
```bash
./scripts/backup-db.sh
```

**Output:**
- Backup file: `./backups/ics_YYYYMMDD_HHMMSS.sql.gz`
- Compressed with gzip
- Displays file size and total backups

**Example:**
```bash
$ ./scripts/backup-db.sh
🔄 Creating database backup...
📦 Dumping database to ./backups/ics_20260301_143022.sql...
🗜️  Compressing backup...
✅ Backup created successfully!
   File: ./backups/ics_20260301_143022.sql.gz
   Size: 1.2M
   Total backups in directory: 5
```

---

### `restore-db.sh`

Restore the local database from a backup file.

**Usage:**
```bash
./scripts/restore-db.sh <backup-file>
```

**Features:**
- Creates safety backup before restore
- Stops web service during restore
- Supports `.sql` and `.sql.gz` files
- Interactive confirmation prompt

**Example:**
```bash
$ ./scripts/restore-db.sh ./backups/ics_20260301_143022.sql.gz
⚠️  WARNING: This will replace the current database!
   Backup file: ./backups/ics_20260301_143022.sql.gz

Are you sure you want to continue? (yes/no): yes
💾 Creating safety backup before restore...
   Safety backup saved: ./backups/before_restore_20260301_143530.sql.gz
🛑 Stopping web service...
🔄 Restoring database...
🚀 Restarting web service...

✅ Database restored successfully!

🔍 Verify with:
   docker compose exec ics-db psql -U postgres ics -c 'SELECT COUNT(*) FROM films;'
```

---

### `backup-production.sh`

Download a backup from the production server via SSH.

**Usage:**
```bash
./scripts/backup-production.sh [ssh-connection] [remote-path]
```

**Default values:**
- SSH connection: `user@ics.opalkad.com`
- Remote path: `~/allo-scrapper`

**Prerequisites:**
```bash
# Set up SSH key authentication
ssh-copy-id user@ics.opalkad.com

# Test connection
ssh user@ics.opalkad.com "echo 'SSH works'"
```

**Output:**
- Backup file: `./backups/production/ics_production_YYYYMMDD_HHMMSS.sql.gz`
- SHA256 checksum: `./backups/production/ics_production_YYYYMMDD_HHMMSS.sql.gz.sha256`

**Example:**
```bash
$ ./scripts/backup-production.sh
🌐 Production Database Backup
   SSH: user@ics.opalkad.com
   Remote path: ~/allo-scrapper
   Backup file: ics_production_20260301_143022.sql.gz

🔗 Testing SSH connection...
🐳 Checking remote Docker container...
💾 Creating backup on production server...
✅ Production backup completed successfully!
   File: ./backups/production/ics_production_20260301_143022.sql.gz
   Size: 2.4M
   SHA256: a1b2c3d4e5f6789...
```

**Custom SSH connection:**
```bash
./scripts/backup-production.sh myuser@production.example.com /opt/allo-scrapper
```

---

### `restore-production.sh`

Restore a backup to the production server via SSH.

**⚠️ DANGER: This replaces the production database!**

**Usage:**
```bash
./scripts/restore-production.sh <backup-file> [ssh-connection] [remote-path]
```

**Features:**
- SHA256 checksum verification
- Creates safety backup on production
- Stops web service during restore
- Uploads backup via SCP
- Verifies restored data

**Example:**
```bash
$ ./scripts/restore-production.sh ./backups/production/ics_production_20260301_143022.sql.gz
⚠️  WARNING: This will replace the PRODUCTION database!
   SSH: user@ics.opalkad.com
   Remote path: ~/allo-scrapper
   Backup file: ./backups/production/ics_production_20260301_143022.sql.gz

   This operation will:
   1. Create a safety backup on production
   2. Stop the production web service
   3. Restore the database
   4. Restart the production web service

Are you ABSOLUTELY SURE you want to continue? Type 'yes' to proceed: yes

🔍 Verifying backup integrity...
✅ Checksum verified
🔗 Testing SSH connection...
🐳 Checking remote Docker container...
💾 Creating safety backup on production...
   Safety backup saved on production: ~/allo-scrapper/backups/before_restore_production_20260301_143530.sql.gz
🛑 Stopping production web service...
📤 Uploading backup to production...
🔄 Restoring database on production...
🧹 Cleaning up...
🚀 Restarting production web service...
🔍 Verifying restore...
✅ Production database restored successfully!
   Films in database: 1234
   Safety backup saved: ~/allo-scrapper/backups/before_restore_production_20260301_143530.sql.gz
```

---

### `list-backups.sh`

List all local and production backups with details.

**Usage:**
```bash
./scripts/list-backups.sh              # List all backups
./scripts/list-backups.sh --local      # List only local backups
./scripts/list-backups.sh --production # List only production backups
```

**Example:**
```bash
$ ./scripts/list-backups.sh
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
- All backups kept indefinitely (no auto-deletion)
- Manually delete old backups if needed
- Directory excluded from git (`.gitignore`)
- Production backups include SHA256 checksums

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

### Copy Production Data to Local

```bash
# 1. Backup production
./scripts/backup-production.sh

# 2. Restore to local
./scripts/restore-db.sh ./backups/production/ics_production_YYYYMMDD_HHMMSS.sql.gz
```

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

### Database Container Not Running

**Problem:** Database container is not running

**Solution:**
```bash
# Local
docker compose up -d ics-db

# Production
ssh user@ics.opalkad.com "cd ~/allo-scrapper && docker compose up -d ics-db"
```

### Backup File Empty

**Problem:** Backup file is 0 bytes

**Solution:**
```bash
# Check container logs
docker compose logs ics-db | tail -50

# Check disk space
df -h

# Try manual backup
docker compose exec -T ics-db pg_dump -U postgres ics > test-backup.sql
```

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

## Best Practices

1. **Regular Backups**
   - Create production backup before each deployment
   - Create local backup before testing destructive operations
   - Keep multiple versions for different time periods

2. **Verify Backups**
   - Production backups include SHA256 checksums
   - Periodically test restores on non-production environment
   - Check backup file sizes are reasonable

3. **Safety**
   - Safety backups created automatically before restore
   - Test restore on local environment first
   - Never restore to production without confirmation

4. **Storage**
   - Store production backups in `./backups/production/`
   - Keep local backups separate
   - Consider external backup storage for disaster recovery

5. **SSH Security**
   - Use SSH key authentication (not passwords)
   - Restrict key permissions: `chmod 600 ~/.ssh/id_ed25519`
   - Use dedicated backup user on production

---

## Manual Commands

If you need to create backups manually:

```bash
# Local backup
docker compose exec -T ics-db pg_dump -U postgres ics | gzip > ./backups/manual_$(date +%Y%m%d_%H%M%S).sql.gz

# Production backup (via SSH)
ssh user@ics.opalkad.com "cd ~/allo-scrapper && docker compose exec -T ics-db pg_dump -U postgres ics" | gzip > ./backups/production/manual_$(date +%Y%m%d_%H%M%S).sql.gz

# Local restore
gunzip -c ./backups/manual_20260301_143022.sql.gz | docker compose exec -T ics-db psql -U postgres ics
```

---

## Complete System Backup

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

## See Also

- [DEPLOYMENT.md](../DEPLOYMENT.md) - Full deployment guide with backup section
- [DATABASE.md](../DATABASE.md) - Database schema and operations
- [docker-compose.yml](../docker-compose.yml) - Docker configuration
