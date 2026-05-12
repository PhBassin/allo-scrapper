# Story 9.1: Rename `cinema` → `theater` in All Code Layers

Status: done

Baseline Commit: b8036e4 (develop HEAD)

## Story

As a developer,
I want the codebase to use `theater` instead of `cinema` everywhere,
so that the domain language is consistent and aligned with the product terminology.

## Acceptance Criteria

### Types & Interfaces
1. **Given** the TypeScript types in `client/src/types/index.ts`, `server/src/types/scraper.ts`, `scraper/src/types/scraper.ts`, `packages/logger/src/index.ts`
   **When** I inspect type definitions
   **Then** all interfaces use `Theater` instead of `Cinema` (e.g., `Theater`, `TheaterConfig`, `TheaterWithShowtimes`)
   **And** all property names use `theater_id` instead of `cinema_id`

### React Components
2. **Given** components in `client/src/components/` and `client/src/pages/`
   **When** I list component files
   **Then** files are `TheaterPage.tsx`, `TheaterDateSelector.tsx`, `TheaterShowtimes.tsx`, `TheatersQuickLinks.tsx`, `AddTheaterModal.tsx`, `EditTheaterModal.tsx`, `DeleteTheaterDialog.tsx`
   **And** all internal references, props, and hooks use `theater` terminology

### API Routes
3. **Given** server routes in `server/src/routes/`
   **When** I inspect route definitions
   **Then** routes use `/api/theaters` instead of `/api/films`
   **And** files are `theaters.ts`, `theater-service.ts`, `theater-queries.ts`

### Client API
4. **Given** the client API in `client/src/api/client.ts`
   **When** I inspect API functions
   **Then** all functions reference `/api/theaters` endpoints
   **And** functions are named `getTheaters`, `getTheaterById`

### Scraper
5. **Given** scraper files in `scraper/src/scraper/`
   **When** I inspect strategy and parser files
   **Then** scraper uses `theater` for business entity and `theaterPage` for AlloCiné page concepts
   **And** functions are `scrapeTheaterPage`, `loadTheaterPageMetadata`, `processTheater`, `addTheaterAndScrape`

### Database Schema
6. **Given** the DB schema in migrations and `docker/init.sql`
   **When** I inspect column definitions
   **Then** columns use `theater_id` instead of `cinema_id`
   **And** table is named `theaters` instead of `cinemas`
   **And** constraints/indexes reference `theater_id`

### Permissions
7. **Given** the permission system in types and migrations
   **When** I inspect permission definitions
   **Then** permissions use `theaters:read`, `theaters:create`, `theaters:update`, `theaters:delete`

### French UI
8. **Given** French UI strings in client components
   **When** I inspect the UI
   **Then** labels use `salle` instead of `cinéma` (e.g., `"{n} salles"`, `"Ajouter une salle"`)
   **And** proper names like `"Cinéma du Panthéon"` are preserved unchanged
   **And** the text `"Au programme cette semaine"` remains unchanged

### Preserved Items
9. **Given** external dependencies
   **When** I inspect the codebase
   **Then** AlloCiné URLs remain unchanged
   **And** AlloCiné DOM selectors (`.movie-card-theater`, `#theaterpage-*`, `data-theater`) remain unchanged

### Verification
10. **Given** all changes are applied
    **When** I run the verification suite
    **Then** all typechecks pass (server, client, scraper)
    **And** all unit tests pass (server: 927, client: 538, scraper: 215, saas: 163, logger: 2)
     **And** no code-level `cinema` references remain in source files

### Review Findings

- [x] [Review][Decision] **"salles" vs "cinémas"** — Résolu: revert vers « cinéma » / « cinémas » dans l'UI française (13 fichiers client + 2 migrations SQL + 4 tests)
- [x] [Review][Patch] **`docker/init.sql`** missing CHECK constraint on `scrape_reports.status` [docker/init.sql:93] — corrigé
- [x] [Review][Patch] **Stale table aliases** `c` (cinemas) and `f` (films) in `saas_008_create_default_ics_org.sql` [saas_008:293,294,320] — corrigé
- [x] [Review][Patch] **`migrate-large-deployment.sql`** — supprimé
- [x] [Review][Defer] Migration 010 stale canonical list (n'inclut pas `theaters:read`) — deferred, pre-existing
