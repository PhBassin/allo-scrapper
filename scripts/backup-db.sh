#!/bin/bash
# Backup PostgreSQL database
# Usage: ./scripts/backup-db.sh

set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/its_${TIMESTAMP}.sql"

echo "🔄 Creating database backup..."

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if containers are running
if ! docker compose ps | grep -q "allo-scrapper-db.*Up"; then
    echo "❌ Error: Database container is not running"
    echo "   Start it with: docker compose up -d db"
    exit 1
fi

# Backup database
echo "📦 Dumping database to ${BACKUP_FILE}..."
docker compose exec -T db pg_dump -U postgres its > "$BACKUP_FILE"

# Compress backup
echo "🗜️  Compressing backup..."
gzip "$BACKUP_FILE"

COMPRESSED_FILE="${BACKUP_FILE}.gz"
BACKUP_SIZE=$(du -h "$COMPRESSED_FILE" | cut -f1)

echo "✅ Backup created successfully!"
echo "   File: ${COMPRESSED_FILE}"
echo "   Size: ${BACKUP_SIZE}"

# Keep only last 7 backups
echo "🧹 Cleaning old backups (keeping last 7 days)..."
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete

BACKUP_COUNT=$(find "$BACKUP_DIR" -name "*.sql.gz" | wc -l | tr -d ' ')
echo "   Backups in directory: ${BACKUP_COUNT}"

echo ""
echo "📋 Recent backups:"
ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -5 || echo "   No backups found"
