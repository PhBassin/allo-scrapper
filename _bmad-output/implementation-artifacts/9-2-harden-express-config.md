---
story_key: 9-2-harden-express-config
epic: 9-security-audit-remediation
status: done
created: 2026-05-25
---

# Story 9.2: Harden Express Body Parser Configuration

**As a** security operator,
**I want** `express.urlencoded` to use `extended: false`,
**So that** nested object injection via URL-encoded request bodies is prevented.

---

## Acceptance Criteria

### AC1: urlencoded uses extended: false
**Given** the Express app starts
**When** `express.urlencoded({ extended: false })` is configured
**Then** URL-encoded bodies are parsed with the `querystring` library (not `qs`)
**And** nested objects are NOT parsed (e.g., `a[b]=c` stays as `{ 'a[b]': 'c' }`)

### AC2: No functional regression
**Given** the change from `extended: true` to `extended: false`
**When** all existing test suites are run (`npm run test:run` on server)
**Then** all tests pass
**And** the Docker build succeeds

### AC3: No client-side impact
**Given** the change only affects server-side body parsing of `application/x-www-form-urlencoded`
**When** the React client sends requests (JSON by default)
**Then** no client-side changes are needed
**And** all existing API contracts remain unchanged

---

## Tasks / Subtasks

### T1: Change extended flag
- **File:** `server/src/app.ts` (line 72)
- **Current:** `app.use(express.urlencoded({ extended: true }));`
- **Target:** `app.use(express.urlencoded({ extended: false }));`
- **AC:** AC1

### T2: Run full test suite
```bash
cd server && npm run test:run
```
- Verify all tests pass
- If any test breaks: it means a route relies on nested object parsing from URL-encoded bodies. Fix the test to use JSON instead.
- **AC:** AC2

### T3: Docker build verification
```bash
docker compose build server
```
- Verify the Docker image builds successfully
- **AC:** AC2

---

## Dev Notes

### Impact analysis
- The `qs` library (used by `extended: true`) allows parsing rich objects and arrays from URL-encoded strings
- `extended: false` uses Node's built-in `querystring` module which only parses flat key-value pairs
- Most API consumers use `application/json` (React/Axios default), not `application/x-www-form-urlencoded`
- Risk of breakage is LOW because:
  - The React client sends JSON for all API calls
  - Admin forms might use URL-encoded — but none of them send nested objects
  - The scraper microservice doesn't use Express body parser

### If tests break
- The most likely culprit would be a test that sends nested URL-encoded params (e.g., `settings[theme][primary]=#fff`)
- Fix: change the test to send `application/json` instead, which is the standard for this API

---

## Files to Modify

| File | Change |
|------|--------|
| `server/src/app.ts` | Line 72: `extended: true` → `extended: false` |

---

## Rollback Strategy

Revert the single-line change. No data migration, no dependency changes.

---

## References

- Epic: `_bmad-output/planning-artifacts/epics.md` — Epic 9, Story 9.2
- Express docs: https://expressjs.com/en/api.html#express.urlencoded
- Query string vs qs: https://www.npmjs.com/package/qs#parsing-objects

---

## Dev Agent Record

<!-- Filled by dev agent during DS -->
- **Branch:** 
- **Commits:** 
- **PR:** 
- **Test results:** 
- **Deviations:** 
