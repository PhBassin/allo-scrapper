# Backup Scripts

Backup helpers for the Docker Compose deployment.

## Available scripts

- `./scripts/backup-db.sh`
- `./scripts/restore-db.sh <backup-file>`
- `./scripts/backup-production.sh [ssh] [remote-path]`
- `./scripts/restore-production.sh <backup-file> [ssh] [remote-path]`
- `./scripts/list-backups.sh [--local|--production]`

## Current assumptions

- local scripts target `docker compose` and the `ics-db` / `ics-web` service names
- production backup/restore scripts assume SSH access to a remote host running this same compose stack
- local backup files are stored under `./backups`
- production downloads are stored under `./backups/production`

## Typical usage

```bash
./scripts/backup-db.sh
./scripts/list-backups.sh
./scripts/restore-db.sh ./backups/ics_YYYYMMDD_HHMMSS.sql.gz
```

```bash
./scripts/backup-production.sh user@example.com ~/allo-scrapper
./scripts/restore-production.sh ./backups/production/ics_production_YYYYMMDD_HHMMSS.sql.gz user@example.com ~/allo-scrapper
```

## Important notes

- restore scripts stop `ics-web` during restore
- restore scripts create a safety backup first
- production backup files may also have `.sha256` checksum files
- these scripts are written for the production compose stack, not the dev compose service names
