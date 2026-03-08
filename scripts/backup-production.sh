#!/bin/bash
# Backup PostgreSQL database from production server via SSH
# Usage: ./scripts/backup-production.sh [ssh-connection-string] [remote-docker-path]
#
# Example:
#   ./scripts/backup-production.sh user@ics.opalkad.com ~/allo-scrapper

set -e

# Default values
SSH_CONNECTION="${1:-user@ics.opalkad.com}"
REMOTE_PATH="${2:-~/allo-scrapper}"

# Configuration
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/production"
BACKUP_FILE="ics_production_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

# Create production backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "🌐 Production Database Backup"
echo "   SSH: $SSH_CONNECTION"
echo "   Remote path: $REMOTE_PATH"
echo "   Backup file: $BACKUP_FILE"
echo ""

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

# Create backup on remote server and download
echo "💾 Creating backup on production server..."
ssh "$SSH_CONNECTION" "cd $REMOTE_PATH && docker compose exec -T ics-db pg_dump -U postgres ics | gzip" > "$BACKUP_PATH"

# Verify backup was created and has content
if [ ! -f "$BACKUP_PATH" ]; then
    echo "❌ Error: Backup file was not created"
    exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
if [ "$BACKUP_SIZE" = "0B" ]; then
    echo "❌ Error: Backup file is empty"
    rm "$BACKUP_PATH"
    exit 1
fi

# Create checksum for verification
CHECKSUM=$(sha256sum "$BACKUP_PATH" | cut -d' ' -f1)
echo "$CHECKSUM  $BACKUP_FILE" > "${BACKUP_PATH}.sha256"

echo ""
echo "✅ Production backup completed successfully!"
echo "   File: $BACKUP_PATH"
echo "   Size: $BACKUP_SIZE"
echo "   SHA256: $CHECKSUM"
echo ""
echo "📋 List all production backups:"
echo "   ls -lh $BACKUP_DIR"
echo ""
echo "🔄 Restore to local:"
echo "   ./scripts/restore-db.sh $BACKUP_PATH"
echo ""
echo "🔄 Restore to production:"
echo "   ./scripts/restore-production.sh $BACKUP_PATH $SSH_CONNECTION $REMOTE_PATH"
