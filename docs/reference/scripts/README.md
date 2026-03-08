# Scripts Reference

Automation scripts for backup, restore, and deployment.

## 📑 Scripts

### [Backup Scripts](./backup.md)
Database backup scripts for development and production.

**Scripts:**
- `backup-db.sh` - Development backup (Docker volume)
- `backup-production.sh` - Production backup (custom host/port)
- `list-backups.sh` - List available backups with metadata

**What you'll learn:**
- Script parameters and options
- Backup naming conventions
- Output formats (SQL, custom, compressed)
- Automated scheduling with cron
- Retention policies

**Best for:** Setting up automated backups, backup administration

---

### [Restore Scripts](./restore.md)
Database restore scripts for development and production.

**Scripts:**
- `restore-db.sh` - Development restore (Docker volume)
- `restore-production.sh` - Production restore (custom host/port)

**What you'll learn:**
- Interactive vs non-interactive mode
- Safety confirmations
- Restore verification
- Handling different backup formats
- Troubleshooting restore failures

**Best for:** Disaster recovery, environment cloning, testing

---

### [Deployment Scripts](./deployment.md)
Deployment and initialization scripts.

**Scripts:**
- `install-hooks.sh` - Install git pre-push hooks
- `init-db.sh` - Initialize database schema
- Various Docker helper scripts

**What you'll learn:**
- Git hooks setup
- Database initialization
- Development environment setup
- CI/CD integration

**Best for:** Initial setup, CI/CD pipelines

---

## Quick Reference

### Backup Examples

**Development backup:**
```bash
./scripts/backup-db.sh
# Creates: ./backups/ics_backup_YYYYMMDD_HHMMSS.sql
```

**Production backup (compressed):**
```bash
./scripts/backup-production.sh \
  --host db.example.com \
  --port 5432 \
  --user postgres \
  --database ics \
  --format custom \
  --compress 9
# Creates: ./backups/ics_backup_YYYYMMDD_HHMMSS.dump.gz
```

**List backups:**
```bash
./scripts/list-backups.sh
# Shows: filename, size, date, age
```

### Restore Examples

**Development restore (interactive):**
```bash
./scripts/restore-db.sh ./backups/ics_backup_20250301_120000.sql
# Prompts for confirmation
```

**Production restore (non-interactive):**
```bash
./scripts/restore-production.sh \
  --host db.example.com \
  --port 5432 \
  --user postgres \
  --database ics \
  --file ./backups/ics_backup_20250301_120000.sql \
  --yes
# Skips confirmation
```

### Automated Backups (Cron)

**Daily backups at 2 AM:**
```bash
0 2 * * * /path/to/allo-scrapper/scripts/backup-production.sh --host db.example.com --user postgres
```

**Weekly cleanup (keep last 30 days):**
```bash
0 3 * * 0 find /path/to/backups -name "ics_backup_*.sql*" -mtime +30 -delete
```

---

## Script Locations

All scripts are located in:
```
/scripts/
├── backup-db.sh
├── backup-production.sh
├── restore-db.sh
├── restore-production.sh
├── list-backups.sh
├── install-hooks.sh
└── README-BACKUP.md (technical details)
```

---

## Related Documentation

- [Backup & Restore Guide](../../guides/deployment/backup-restore.md) - Step-by-step workflows
- [Database Troubleshooting](../../troubleshooting/database.md) - Backup/restore issues
- [Production Deployment](../../guides/deployment/production.md) - Production setup

---

[← Back to Reference](../README.md)
