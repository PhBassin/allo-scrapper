#!/bin/bash
# Restore PostgreSQL database from backup
# Usage: ./scripts/restore-db.sh <backup-file>

set -e

if [ -z "$1" ]; then
    echo "❌ Error: No backup file specified"
    echo ""
    echo "Usage: $0 <backup-file>"
    echo ""
    echo "Available backups:"
    ls -1 ./backups/*.sql.gz 2>/dev/null || echo "  No backups found"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "⚠️  WARNING: This will replace the current database!"
echo "   Backup file: $BACKUP_FILE"
echo ""
read -p "Are you sure you want to continue? (yes/no): " -r
echo

if [ "$REPLY" != "yes" ]; then
    echo "❌ Restore cancelled"
    exit 0
fi

# Check if containers are running
if ! docker compose ps ics-db | grep -q "Up"; then
    echo "❌ Error: Database container is not running"
    echo "   Start it with: docker compose up -d ics-db"
    exit 1
fi

# Stop web service to prevent connections
echo "🛑 Stopping web service..."
docker compose stop ics-web

# Create safety backup before restore
echo "💾 Creating safety backup before restore..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SAFETY_BACKUP="./backups/before_restore_${TIMESTAMP}.sql.gz"
docker compose exec -T ics-db pg_dump -U postgres ics | gzip > "$SAFETY_BACKUP"
echo "   Safety backup saved: $SAFETY_BACKUP"

# Restore database
echo "🔄 Restoring database..."
if [[ "$BACKUP_FILE" == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" | docker compose exec -T ics-db psql -U postgres ics
else
    docker compose exec -T ics-db psql -U postgres ics < "$BACKUP_FILE"
fi

# Restart web service
echo "🚀 Restarting web service..."
docker compose start ics-web

echo ""
echo "✅ Database restored successfully!"
echo ""
echo "🔍 Verify with:"
echo "   docker compose exec ics-db psql -U postgres ics -c 'SELECT COUNT(*) FROM films;'"
