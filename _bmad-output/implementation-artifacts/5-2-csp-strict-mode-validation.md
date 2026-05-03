# Story 5.2: CSP Strict Mode Validation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a security engineer,
I want the application to enforce CSP without `unsafe-inline`/`unsafe-eval` in `script-src`,
So that XSS vulnerabilities are mitigated.

## Acceptance Criteria

1. **Given** the application is running
   **When** I inspect the HTTP response headers on any page
   **Then** the `Content-Security-Policy` header is present
   **And** the policy does NOT include `unsafe-inline` in `script-src`
   **And** the policy does NOT include `unsafe-eval` in `script-src`

2. **Given** a white-label theme is applied
   **When** the theme CSS is loaded
   **Then** no inline `<style>` tags are injected into the HTML document body
   **And** all theme styles are delivered via the external `/api/theme.css` endpoint
   **And** CSP validation passes (no violations reported) in the browser

3. **Given** CSP strict mode is enforced
   **When** I run E2E tests with the full application running
   **Then** no `securitypolicyviolation` events are fired during normal navigation and theme usage
   **And** all theme customizations (color, font, site name) load and render correctly
   **And** no blocked resources are detected in the browser console

## Tasks / Subtasks

- [x] Add E2E spec `e2e/csp-strict-mode.spec.ts` covering CSP header assertions (AC: 1)
  - [x] Fetch the app root via Playwright's `request` context and assert `content-security-policy` header is present
  - [x] Parse the `script-src` directive and assert it does NOT contain `'unsafe-inline'` or `'unsafe-eval'`
  - [x] Assert `object-src 'none'` and `base-uri 'self'` are present (defence-in-depth assertions)

- [x] Add E2E scenario asserting no inline `<style>` body injection (AC: 2)
  - [x] Navigate to the app root after a white-label theme has been applied (reuse seeded-admin fixture to set a custom color)
  - [x] Assert that `document.querySelectorAll('body style').length === 0` — all theme styles arrive via `<link rel="stylesheet" href="/api/theme.css">`
  - [x] Assert the dynamic theme `<link id="dynamic-theme">` element is present and its `href` points to `/api/theme.css`

- [x] Add E2E scenario capturing `securitypolicyviolation` events during navigation (AC: 3)
  - [x] Register a `page.on('console', ...)` listener and a `page.evaluate` `securitypolicyviolation` listener before navigation
  - [x] Navigate through home, admin/settings, and a cinema-list page while a custom theme is active
  - [x] Assert that no CSP violation events were captured
  - [x] Assert that theme colors and fonts render correctly (reuse pattern from `e2e/theme-application.spec.ts` for CSS-variable checks)

- [x] Verify existing unit tests in `server/src/middleware/csp-validation.test.ts` still pass and add any missing coverage (AC: 1)
  - [x] Confirm `script-src 'self'` is the complete `script-src` — no additional unsafe tokens
  - [x] Add assertion that `form-action 'self'` and `frame-ancestors 'none'` are present
  - [x] Run `cd server && npm run test:run` and confirm green

- [x] Update `sprint-status.yaml` to reflect `5-2` → `done` after all tasks complete

## Dev Notes

### CSP Current State (as of 2026-05-03)

`server/src/app.ts:111-130` configures Helmet with the following directives:

```
defaultSrc: ['self']
scriptSrc: ['self']                        ← no unsafe-inline / unsafe-eval ✓
styleSrc: ['self', 'unsafe-inline']        ← intentional: React inline styles (ScrapeProgress, ColorPicker, FontSelector)
styleSrcElem: ['self', 'unsafe-inline', 'https://fonts.googleapis.com']
imgSrc: ['self', 'data:', 'https://*.acsta.net', 'https://*.allocine.fr']
connectSrc: ['self']
fontSrc: ['self', 'data:', 'https://fonts.gstatic.com']
objectSrc: ['none']
baseUri: ['self']
formAction: ['self']
frameAncestors: ['none']
```

`unsafe-inline` in `style-src` is a **known, intentional exception** for three React components that use the `style` prop:
- `client/src/components/ScrapeProgress.tsx:139,162,215,225` — progress bar widths (`style={{ width: \`${n}%\` }}`)
- `client/src/components/admin/ColorPicker.tsx:56,101` — live color preview swatch
- `client/src/components/admin/FontSelector.tsx:101` — live font preview panel

This story does **not** require removing `unsafe-inline` from `style-src`. The acceptance criteria targets `script-src` only. Future hardening of `style-src` (nonces or CSS-variable injection) is out of scope here.

### Theme Delivery

Theme CSS is generated server-side and served at `/api/theme.css` by `server/src/services/theme-generator.ts`. The client loads it via a `<link id="dynamic-theme">` injected by `client/src/hooks/useTheme.ts`. No inline `<style>` tags are generated for theme delivery — the inline-style exception is limited to the three UI components above.

### E2E Pattern

Follow the session setup pattern from `e2e/theme-application.spec.ts`: use `fixtures/` helpers for seeded-admin login, apply a theme via the admin settings API, then assert. The new spec should be **non-mutating at teardown** (restore default branding before exit) so it does not pollute other specs.

Scope the new spec to `test.describe.serial` since it writes settings state.

### Existing Unit Test Coverage

`server/src/middleware/csp-validation.test.ts` already covers:
- No `unsafe-inline` in `script-src`
- No `unsafe-eval` in `script-src`
- `default-src 'self'`, `script-src 'self'`, `object-src 'none'`, `base-uri 'self'`
- `unsafe-inline` present in `style-src` (intentional)

Gaps to fill: `form-action 'self'` and `frame-ancestors 'none'` assertions.

### Project Structure Notes

- Sprint status shows `5-2` as `backlog`. Creating this story moves it to `ready-for-dev`.
- Epic 5 remains `in-progress` (5-1 done, 5-2 ready-for-dev).

### References

- `server/src/app.ts:111-130` — Helmet CSP configuration
- `server/src/middleware/csp-validation.test.ts` — existing unit tests
- `server/src/app.test.ts` — Google Fonts CSP assertions
- `client/src/hooks/useTheme.ts` — dynamic theme link injection
- `client/src/components/ScrapeProgress.tsx:139,162,215,225` — inline style (progress widths)
- `client/src/components/admin/ColorPicker.tsx:56,101` — inline style (color swatch)
- `client/src/components/admin/FontSelector.tsx:101` — inline style (font preview)
- `e2e/theme-application.spec.ts` — reuse login/settings fixture helpers
- `_bmad-output/planning-artifacts/epics.md:1314-1338` — Story 5.2 epic definition
- `playwright.config.ts` — project config; add `csp-strict-mode.spec.ts` to standard `chromium` project

## Dev Agent Record

### Agent Model Used

github-copilot/claude-sonnet-4.6

### Completion Notes

- Created `e2e/csp-strict-mode.spec.ts` with 6 tests covering AC1 (4 header assertions), AC2 (inline style injection check), and AC3 (securitypolicyviolation listener + CSS-variable verification).
- AC1 tests (`CSP header assertions` describe block) run without requiring a live server state — use Playwright `request` context against app root.
- AC2/AC3 tests are guarded by `E2E_ENABLE_ORG_FIXTURE` and scoped to `test.describe.serial`.
- Added 2 new unit tests to `server/src/middleware/csp-validation.test.ts`: `form-action 'self'` and `frame-ancestors 'none'`.
- Server test suite: 882/882 passed, no regressions.
- `unsafe-inline` in `style-src` intentionally preserved and documented — only `script-src` is in scope for this story.

### File List

- `e2e/csp-strict-mode.spec.ts` — new E2E spec (AC1, AC2, AC3)
- `server/src/middleware/csp-validation.test.ts` — added `form-action` and `frame-ancestors` assertions

### Change Log

- 2026-05-03: Story 5.2 implemented — CSP E2E spec + unit test gaps filled
