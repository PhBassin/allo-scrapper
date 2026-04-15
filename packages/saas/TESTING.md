# SaaS Package Testing

This document describes how to run tests for the SaaS package, including unit tests and integration tests.

---

## Unit Tests

Unit tests verify individual functions and modules in isolation.

```bash
cd packages/saas
npm test
```

**Coverage targets:**
- Lines: >= 80%
- Functions: >= 80%
- Statements: >= 80%
- Branches: >= 65%

---

## Integration Tests

Integration tests run actual SaaS migrations against a test PostgreSQL database to verify:
- Migration SQL is syntactically valid
- Migrations produce expected schema state
- Migrations are idempotent (can run multiple times safely)

### Prerequisites

1. **Start PostgreSQL database** (via Docker Compose):
   ```bash
   docker-compose up -d ics-db
   ```

2. **Create test database**:
   ```bash
   docker-compose exec ics-db psql -U postgres -c "CREATE DATABASE ics_test"
   ```

### Running Integration Tests

```bash
cd packages/saas
RUN_INTEGRATION_TESTS=1 npm test -- migrations.integration.test.ts
```

**Environment variables** (optional):
- `TEST_DB_HOST` (default: `localhost`)
- `TEST_DB_PORT` (default: `5432`)
- `TEST_DB_NAME` (default: `ics_test`)
- `TEST_DB_USER` (default: `postgres`)
- `TEST_DB_PASSWORD` (default: `postgres`)

### What Gets Tested

**saas_008_create_default_ics_org.sql:**
- ✅ ICS organization created with correct metadata
- ✅ `org_ics` schema created with all tables
- ✅ Admin user associated from `public.users`
- ✅ API usage quota initialized
- ✅ Data migrated from public schema (cinemas, films, showtimes)
- ✅ Idempotency (safe to re-run without errors)

**saas_009_fix_org_settings_fk_cascade.sql:**
- ✅ FK constraint updated to `ON DELETE SET NULL`
- ✅ Idempotency (safe to re-run)

**saas_010_add_fk_indexes.sql:**
- ✅ Indexes created on all FK columns
- ✅ Idempotency (safe to re-run)

### Troubleshooting

**Integration tests skipped:**
```
⚠️  Integration tests skipped. To enable:
   1. Start database: docker-compose up -d ics-db
   2. Create test DB: docker-compose exec ics-db psql -U postgres -c "CREATE DATABASE ics_test"
   3. Run with: RUN_INTEGRATION_TESTS=1 npm test -- migrations.integration.test.ts
```

**Connection error:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

→ Ensure PostgreSQL is running: `docker-compose ps ics-db`

**Database does not exist:**
```
Error: database "ics_test" does not exist
```

→ Create test database: `docker-compose exec ics-db psql -U postgres -c "CREATE DATABASE ics_test"`

---

## CI/CD Integration

Integration tests can be enabled in CI by setting `RUN_INTEGRATION_TESTS=1` and providing test database credentials via environment variables.

**Example GitHub Actions workflow:**

```yaml
jobs:
  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 24
      - name: Install dependencies
        run: npm install
      - name: Create test database
        run: |
          PGPASSWORD=postgres psql -h localhost -U postgres -c "CREATE DATABASE ics_test"
      - name: Run integration tests
        env:
          RUN_INTEGRATION_TESTS: 1
          TEST_DB_HOST: localhost
          TEST_DB_USER: postgres
          TEST_DB_PASSWORD: postgres
        run: |
          cd packages/saas
          npm test -- migrations.integration.test.ts
```

---

## Manual Migration Testing

To manually verify migrations without running tests:

```bash
# Apply migration to test database
docker-compose exec -T ics-db psql -U postgres -d ics_test < packages/saas/migrations/saas_008_create_default_ics_org.sql

# Verify org created
docker-compose exec ics-db psql -U postgres -d ics_test -c "SELECT * FROM organizations WHERE slug='ics'"

# Verify schema exists
docker-compose exec ics-db psql -U postgres -d ics_test -c "\dn org_ics"

# List tables in org schema
docker-compose exec ics-db psql -U postgres -d ics_test -c "\dt org_ics.*"
```

---

## Test Database Cleanup

To reset the test database:

```bash
# Drop and recreate test database
docker-compose exec ics-db psql -U postgres -c "DROP DATABASE IF EXISTS ics_test"
docker-compose exec ics-db psql -U postgres -c "CREATE DATABASE ics_test"

# Or just drop org schema
docker-compose exec ics-db psql -U postgres -d ics_test -c "DROP SCHEMA IF EXISTS org_ics CASCADE"
```
