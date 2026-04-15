#!/bin/bash

# Usage: ./scripts/migrate-existing-to-saas.sh <db_url>

set -e

DB_URL=$1

if [ -z "$DB_URL" ]; then
    echo "Usage: $0 <postgres_connection_url>"
    exit 1
fi

echo "Starting batched migration to SaaS architecture..."

# We use a PL/pgSQL block to perform the migration in batches within the DB
# This avoids transferring millions of rows to the client and back.
MIGRATION_SQL=$(cat <<EOF
DO \$$
DECLARE
    batch_size INT := 10000;
    offset_val INT := 0;
    rows_copied INT;
BEGIN
    LOOP
        INSERT INTO org_ics.showtimes (id, cinema_id, movie_id, start_time, room, price)
        SELECT id, cinema_id, movie_id, start_time, room, price 
        FROM public.showtimes
        ORDER BY id
        LIMIT batch_size OFFSET offset_val
        ON CONFLICT (id) DO NOTHING;
        
        GET DIAGNOSTICS rows_copied = ROW_COUNT;
        RAISE NOTICE 'Migrated % rows (offset %)', rows_copied, offset_val;
        
        EXIT WHEN rows_copied < batch_size;
        offset_val := offset_val + batch_size;
    END LOOP;
END \$$;
EOF
)

psql "$DB_URL" -c "$MIGRATION_SQL"

echo "Migration completed successfully."
