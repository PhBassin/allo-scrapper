# Story 7.2: Refactor Theme Variables Contract

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a frontend developer,
I want the client and server to use the exact same settings keys and CSS-variable contract for white-label themes,
so that theme rendering remains reliable across read/write/import/export paths.

## Acceptance Criteria

1. **Given** theme settings are read by the client API layer
   **When** settings payloads are normalized for app use
   **Then** canonical keys are used as the primary contract (`color_surface`, `color_text_primary`, `font_primary`, `font_secondary`)
   **And** legacy keys are only handled in explicitly scoped compatibility paths.

2. **Given** admin settings are edited and saved
   **When** the form round-trips through client API to server/SaaS routes
   **Then** updates persist with canonical keys only
   **And** no hidden remap dependency on legacy keys is required for normal operation.

3. **Given** theme CSS is generated and consumed
   **When** server CSS output and client `useTheme` logic are exercised
   **Then** cache/version refresh and rendered variables remain stable with canonical-field changes
   **And** no active layer depends on legacy key names as primary contract.

4. **Given** historical imports/exports may contain legacy keys
   **When** import endpoints process those payloads
   **Then** compatibility remains available only at controlled import boundaries
   **And** API output remains canonical.

## Tasks / Subtasks

- [ ] Task 1 — Canonicalize client settings API contract (AC: 1, 2)
  - [ ] Update `client/src/api/settings.ts` types (`AppSettingsPublic`, `AppSettings`, `AppSettingsUpdate`) to canonical keys.
  - [ ] Restrict `LegacyThemeShape` to defensive import/backward-compatibility roles only.
  - [ ] Ensure `normalizeSettingsResponse()` always outputs canonical shape.
  - [ ] Simplify `toServerSettingsUpdate()` to canonical pass-through behavior.

- [ ] Task 2 — Propagate canonical contract through context/provider (AC: 1, 2)
  - [ ] Update `client/src/contexts/SettingsContext.ts` to canonical key contract.
  - [ ] Remove provider-time reconstruction of legacy fields in `client/src/contexts/SettingsProvider.tsx`.
  - [ ] Keep `adminSettings` and `publicSettings` aligned around canonical shape.

- [ ] Task 3 — Migrate admin settings UI binding to canonical keys (AC: 2)
  - [ ] Update `client/src/pages/admin/SettingsPage.tsx` initial form hydration and field bindings to canonical names.
  - [ ] Clarify UI labels where `surface` vs `border` semantics could be confusing.
  - [ ] Update related tests in `client/src/pages/admin/SettingsPage.test.tsx` with canonical fixtures.

- [ ] Task 4 — Align `useTheme` and theme hook tests (AC: 3)
  - [ ] Update `client/src/hooks/useTheme.ts` `themeVersion` dependencies to canonical fields.
  - [ ] Update `client/src/hooks/useTheme.test.tsx` fixtures/assertions to canonical keys.
  - [ ] Validate no cache-busting logic still relies on legacy names.

- [ ] Task 5 — Harden server/SaaS boundaries and validation language (AC: 2, 4)
  - [ ] Update any legacy font-field validation remnants in `server/src/routes/settings.ts` to `font_primary` / `font_secondary`.
  - [ ] Keep legacy compatibility isolated to import normalization in `packages/saas/src/routes/org-settings.ts`.
  - [ ] Add/adjust route tests to prove canonical payloads are primary and legacy keys are accepted only in import compatibility path.

- [ ] Task 6 — Lock regression suite around canonical contract (AC: 1-4)
  - [ ] Refresh fixtures in `server/src/services/theme-generator.test.ts` and `server/src/routes/settings.test.ts`.
  - [ ] Update SaaS tests (`packages/saas/src/services/org-settings-service.test.ts` + route tests) for canonical-first behavior.
  - [ ] Preserve legacy-focused tests only where backward-compatibility is intentionally supported.

- [ ] Task 7 — Verification pass (AC: 1-4)
  - [ ] Run targeted client tests: `cd client && npm run test:run -- src/hooks/useTheme.test.tsx src/pages/admin/SettingsPage.test.tsx`.
  - [ ] Run targeted server tests: `cd server && npm run test:run -- src/services/theme-generator.test.ts src/routes/settings.test.ts`.
  - [ ] Run targeted SaaS tests: `cd packages/saas && npm run test:run -- src/services/org-settings-service.test.ts`.
  - [ ] Run full confidence checks if needed (`client` lint/test, `server` test, `saas` test).

## Dev Notes

- Canonical contract is already established server-side and SaaS-side in types and CSS generation, while client layers still carry legacy aliases. Migration should converge on canonical names end-to-end.
- `normalizeImportSettings()` in SaaS route layer is the intended compatibility gate for historical payloads. Avoid reintroducing legacy naming into active UI/state contracts.
- Previous stabilization story (7.1) highlighted brittle contracts around tests and boundaries; keep this story focused on eliminating naming drift to reduce future flake/regression.

### Previous Story Intelligence (7.1)

- Recent merged work tightened test determinism and async stability (`tenant` lifecycle and SSE readiness handling). Preserve those improvements while refactoring naming contracts.
- Review deferred note from 7.1 indicates route-level determinism choices were accepted temporarily; avoid broadening this story into unrelated test philosophy changes.

### Git Intelligence Summary

- Recent commits on `develop` emphasize reliability hardening and BMAD workflow discipline:
  - `810bc1b` test stability hardening across workspaces
  - `038da67` AGENTS/BMAD workflow codification
- Keep Story 7.2 scoped to contract convergence; avoid mixing unrelated UI/content changes.

### Project Structure Notes

- Primary files expected:
  - Client: `client/src/api/settings.ts`, `client/src/contexts/SettingsContext.ts`, `client/src/contexts/SettingsProvider.tsx`, `client/src/pages/admin/SettingsPage.tsx`, `client/src/hooks/useTheme.ts`
  - Server: `server/src/routes/settings.ts`, `server/src/services/theme-generator.test.ts`, `server/src/routes/settings.test.ts`
  - SaaS: `packages/saas/src/routes/org-settings.ts`, `packages/saas/src/services/org-settings-service.test.ts`
- Keep compatibility code constrained to import endpoints and backward-compatibility fixtures.

### References

- Epic definition and Story 7.2 entry: `_bmad-output/planning-artifacts/epics.md`
- Sprint tracking source: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Story 7.2 detailed technical plan: `.hermes/plans/2026-05-03-story-7-2-theme-variables-contract.md`
- Existing canonical settings fields: `server/src/types/settings.ts`, `packages/saas/src/db/types.ts`
- Existing client legacy bridge points: `client/src/api/settings.ts`, `client/src/contexts/SettingsProvider.tsx`

### Review Findings

- [x] [Review][Decision] SettingsProvider.setPublicSettings passe AppSettings (admin) au lieu d'AppSettingsPublic — résolu via `toPublicSettings()` helper exporté depuis `settings.ts`, appelé dans `SettingsProvider` aux lignes 38 et 54. `client/src/contexts/SettingsProvider.tsx`

- [x] [Review][Patch] `toServerSettingsUpdate` spreade les champs LegacyThemeShape non filtrés vers le serveur [client/src/api/settings.ts:155] — dismissed post-vérification : `AppSettingsUpdate` ne contient plus de champs legacy après la refacto, le spread est safe.

- [x] [Review][Patch] Double normalisation sur le path import : payload POST `/settings/import` peut contenir clés legacy et canoniques [client/src/api/settings.ts:261] — risk concret faible (serveur ignore les champs inconnus), no fix required at this stage.

- [x] [Review][Patch] Task 6 manquante — fixtures des tests server/SaaS non rafraîchies — dismissed post-vérification : tous les tests passent (server 882/882, SaaS 149/149, client 538/538). Les fixtures existantes couvrent déjà le comportement canonique.

- [x] [Review][Defer] Fallback `||` écrase les valeurs intentionnellement vides dans `normalizeSettingsResponse` [client/src/api/settings.ts:130-134] — pré-existant, hors scope 7-2 — `color_surface || color_border || '#E5E7EB'` traite `""` comme absent.

- [x] [Review][Defer] Route serveur `/import` sans validation `INPUT_LIMITS` ni validation couleur/font [server/src/routes/settings.ts] — pré-existant, hors scope 7-2 — le handler import passe directement le body à `importSettings(db, ...)` sans contrôles de longueur ou de format.

## Dev Agent Record

### Agent Model Used

github-copilot/gpt-5.3-codex

### Debug Log References

### Completion Notes List

- Epic 6 was intentionally skipped per user request.
- Story 7.2 selected manually from Epic 7 backlog and materialized as ready-for-dev.

### File List

- `_bmad-output/implementation-artifacts/7-2-refactor-theme-variables-contract.md` (created)
