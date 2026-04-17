## Deferred from: code review of 0-2-implement-multi-tenant-test-fixture-api (2026-04-17)

- `packages/saas/src/plugin.ts:89` — `getSaasMigrationDir()` environment branching can select an invalid migrations path outside strict production/dev expectations; deferred as pre-existing migration-path design concern.
