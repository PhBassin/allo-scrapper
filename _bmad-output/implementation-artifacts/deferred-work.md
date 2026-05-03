## Deferred from: code review of 0-2-implement-multi-tenant-test-fixture-api (2026-04-17)

- `packages/saas/src/plugin.ts:89` — `getSaasMigrationDir()` environment branching can select an invalid migrations path outside strict production/dev expectations; deferred as pre-existing migration-path design concern.

## Deferred from: code review of PR #923 — parser validation (2026-05-01)

### 🔴 Patch — `theater-parser` validation manquante
`scraper/src/scraper/theater-parser.ts` — Ajouter `ParserStructureError` quand `#theaterpage-showtimes-index-ui` absent. Actuellement `JSON.parse(undefined)` → `SyntaxError` générique.

### 🔴 Patch — `ParserStructureError` avalée dans AllocineScraperStrategy
`scraper/src/scraper/AllocineScraperStrategy.ts:128-131` — Distinguer `ParserStructureError` des erreurs fetch. Log actuel: "Error fetching film page" même quand le fetch a réussi.

### 🔴 Patch — `classifyError` ne reconnaît pas `ParserStructureError`
`scraper/src/utils/error-classifier.ts:16-45` — Ajouter `instanceof ParserStructureError` pour classification `'structure_change'`.

### 🔴 Patch — Test négatif `validateParserSelectors`
`scraper/tests/unit/scraper/parser-validation.test.ts` — Ajouter test: HTML sans `.meta-body-info` → `{valid: false, missingSelectors: ['.meta-body-info']}`.

### 🔴 Patch — Tests constantes `theater-parser`
Ajouter test validant comportement quand `#theaterpage-showtimes-index-ui` / `.movie-card-theater` absents.

### 🔴 Patch — `ParserStructureError.url` inutilisé
`scraper/src/utils/parser-errors.ts` — Passer l'URL ou supprimer le paramètre.

## Deferred from: code review of 1-1-implement-org-id-validation-middleware (2026-04-17)

- `server/src/routes/cinemas.ts:147` — Org-scoped cinema detail route remains public and may expose tenant data if not separately guarded; deferred as pre-existing route-policy issue outside this story slice.

## Deferred from: code review of 2-6-dlq-api-endpoints-api-only-no-ui (2026-04-28)

- `server/src/routes/scraper.ts:253` — DLQ single-job lookup keys on `job_id = report-${reportId}`. This is safe with the current globally incrementing `scrape_reports.id`, but it would become ambiguous if report IDs ever stop being globally unique across tenants; deferred as a pre-existing identifier design constraint.

## Deferred from: code review of 3-7-localhost-exemption-for-docker-health-probes (2026-04-28)

- `_bmad-output/implementation-artifacts/sprint-status.yaml:2` — The generated comment timestamp (`# last_updated`) is out of sync with the real `last_updated` field. Deferred as review-artifact drift outside the behavior change under review.

## Deferred from: code review of 3-1-implement-sse-heartbeat-mechanism (2026-04-28)

- `client/src/api/client.ts:257` — Idle SSE subscriptions remain closed until a reconnect strategy exists. Deferred because Story 3.1 intentionally adds idle close without implementing reconnect; recovery behavior is owned by Story 3.2.

## Deferred from: code review of 3-4-sse-concurrent-client-load-test-50-clients (2026-04-30)

- `server/src/routes/scraper-progress.concurrent.integration.test.ts:304-306` — Heartbeat timing assertions tightly coupled to 30s cadence (±7s tolerance window). Changes to heartbeat interval or CI event-loop delays may cause flaky failures.
- `server/src/routes/scraper-progress.concurrent.integration.test.ts:338-344,485-490` — `process.memoryUsage().rss` measures entire Vitest runner process, not just the disposable Express server. In-process testing limitation; inflated baseline from loaded modules may mask tracker leaks.
- `server/src/routes/scraper-progress.concurrent.integration.test.ts:317,355,412` — `setTimeout(200)` for connection fan-out is a race condition. Mitigated by subsequent `getListenerCount()` assertion but may cause flaky failures in constrained CI.

## Deferred from: code review of 7-1-resolve-open-scraper-and-tenant-stability-prs (2026-05-03)

- `scraper/*` — Story 7.1 AC requires ensuring no regressions in scraper consumer jobs, but the current stabilization diff is test-focused in `client/`, `packages/saas/`, and `server/` only; deferred as out-of-scope for this patchset and already merged story baseline.
- `packages/saas/src/routes/register.test.ts:12` — Route test now mocks `createOrg` for determinism; acceptable for immediate stabilization, but broader decision on integration-depth policy deferred to a dedicated test strategy story.
