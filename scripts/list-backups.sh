#!/bin/bash
# List all database backups (local and production)
# Usage: ./scripts/list-backups.sh [--production|--local]

set -e

BACKUP_DIR="./backups"
PRODUCTION_DIR="./backups/production"

# Parse arguments
SHOW_LOCAL=true
SHOW_PRODUCTION=true

if [ "$1" = "--local" ]; then
    SHOW_PRODUCTION=false
elif [ "$1" = "--production" ]; then
    SHOW_LOCAL=false
fi

echo "📋 Database Backups"
echo ""

# Function to format and display backups
display_backups() {
    local dir="$1"
    local label="$2"
    
    if [ ! -d "$dir" ]; then
        echo "   No backups directory found"
        return
    fi
    
    # Find all .sql and .sql.gz files
    local files=$(find "$dir" -maxdepth 1 -type f \( -name "*.sql" -o -name "*.sql.gz" \) 2>/dev/null | sort -r)
    
    if [ -z "$files" ]; then
        echo "   No backups found"
        return
    fi
    
    # Display header
    printf "   %-50s %-12s %-20s\n" "FILENAME" "SIZE" "DATE"
    printf "   %-50s %-12s %-20s\n" "$(printf '%.0s-' {1..50})" "$(printf '%.0s-' {1..12})" "$(printf '%.0s-' {1..20})"
    
    # Display each backup
    echo "$files" | while read -r file; do
        if [ -f "$file" ]; then
            local filename=$(basename "$file")
            local size=$(du -h "$file" | cut -f1)
            local date=$(date -r "$file" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$file" 2>/dev/null || echo "Unknown")
            
            printf "   %-50s %-12s %-20s" "$filename" "$size" "$date"
            
            # Show checksum status
            if [ -f "${file}.sha256" ]; then
                printf " ✓"
            fi
            
            printf "\n"
        fi
    done
}

# Display local backups
if [ "$SHOW_LOCAL" = true ]; then
    echo "🏠 Local Backups ($BACKUP_DIR)"
    echo ""
    display_backups "$BACKUP_DIR" "Local"
    echo ""
fi

# Display production backups
if [ "$SHOW_PRODUCTION" = true ]; then
    echo "🌐 Production Backups ($PRODUCTION_DIR)"
    echo ""
    display_backups "$PRODUCTION_DIR" "Production"
    echo ""
fi

# Display summary
echo "📊 Summary"
echo ""

if [ "$SHOW_LOCAL" = true ]; then
    local_count=$(find "$BACKUP_DIR" -maxdepth 1 -type f \( -name "*.sql" -o -name "*.sql.gz" \) 2>/dev/null | wc -l | tr -d ' ')
    local_size=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1 || echo "0B")
    echo "   Local backups: $local_count files ($local_size total)"
fi

if [ "$SHOW_PRODUCTION" = true ]; then
    if [ -d "$PRODUCTION_DIR" ]; then
        prod_count=$(find "$PRODUCTION_DIR" -maxdepth 1 -type f \( -name "*.sql" -o -name "*.sql.gz" \) 2>/dev/null | wc -l | tr -d ' ')
        prod_size=$(du -sh "$PRODUCTION_DIR" 2>/dev/null | cut -f1 || echo "0B")
        echo "   Production backups: $prod_count files ($prod_size total)"
    else
        echo "   Production backups: 0 files (0B total)"
    fi
fi

echo ""
echo "💡 Usage:"
echo "   Restore local backup:      ./scripts/restore-db.sh <backup-file>"
echo "   Restore to production:     ./scripts/restore-production.sh <backup-file>"
echo "   Create local backup:       ./scripts/backup-db.sh"
echo "   Create production backup:  ./scripts/backup-production.sh"
