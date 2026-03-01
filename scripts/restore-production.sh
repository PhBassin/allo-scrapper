#!/bin/bash
# Restore PostgreSQL database to production server via SSH
# Usage: ./scripts/restore-production.sh <backup-file> [ssh-connection-string] [remote-docker-path]
#
# Example:
#   ./scripts/restore-production.sh ./backups/production/ics_production_20260301_120000.sql.gz user@ics.opalkad.com ~/allo-scrapper

set -e

# Check if backup file is provided
if [ -z "$1" ]; then
    echo "❌ Error: No backup file specified"
    echo ""
    echo "Usage: $0 <backup-file> [ssh-connection-string] [remote-docker-path]"
    echo ""
    echo "Available production backups:"
    ls -1 ./backups/production/*.sql.gz 2>/dev/null || echo "  No production backups found"
    echo ""
    echo "Available local backups:"
    ls -1 ./backups/*.sql.gz 2>/dev/null || echo "  No local backups found"
    exit 1
fi

BACKUP_FILE="$1"
SSH_CONNECTION="${2:-user@ics.opalkad.com}"
REMOTE_PATH="${3:-~/allo-scrapper}"

# Verify backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Verify checksum if available
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [ -f "$CHECKSUM_FILE" ]; then
    echo "🔍 Verifying backup integrity..."
    if ! sha256sum -c "$CHECKSUM_FILE" --quiet 2>/dev/null; then
        echo "❌ Error: Backup file checksum verification failed!"
        echo "   The backup file may be corrupted."
        exit 1
    fi
    echo "✅ Checksum verified"
fi

echo "⚠️  WARNING: This will replace the PRODUCTION database!"
echo "   SSH: $SSH_CONNECTION"
echo "   Remote path: $REMOTE_PATH"
echo "   Backup file: $BACKUP_FILE"
echo ""
echo "   This operation will:"
echo "   1. Create a safety backup on production"
echo "   2. Stop the production web service"
echo "   3. Restore the database"
echo "   4. Restart the production web service"
echo ""
read -p "Are you ABSOLUTELY SURE you want to continue? Type 'yes' to proceed: " -r
echo

if [ "$REPLY" != "yes" ]; then
    echo "❌ Restore cancelled"
    exit 0
fi

# Check SSH connectivity
echo "🔗 Testing SSH connection..."
if ! ssh -o ConnectTimeout=10 -o BatchMode=yes "$SSH_CONNECTION" "echo 'SSH connection successful'" 2>/dev/null; then
    echo "❌ Error: Cannot connect to production server"
    echo "   Make sure SSH key authentication is set up:"
    echo "   ssh-copy-id $SSH_CONNECTION"
    exit 1
fi

# Check if remote Docker container is running
echo "🐳 Checking remote Docker container..."
if ! ssh "$SSH_CONNECTION" "cd $REMOTE_PATH && docker compose ps ics-db | grep -q 'Up'"; then
    echo "❌ Error: Database container is not running on production"
    echo "   Start it with: ssh $SSH_CONNECTION 'cd $REMOTE_PATH && docker compose up -d ics-db'"
    exit 1
fi

# Create safety backup on production
echo "💾 Creating safety backup on production..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SAFETY_BACKUP="backups/before_restore_production_${TIMESTAMP}.sql.gz"
ssh "$SSH_CONNECTION" "cd $REMOTE_PATH && mkdir -p backups && docker compose exec -T ics-db pg_dump -U postgres ics | gzip > $SAFETY_BACKUP"
echo "   Safety backup saved on production: $REMOTE_PATH/$SAFETY_BACKUP"

# Stop web service on production
echo "🛑 Stopping production web service..."
ssh "$SSH_CONNECTION" "cd $REMOTE_PATH && docker compose stop ics-web"

# Upload and restore database
echo "📤 Uploading backup to production..."
REMOTE_TEMP="/tmp/restore_${TIMESTAMP}.sql.gz"
scp "$BACKUP_FILE" "$SSH_CONNECTION:$REMOTE_TEMP"

echo "🔄 Restoring database on production..."
if [[ "$BACKUP_FILE" == *.gz ]]; then
    ssh "$SSH_CONNECTION" "gunzip -c $REMOTE_TEMP | docker exec -i \$(docker compose -f $REMOTE_PATH/docker-compose.yml ps -q ics-db) psql -U postgres ics"
else
    ssh "$SSH_CONNECTION" "docker exec -i \$(docker compose -f $REMOTE_PATH/docker-compose.yml ps -q ics-db) psql -U postgres ics < $REMOTE_TEMP"
fi

# Clean up remote temp file
echo "🧹 Cleaning up..."
ssh "$SSH_CONNECTION" "rm -f $REMOTE_TEMP"

# Restart web service on production
echo "🚀 Restarting production web service..."
ssh "$SSH_CONNECTION" "cd $REMOTE_PATH && docker compose start ics-web"

# Verify restore
echo "🔍 Verifying restore..."
FILM_COUNT=$(ssh "$SSH_CONNECTION" "cd $REMOTE_PATH && docker compose exec -T ics-db psql -U postgres ics -t -c 'SELECT COUNT(*) FROM films;'" | tr -d ' \n')

echo ""
echo "✅ Production database restored successfully!"
echo "   Films in database: $FILM_COUNT"
echo "   Safety backup saved: $REMOTE_PATH/$SAFETY_BACKUP"
echo ""
echo "🔍 Verify production:"
echo "   ssh $SSH_CONNECTION 'cd $REMOTE_PATH && docker compose exec ics-db psql -U postgres ics -c \"SELECT COUNT(*) FROM films;\"'"
echo ""
echo "📋 Download safety backup:"
echo "   scp $SSH_CONNECTION:$REMOTE_PATH/$SAFETY_BACKUP ./backups/production/"
