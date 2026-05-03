# Story 5.1: Theme Switching E2E Regression Tests

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a QA engineer,
I want E2E tests that validate theme changes apply consistently across all pages,
So that white-label customizations don't cause CSS conflicts.

## Acceptance Criteria

1. **Given** an admin changes the primary color to `#FF5733`
   **When** the theme is saved
   **Then** all buttons across the application use `#FF5733`
   **And** the header background uses the configured secondary color
   **And** no CSS conflicts or stale overrides occur

2. **Given** an admin changes the heading font to `"Poppins"`
   **When** the theme is saved
   **Then** all `h1`-`h6` elements use `"Poppins"`
   **And** body text uses the configured body font
   **And** font loading is validated across the exercised pages

3. **Given** a custom theme is applied
   **When** I navigate across multiple pages (home, admin/settings, cinema page)
   **Then** all pages reflect the custom theme consistently
   **And** no page shows default Allo-Scrapper branding while the custom site name is active
   **And** the theme stylesheet remains the single source of truth for branding styles

## Tasks / Subtasks

- [ ] Write RED E2E coverage for theme switching regressions before implementation (AC: 1, 2, 3)
  - [ ] Replace the current weak assertions in `e2e/theme-application.spec.ts` with deterministic checks that fail if theme variables are not actually applied to rendered UI
  - [ ] Add a theme-switching flow that updates settings through the real admin UI using a deterministic route (`/admin?tab=settings` in non-SaaS mode or `/org/:slug/admin?tab=settings` in SaaS mode) rather than only checking that upload widgets exist
  - [ ] Treat the existing spec login/navigation assumptions as suspect and correct them against the live UI contract (current login inputs use `#username` and `#password`, and direct settings-tab navigation is more reliable than relying on a nonexistent dropdown settings link)
  - [ ] Keep the tests isolated by restoring defaults at the end of each mutation scenario

- [ ] Validate primary-color propagation on real UI elements (AC: 1)
  - [ ] Update branding through the settings page to set `color_primary` to `#FF5733`
  - [ ] Assert rendered button styles use the updated primary color on the home page and at least one admin page action
  - [ ] Assert the header background reflects the configured secondary color and does not fall back to the default palette
  - [ ] Verify the dynamic stylesheet link (`#dynamic-theme`) remains mounted and the relevant CSS custom properties reflect the saved values

- [ ] Validate heading/body font propagation (AC: 2)
  - [ ] Update the heading font to `Poppins` and body font to a contrasting configured font already supported by the white-label system
  - [ ] Assert computed font family for representative headings (`h1`/`h2`) matches the configured heading font on multiple pages
  - [ ] Assert representative body text uses the configured body font and that font configuration survives navigation and reload
  - [ ] If necessary, wait for `document.fonts.ready` or equivalent browser-supported readiness signal to avoid false negatives

- [ ] Validate cross-page branding consistency and stale-style cleanup (AC: 3)
  - [ ] Save a custom site name and verify it appears in header, footer, and document title across the exercised route set
  - [ ] Navigate across home, admin/settings, and at least one cinema route to confirm the custom branding persists everywhere
  - [ ] Revert to defaults (or a second theme) and assert previous theme values no longer persist in computed styles or visible branding text
  - [ ] Confirm no default Allo-Scrapper branding remains visible while the custom site name is active, except where explicitly intended by immutable product copy

- [ ] Keep the story narrowly scoped to regression coverage plus the smallest missing product/test seam (AC: 1, 2, 3)
  - [ ] Reuse the existing white-label runtime (`useTheme`, `/api/theme.css`, `SettingsProvider`, admin settings API) instead of inventing a second theming mechanism
  - [ ] Add only the minimal stable selectors or helper seams needed for deterministic assertions
  - [ ] Do not fold CSP validation into this story; that belongs to Story `5.2`

- [ ] Verify with focused commands after implementation
  - [ ] Run the new theme regression spec directly, preferably with `npm run e2e -- --project=chromium --grep "White-Label Theme Application|Theme Switching"`
  - [ ] Run any focused client tests touched by new selectors or theme helpers
  - [ ] Run any relevant build/lint command required by the changed files

## Dev Notes

### Scope and Guardrails

- Epic 5 is an independent low-priority validation epic focused on white-label theme consistency and CSP strict mode. Story `5.1` is the first story in that epic and must stay focused on theme regression coverage, not security-policy enforcement. [Source: `_bmad-output/planning-artifacts/epics.md:1275-1314`, `_bmad-output/planning-artifacts/notes-epics-stories.md:284-301`]
- The acceptance criteria explicitly require validation of real theme switching across multiple pages, so a test that only checks for the presence of `/api/theme.css` or settings form widgets is insufficient. The story should prove rendered UI behavior, not merely implementation plumbing. [Source: `_bmad-output/planning-artifacts/epics.md:1288-1312`]
- QA planning already classifies theme-conflict coverage as low-risk exploratory work (`RISK-008`) with two existing E2E targets: apply custom theme and verify CSS variables, then switch themes and confirm no artifacts persist. Story `5.1` should harden those into deterministic regression coverage. [Source: `_bmad-output/test-artifacts/test-design/test-design-qa.md:317-328`]

### Critical Current-Code Reality

- There is already an `e2e/theme-application.spec.ts`, but it is only partial coverage. It verifies defaults, weakly checks CSS-variable existence, and contains a logo test that explicitly skips real upload behavior. It also contains stale assumptions about login selectors/credentials and navigation seams, so it must not be treated as an authoritative source of truth while implementing this story. It does not currently prove that primary color and font changes propagate to rendered controls across pages, nor that stale theme values are cleaned up after switching. [Source: `e2e/theme-application.spec.ts:1-232`, `client/src/pages/LoginPage.tsx:84-104`, `client/src/components/Layout.tsx:128-179`]
- The theme runtime is already wired through `useTheme()`, which injects `link#dynamic-theme` pointing to `/api/theme.css`, updates the favicon, and updates `document.title` from public settings. Reuse this seam; do not create inline-style workarounds or a second theme loader. [Source: `client/src/hooks/useTheme.ts:1-51`, `client/src/App.tsx:57-64`]
- The server already exposes public/admin settings routes and persists branding changes through `PUT /api/settings`. This story should exercise those existing routes via the admin UI rather than inventing a test-only backdoor. However, the client and server are not currently using identical field names for typography/text settings (`font_family_heading` / `font_family_body`, `color_text` on the client versus `font_primary` / `font_secondary`, `color_text_primary` on the server/theme CSS). The implementation must either bridge that seam explicitly or correct the contract rather than assuming the runtime is already perfectly aligned. [Source: `server/src/routes/settings.ts:41-205`, `client/src/pages/admin/SettingsPage.tsx:73-135`, `client/src/api/settings.ts:15-67`, `server/src/types/settings.ts:37-78`, `server/src/services/theme-generator.ts:156-179`]
- The current admin settings UI loads inside `AdminPage` tab `settings` and supports editing site name, colors, typography, footer, and email branding. Stable save feedback already exists via the `Settings saved successfully` success message and `data-testid="save-settings-button"`. [Source: `client/src/pages/admin/AdminPage.tsx:14-193`, `client/src/pages/admin/SettingsPage.tsx:149-427`]
- The layout and footer already consume `publicSettings.site_name`, `logo_base64`, and `footer_text`, making header/footer/title branding assertions feasible without extra product work. However, there is no explicit stable selector for an “admin settings” dropdown link in the current layout implementation; the existing spec references one, but it does not exist. Prefer direct navigation to the settings tab unless a tiny stable selector is genuinely needed. [Source: `client/src/components/Layout.tsx:13-227`, `e2e/theme-application.spec.ts:45-81`, `client/src/App.tsx:115-123`, `client/src/App.tsx:175-205`]
- The theming contract is currently split across two CSS-variable namespaces: the client Tailwind/fallback layer uses `--theme-color-*` and `--theme-font-*`, while the server-generated `/api/theme.css` currently emits `--color-*` and `--font-*`. Any implementation work for this story must verify how rendered UI actually consumes theme updates and, if necessary, add the smallest correction needed so E2E assertions are validating the real production path rather than a broken or mismatched variable seam. [Source: `client/tailwind.config.js:6-22`, `client/src/index.css:8-47`, `server/src/services/theme-generator.ts:156-179`]

### Reinvention Prevention

- Reuse the existing Playwright harness and theme spec file under `e2e/`; do not introduce Cypress or a parallel browser-test framework. [Source: `playwright.config.ts`, `e2e/theme-application.spec.ts:1-232`]
- Reuse the existing white-label architecture: `SettingsProvider` for data, `useTheme` for stylesheet/title/favicon application, `/api/theme.css` for runtime theming, and `SettingsPage` for admin updates. [Source: `client/src/App.tsx:15-24`, `client/src/hooks/useTheme.ts:1-51`, `client/src/pages/admin/SettingsPage.tsx:38-427`]
- Reuse the documented white-label contract rather than redefining setting names. The docs and runtime agree that site name, colors, fonts, footer content, and favicon are first-class branding settings. [Source: `docs/guides/administration/white-label.md:24-200`, `docs/reference/architecture/white-label-system.md:45-158`]
- Prefer direct URL navigation to the settings tab if the current user-menu path is not backed by a reliable selector in `Layout.tsx`; only add the smallest selector needed if direct navigation cannot cover the intended flow. [Source: `client/src/components/Layout.tsx:128-179`, `client/src/App.tsx:115-123`]

### Cross-Story Intelligence

- Story `0.1` enabled Playwright parallel execution but carved out scrape-sensitive specs. Theme regression is read/write UI work against shared settings, so keep the spec deterministic, isolate mutations, and consider serial grouping if parallel writes to shared branding state would make the suite flaky. [Source: `_bmad-output/implementation-artifacts/0-1-enable-playwright-parallel-execution.md:22-40`, `playwright.config.ts`]
- Existing white-label docs already promise that branding updates appear immediately without rebuild and that `/api/theme.css` is the runtime source for CSS variables. Story `5.1` should validate that promise end-to-end rather than adding new behavior. [Source: `docs/reference/architecture/white-label-system.md:30-42`, `docs/reference/architecture/white-label-system.md:97-158`]

### Architecture Compliance Notes

- Keep UI assertions grounded in computed browser styles (`getComputedStyle`) and visible branding text; this story is about integration behavior across the actual React app and generated stylesheet.
- Do not assume the current theme/settings contract is already coherent. Resolve or explicitly bridge any client/server mismatches in setting names and CSS-variable namespaces as part of making the regression path testable, but keep the fix minimal and local to the existing white-label runtime.
- Keep any product changes minimal and local: likely inside `Layout`, `SettingsPage`, `SettingsProvider`, the client settings typings, the server theme/settings contract, or the existing E2E spec/helpers. Do not add a new theme state manager or duplicate settings APIs.
- Use strict TypeScript and existing test conventions if helper utilities or selectors need to be introduced in client code or tests. [Source: `_bmad-output/project-context.md`, existing client/E2E patterns]

### Library / Framework Requirements

- Use Playwright as the primary validation tool for this story. The root script is `npm run e2e`, and focused execution should stay within the existing Playwright project structure. [Source: `package.json`, `playwright.config.ts`]
- Continue using the current browser-driven flow for admin login and navigation; do not mock the theme API responses in the main regression path. The purpose is to validate the real runtime behavior through the mounted application. [Source: `e2e/theme-application.spec.ts:34-163`, `server/src/routes/settings.ts:41-205`]
- If helper/unit coverage becomes necessary for added selectors or tiny theme seams, continue using Vitest/RTL rather than introducing new test tooling. [Source: repository test conventions, `client/src/App.test.tsx`]

### Testing Requirements

- Cover a real admin-driven theme update that changes primary color and verifies the resulting rendered button/background styles on multiple pages.
- Cover a real admin-driven typography update that verifies computed font family on headings and body text across multiple pages.
- Cover a cross-page branding pass that validates custom site name/title/footer consistency and confirms stale theme values disappear after reset or second switch.
- Make the runtime target explicit before implementing assertions: choose either the classic `/admin` app or the SaaS `/org/:slug/admin` app for the main regression path, and keep route/login assumptions aligned with the live UI.
- Keep cleanup explicit so shared branding state returns to defaults after each mutation scenario.
- If existing selectors are too brittle, add the smallest stable hooks needed for Playwright assertions.

### Suggested Implementation Strategy

1. Inspect the existing theme E2E spec and replace placeholder assertions with concrete computed-style checks.
2. Choose the exact runtime and route set for cross-page validation: classic `/admin` or SaaS `/org/:slug/admin`, plus home and a cinema page with stable visible UI.
3. RED: write failing Playwright assertions for color propagation, font propagation, and stale-theme cleanup.
4. Verify the actual theme/settings contract in code before fixing tests: field-name mismatches and CSS-variable namespace mismatches are known risks and may require a minimal product seam correction.
5. Add only the smallest deterministic UI/test seam required (for navigation or stable element targeting) if the current UI lacks reliable selectors.
6. Re-run the focused theme spec plus any touched client tests/build checks.

### Concrete File Targets

- `_bmad-output/implementation-artifacts/5-1-theme-switching-e2e-regression-tests.md`
- `e2e/theme-application.spec.ts`
- `client/src/components/Layout.tsx` only if a minimal stable selector/navigation seam is needed
- `client/src/pages/admin/SettingsPage.tsx` only if a minimal stable selector for theme fields/tabs/save flow is needed
- `client/src/hooks/useTheme.ts` only if a defect is found in the existing runtime behavior under test
- Potentially one or more small client tests if product selectors/seams change

### Pitfalls to Avoid

- Do not treat presence of `link#dynamic-theme` alone as proof that theming works.
- Do not hardcode assertions against stale implementation details from the current spec if the UI does not actually expose them (for example, nonexistent menu items/selectors or outdated login selectors/credentials).
- Do not mix CSP/security assertions into this story; save them for Story `5.2`.
- Do not leave mutated branding state behind for later E2E specs.
- Do not rely solely on CSS-variable existence; verify rendered UI consumes those variables correctly.
- Do not assume the current client/server setting names or CSS-variable names already line up; verify and fix the seam explicitly if the regression path is currently broken.
- Do not introduce a test-only theming API or mock the main runtime path.

### Project Structure Notes

- Sprint status currently shows Epic 5 and Story `5.1` as backlog. Creating this story should move Epic 5 to `in-progress` and Story `5.1` to `ready-for-dev`. [Source: `_bmad-output/implementation-artifacts/sprint-status.yaml:100-107`]
- Epic 4 story `4.3` already has a retroactive done file despite remaining backlog in sprint status, so story-file creation should stay narrowly focused on the requested next story rather than correcting unrelated planning drift in this task. [Source: `_bmad-output/implementation-artifacts/4-3-ci-pipeline-migration-idempotency-validation.md:1-21`, `_bmad-output/implementation-artifacts/sprint-status.yaml:94-98`]

### References

- `_bmad-output/planning-artifacts/epics.md:1275-1314` — Epic 5 and Story 5.1 definition
- `_bmad-output/planning-artifacts/notes-epics-stories.md:284-301` — Epic 5 summary notes
- `_bmad-output/test-artifacts/test-design/test-design-qa.md:317-328` — RISK-008 / exploratory E2E targets
- `e2e/theme-application.spec.ts:1-232` — existing theme E2E coverage to strengthen and partially correct
- `client/src/hooks/useTheme.ts:1-51` — dynamic theme loader/title/favicon hook
- `client/src/App.tsx:57-64` — theme hook mounted at app root
- `client/src/App.tsx:115-123` — classic admin route
- `client/src/App.tsx:175-205` — SaaS org-scoped admin route
- `client/src/components/Layout.tsx:13-227` — header/footer/site-name runtime usage and available navigation seams
- `client/src/pages/LoginPage.tsx:84-104` — actual login input selectors used by the UI
- `client/src/pages/admin/AdminPage.tsx:14-193` — settings tab routing
- `client/src/pages/admin/SettingsPage.tsx:38-427` — admin settings UI and save flow
- `client/src/api/settings.ts:15-67` — current client settings field names
- `client/src/contexts/SettingsProvider.tsx:16-97` — client-side public/admin settings mapping
- `client/tailwind.config.js:6-22` — client theme CSS-variable namespace used by Tailwind
- `client/src/index.css:8-47` — client fallback CSS-variable namespace and body font usage
- `server/src/routes/settings.ts:41-205` — public/admin settings persistence routes
- `server/src/types/settings.ts:37-78` — server public/update settings contract
- `server/src/services/theme-generator.ts:1-250` — generated CSS variables and Google Fonts support
- `docs/guides/administration/white-label.md` — admin white-label guide
- `docs/reference/architecture/white-label-system.md` — white-label architecture and `/api/theme.css` flow

### Review Findings

- [x] [Review][Patch] Le runtime standalone du thème pointait vers un endpoint inexistant [`client/src/hooks/useTheme.ts`] — corrigé via un `buildThemeHref()` tenant-aware/standalone-aware et couvert par `client/src/hooks/useTheme.test.tsx`.
- [x] [Review][Patch] Le scénario E2E principal ciblait les contrôles de settings par position [`e2e/theme-application.spec.ts`] — corrigé via des sélecteurs stables basés sur labels/roles et helpers dédiés (`setColorField`, combobox nommées).
- [x] [Review][Patch] AC1 n’était pas complètement démontrée sur la propagation visuelle du thème [`e2e/theme-application.spec.ts`] — corrigé via assertions explicites sur variables CSS, header en `color_secondary`, bouton admin d’action et surfaces UI visibles.
- [x] [Review][Patch] AC2/AC3 restaient incomplètes sur la typographie et le parcours multi-pages [`e2e/theme-application.spec.ts`] — corrigé via scénario admin réel couvrant second switch/import, navigation multi-pages, heading/body fonts et reset final nettoyant le branding précédent.
- [x] [Review][Patch] La stack Docker de dev pouvait servir un runtime SaaS obsolète après démarrage [`docker-compose.dev.yml`] — corrigé via watchers continus pour `@allo-scrapper/logger`, `allo-scrapper-server` et `@allo-scrapper/saas`, avec runtime lancé depuis `server/dist/index.js`.

#### Code Review — 2026-05-03

- [x] [Review][Patch] Second `useEffect` sans dep array dans `useTheme` [`client/src/hooks/useTheme.ts`] — faux positif, dep array `[]` déjà présent
- [x] [Review][Patch] AC1 — assertion `background-color` des `<button>` [`e2e/theme-application.spec.ts`] — faux positif, assertion déjà présente
- [x] [Review][Patch] AC2 — `document.fonts.ready` avant assertion `fontFamily` [`e2e/theme-application.spec.ts`] — faux positif, déjà présent
- [x] [Review][Patch] AC2 — assertion font body text [`e2e/theme-application.spec.ts`] — faux positif, déjà présente
- [x] [Review][Patch] AC1 — assertion `background-color` du `<header>` [`e2e/theme-application.spec.ts`] — faux positif, déjà présente
- [x] [Review][Patch] AC3 — navigation multi-pages après save [`e2e/theme-application.spec.ts`] — faux positif, film page déjà couverte
- [x] [Review][Patch] `setColorField` sélecteur `getByLabel` ambigu [`e2e/theme-application.spec.ts`] — corrigé : sélecteur ciblant `input[type="color"]` dans le conteneur labellé
- [x] [Review][Patch] `loginAsSeededAdmin` trailing slash `waitForURL` [`e2e/theme-application.spec.ts`] — faux positif, glob `**` matche avec ou sans slash
- [x] [Review][Patch] `buildFixtureFilmId` incompatible auto-increment [`e2e/theme-application.spec.ts`] — faux positif, serveur fixture utilise la même fn
- [x] [Review][Patch] `updateSettingsHandler` — `req.body` non validé comme objet [`packages/saas/src/routes/org-settings.ts`] — corrigé : guard object ajouté
- [x] [Review][Patch] `color_surface = ""` passe le `??` opérateur [`client/src/api/settings.ts`] — corrigé : `??` → `||` dans `normalizeSettingsResponse`
- [x] [Review][Patch] `ScrapeMode` change sans migration DB [`packages/saas/src/db/types.ts`] — faux positif, contrainte DB n'a jamais inclus `'daily'`/`'manual'`
- [x] [Review][Patch] Pas d'assertion CSS variables disparues après reset [`e2e/theme-application.spec.ts`] — corrigé : assertions `resetRootVariables` ajoutées
- [x] [Review][Defer] Import SaaS depuis `dist/` avec `@ts-ignore` — deferred, pré-existant
- [x] [Review][Defer] Permissions `settings:export/import/reset` absentes du registre — deferred, hors-scope PR
- [x] [Review][Defer] `tsx watch` sans coordination `tsc --watch` — deferred, pré-existant
- [x] [Review][Defer] Pas de `test.describe.serial` pour writes E2E — deferred, flakiness à traiter séparément

## Dev Agent Record

### Agent Model Used

github-copilot/gpt-5.4

### Debug Log References

- `session_search("story OR prochain story OR allo-scrapper OR BMAD")`
- `read_file("AGENTS.md")`
- `read_file("_bmad-output/implementation-artifacts/sprint-status.yaml")`
- `read_file("_bmad-output/planning-artifacts/epics.md")`
- `read_file("_bmad-output/planning-artifacts/notes-epics-stories.md")`
- `read_file("_bmad-output/test-artifacts/test-design/test-design-qa.md")`
- `read_file("docs/guides/administration/white-label.md")`
- `read_file("docs/reference/architecture/white-label-system.md")`
- `read_file("docs/project/white-label-plan.md")`
- `read_file("e2e/theme-application.spec.ts")`
- `read_file("client/src/App.tsx")`
- `read_file("client/src/components/Layout.tsx")`
- `read_file("client/src/pages/admin/AdminPage.tsx")`
- `read_file("client/src/pages/admin/SettingsPage.tsx")`
- `read_file("client/src/hooks/useTheme.ts")`
- `read_file("server/src/routes/settings.ts")`
- `read_file("server/src/services/theme-generator.ts")`
- `terminal("date -u +\"%Y-%m-%dT%H:%M:%SZ\"")`

### Completion Notes List

- Created Story `5.1` as the next backlog story after the current Epic 4 work, following the existing BMAD artifact format.
- Grounded the story in current code reality: existing but incomplete `e2e/theme-application.spec.ts`, live `/api/theme.css` runtime, admin settings tab flow, and RISK-008 QA notes.
- Kept Story `5.2` out of scope except for explicit boundary notes.

### File List

- `_bmad-output/implementation-artifacts/5-1-theme-switching-e2e-regression-tests.md`
