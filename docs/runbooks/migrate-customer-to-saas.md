# Runbook: Migrating Large Customer Datasets to SaaS

## Prerequisites
- Access to the production database with superuser or migration privileges.
- Backup of the database before starting.
- `psql` client installed on the migration machine.

## Step-by-Step Execution

### 1. Environment Preparation
Ensure you have the database connection string:
`DATABASE_URL="postgres://user:password@host:port/dbname"`

### 2. Run the Migration Script
Execute the batched migration script:
```bash
./scripts/migrate-existing-to-saas.sh "$DATABASE_URL"
```

### 3. Verification
Check the count of records in the new SaaS schema versus the old public schema:
```bash
psql "$DATABASE_URL" -c "SELECT count(*) FROM org_ics.showtimes;"
psql "$DATABASE_URL" -c "SELECT count(*) FROM public.showtimes;"
```
The counts should match.

### 4. Cleanup (Optional)
Once verified, you can drop the old public tables:
```bash
psql "$DATABASE_URL" -c "DROP TABLE public.showtimes;"
```

## Troubleshooting
- **Connection Timeout**: If the connection drops, simply rerun the script. The `ON CONFLICT DO NOTHING` clause ensures it resumes where it left off.
- **Disk Space**: Monitor the WAL (Write Ahead Log) space if migrating extremely large datasets (>100M rows).
