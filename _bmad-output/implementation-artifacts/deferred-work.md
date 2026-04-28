## Deferred from: code review of 0-2-implement-multi-tenant-test-fixture-api (2026-04-17)

- `packages/saas/src/plugin.ts:89` — `getSaasMigrationDir()` environment branching can select an invalid migrations path outside strict production/dev expectations; deferred as pre-existing migration-path design concern.

## Deferred from: code review of 1-1-implement-org-id-validation-middleware (2026-04-17)

- `server/src/routes/cinemas.ts:147` — Org-scoped cinema detail route remains public and may expose tenant data if not separately guarded; deferred as pre-existing route-policy issue outside this story slice.

## Deferred from: code review of 2-6-dlq-api-endpoints-api-only-no-ui (2026-04-28)

- `server/src/routes/scraper.ts:253` — DLQ single-job lookup keys on `job_id = report-${reportId}`. This is safe with the current globally incrementing `scrape_reports.id`, but it would become ambiguous if report IDs ever stop being globally unique across tenants; deferred as a pre-existing identifier design constraint.

## Deferred from: code review of 3-7-localhost-exemption-for-docker-health-probes (2026-04-28)

- `_bmad-output/implementation-artifacts/sprint-status.yaml:2` — The generated comment timestamp (`# last_updated`) is out of sync with the real `last_updated` field. Deferred as review-artifact drift outside the behavior change under review.

## Deferred from: code review of 3-1-implement-sse-heartbeat-mechanism (2026-04-28)

- `client/src/api/client.ts:257` — Idle SSE subscriptions remain closed until a reconnect strategy exists. Deferred because Story 3.1 intentionally adds idle close without implementing reconnect; recovery behavior is owned by Story 3.2.
