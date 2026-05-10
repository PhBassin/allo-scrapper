# Story 8.1: Rename `film` → `movie` in All Code Layers

Status: review

Baseline Commit: c6f96a2 (develop HEAD)

## Story

As a developer,
I want the codebase to use `movie` instead of `film` everywhere,
so that the domain language is consistent and aligned with the product terminology.

## Acceptance Criteria

### Types & Interfaces
1. **Given** the TypeScript types in `client/src/types/index.ts`, `server/src/types/scraper.ts`, `scraper/src/types/scraper.ts`
   **When** I inspect type definitions
   **Then** all interfaces use `Movie` instead of `Film` (e.g., `Movie`, `MovieData`, `ScrapeMovieResult`)
   **And** all property names use `movie_id` instead of `film_id`

### React Components
2. **Given** components in `client/src/components/` and `client/src/pages/`
   **When** I list component files
   **Then** files are `MovieCard.tsx`, `MovieSearchBar.tsx`, `MoviePage.tsx` (not `Film*`)
   **And** all internal references, props, and hooks use `movie` terminology

### API Routes
3. **Given** server routes in `server/src/routes/`
   **When** I inspect route definitions
   **Then** routes use `/api/movies` instead of `/api/films`
   **And** files are `movies.ts`, `movie-service.ts`, `movie-queries.ts`

### Client API
4. **Given** the client API in `client/src/api/client.ts`
   **When** I inspect API functions
   **Then** all functions reference `/api/movies` endpoints
   **And** functions are named `getMovies`, `getMovieById`

### Scraper Parser
5. **Given** parser files in `scraper/src/scraper/`
   **When** I list parser files
   **Then** the parser is `movie-parser.ts` (not `film-parser.ts`)
   **And** test is `movie-parser.test.ts`, fixture is `movie-page.html`

### Database Schema
6. **Given** the DB schema in migrations and `docker/init.sql`
   **When** I inspect column definitions
   **Then** columns use `movie_id` instead of `film_id`
   **And** migration files are renamed (e.g., `020_add_movie_screenwriters.sql`)

### Scraper Queries
7. **Given** scraper DB queries in `scraper/src/db/`
   **When** I inspect query files
   **Then** file is `movie-queries.ts` (not `film-queries.ts`)
   **And** all SQL queries reference `movie_id` columns

### Tests
8. **Given** all test suites (`npm run test:run` in each workspace)
   **When** I run tests with the new `movie` nomenclature
   **Then** all tests pass
   **And** no test references residual `film` identifiers in business assertions

### Residual Cleanup
9. **Given** the rename is complete
   **When** I search the codebase for `film` (case-insensitive) in business logic
   **Then** no residual occurrences remain (except comments, test descriptions, legacy migration idempotency guards)
   **And** the application builds and runs identically to before the rename

### Non-Regression
10. **Given** the rename is deployed
    **When** I compare application behavior before and after
    **Then** all API endpoints return identical data structures (only key names differ)
    **And** the UI renders identically
    **And** scraping produces identical results

## Tasks / Subtasks

- [x] Task 1: Rename types and interfaces (AC: 1)
  - [x] `client/src/types/index.ts` — `Film` → `Movie`, `FilmData` → `MovieData`
  - [x] `server/src/types/scraper.ts` — `Film` → `Movie`
  - [x] `scraper/src/types/scraper.ts` — `Film` → `Movie`

- [x] Task 2: Rename React components (AC: 2)
  - [x] `FilmCard.tsx` → `MovieCard.tsx`
  - [x] `FilmSearchBar.tsx` → `MovieSearchBar.tsx`
  - [x] `FilmPage.tsx` → `MoviePage.tsx`

- [x] Task 3: Rename API routes and services (AC: 3)
  - [x] `server/src/routes/films.ts` → `movies.ts`
  - [x] `server/src/services/film-service.ts` → `movie-service.ts`
  - [x] `server/src/db/film-queries.ts` → `movie-queries.ts`

- [x] Task 4: Rename client API functions (AC: 4)
  - [x] `client/src/api/client.ts` — all `film` → `movie`

- [x] Task 5: Rename scraper parser (AC: 5)
  - [x] `scraper/src/scraper/film-parser.ts` → `movie-parser.ts`
  - [x] `scraper/tests/unit/scraper/film-parser.test.ts` → `movie-parser.test.ts`
  - [x] `scraper/tests/fixtures/film-page.html` → `movie-page.html`

- [x] Task 6: Rename database columns (AC: 6)
  - [x] `docker/init.sql` — `film_id` → `movie_id`
  - [x] Migration files renamed and updated

- [x] Task 7: Rename scraper DB queries (AC: 7)
  - [x] `scraper/src/db/film-queries.ts` → `movie-queries.ts`

- [x] Task 8: Update all tests (AC: 8)
  - [x] Client tests (22 files)
  - [x] Server tests (15+ files)
  - [x] Scraper tests (12+ files)
  - [x] SaaS tests (4 files)

- [x] Task 9: Verify residual cleanup (AC: 9)
- [x] Task 10: Verify non-regression (AC: 10)

## Dev Notes

- Pure rename refactoring — zero functional changes
- 89 files changed, +1563/-1506 lines
- Branch: `refactor/1015-rename-film-to-movie`
- 2 commits: `40c6068` (rename) + `6a18911` (test fixes)
- Naming conventions: PascalCase for types/components, camelCase for variables, kebab-case for files

### Project Structure Notes

- Monorepo: `client/`, `server/`, `scraper/`, `packages/saas/`
- ESM only — `"type": "module"` in all packages
- TypeScript strict mode enforced

### References

- Epic: `_bmad-output/planning-artifacts/epics.md#Epic 8`
- FR19-FR26: rename coverage
- NFR17-NFR20: quality gates

## Dev Agent Record

### Agent Model Used

deepseek-v4-pro (OpenCode)

### Debug Log References

N/A — review-only story (code already implemented)

### Completion Notes List

- Code is already implemented and pushed to `refactor/1015-rename-film-to-movie`
- Review target: `git diff develop...refactor/1015-rename-film-to-movie` (89 files)

### File List

See `git diff develop...refactor/1015-rename-film-to-movie --stat` for complete list of 89 files.
