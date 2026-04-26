# SaaS Package Testing

## Standard test commands

```bash
cd packages/saas
npm test
npm run test:run
npm run test:coverage
```

## What is covered here

- plugin registration
- tenant middleware
- quota middleware and services
- onboarding and org routes
- superadmin routes
- fixture route behavior

## Migration integration test

There is a dedicated `migrations.integration.test.ts` file.

It is intended for opt-in execution against a real PostgreSQL database.

Typical local flow:

```bash
docker compose up -d ics-db
docker compose exec ics-db psql -U postgres -c "CREATE DATABASE ics_test"

cd packages/saas
RUN_INTEGRATION_TESTS=1 npm test -- migrations.integration.test.ts
```

Optional env vars:

- `TEST_DB_HOST`
- `TEST_DB_PORT`
- `TEST_DB_NAME`
- `TEST_DB_USER`
- `TEST_DB_PASSWORD`

## Notes

- the SaaS plugin is activated by the server only when `SAAS_ENABLED=true`
- fixture endpoints under `/test/*` are available only in test runtime, or in development with `E2E_ENABLE_ORG_FIXTURE=true`
