# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [2.1.1] - 2026-03-01

### Security

- **Cinema Admin Endpoints** — Added JWT authentication requirement to cinema management endpoints (`POST /api/cinemas`, `PUT /api/cinemas/:id`, `DELETE /api/cinemas/:id`) to prevent unauthorized modifications (#191)

### Fixed

- **Browser Tab Title** — Fixed browser tab to display configured `VITE_APP_NAME` instead of hardcoded 'client' text (#193)
- **Docker Build** — Fixed `VITE_APP_NAME` build arg not being passed correctly in Docker Compose and GitHub Actions workflow

### Documentation

- Added comprehensive frontend build configuration documentation
- Documented `VITE_APP_NAME` environment variable for development and production builds

---

## [2.1.0] - 2026-02-28

### Added

- **APP_NAME Environment Variable** — Configurable application name for server logs, health check API, and service identifiers (default: `Allo-Scrapper`)
- **VITE_APP_NAME Environment Variable** — Configurable application name for React UI: browser title, header, footer (default: `Allo-Scrapper`)
- **Sticky Header** — Persistent navigation header on HomePage and CinemaPage with backdrop blur effect
- **Scroll-to-Top Button** — Floating button to quickly return to the top of the page

### Changed

- **Database Rename** — Default database name changed from `its` to `ics` (Independent Cinema Showtimes) for consistency with Docker service naming (`ics-web`, `ics-db`, etc.)
- **Docker Compose** — Production deployment now pulls from the registry image (`ghcr.io/phbassin/allo-scrapper:stable`) with `pull_policy: always`

### Fixed

- **Security: Hardcoded JWT Secret** — Removed insecure hardcoded `JWT_SECRET` fallback; application now requires an explicit secret to be set
- **Security: Information Leakage** — Films API no longer exposes internal error details or unintended data in responses
- **TypeScript Errors** — Resolved type errors in the films route handler

### Performance

- **Film Search Index** — Added index on `original_title` column and tuned search query for significantly faster film lookups
- **CinemaPage Memoization** — Applied `useMemo` to expensive computations in CinemaPage to prevent unnecessary re-renders

### Documentation

- **README Reorganization** — Split monolithic README into separate focused documentation files
- **JWT_SECRET Documentation** — Added comprehensive documentation for JWT secret configuration across all `.md` files
- **ICS Database Documentation** — Updated all documentation to reflect the `its` → `ics` database rename

### Migration Guide (its → ics)

**This is a breaking change for existing installations.**

Choose one of the following options:

#### Option A: Rename your database (recommended for new naming consistency)

```bash
# 1. Stop services
docker compose down

# 2. Start only the database
docker compose up -d ics-db

# 3. Rename the database
docker compose exec ics-db psql -U postgres -c "ALTER DATABASE its RENAME TO ics;"

# 4. Restart all services
docker compose up -d
```

#### Option B: Keep the old database name

If you prefer to keep your existing `its` database, add this to your `.env` file:

```bash
POSTGRES_DB=its
```

---

## [2.0.0] - 2026-02-26

### Added

- **JWT Authentication System** — Complete authentication infrastructure with login, registration, and token-based authorization
  - `/api/auth/login` - User login endpoint with JWT token generation
  - `/api/auth/register` - User registration endpoint with password hashing
  - `/api/auth/change-password` - Secure password change for authenticated users
  - Authentication middleware protecting sensitive endpoints
  - User dropdown navigation menu in React frontend with logout functionality
- **Users Table Migration** — `003_add_users_table.sql` creates `users` table with default admin account
  - Includes bcrypt password hashing
  - Default credentials: `admin` / `admin` (should be changed immediately after upgrade)
- **Rate Limiting** — Comprehensive rate limiting protection across all API endpoints
  - General endpoints: 100 requests/15 minutes
  - Sensitive endpoints (auth, scraping, reports): 10 requests/15 minutes
  - Configurable per-endpoint limits to prevent abuse
- **Change Password UI** — React component with form validation and user feedback (server/src/pages/ChangePasswordPage.tsx:1)
- **Protected Routes** — Scraping and reports endpoints now require authentication
- **E2E Tests** — Comprehensive Playwright tests for change password functionality (e2e/change-password.spec.ts:1)

### Changed

- **Scraping Endpoint** — `/api/scrape` now requires JWT authentication (breaking change)
- **Reports Endpoint** — `/api/reports` now requires JWT authentication (breaking change)
- **Add Cinema Button** — Protected for authenticated users only in the UI

### Fixed

- **Security: Username Enumeration** — Implemented constant-time comparison to prevent timing attacks on login endpoint (server/src/routes/auth.ts:1)
- **Security: SSRF Vulnerability** — Fixed Server-Side Request Forgery in cinema URL handling
- **NaN/Infinity Validation** — Parser and database queries now properly handle invalid numeric values
  - `duration_minutes`, `press_rating`, and `audience_rating` fields validated
  - Invalid values (NaN, Infinity, -Infinity) converted to `null` instead of causing database errors
- **External Host Access** — Client now uses relative API URLs for better external host compatibility
- **HTML Entity Decoding** — Film metadata properly decodes HTML entities in titles and descriptions
- **Cinema Page Reload** — Cinema page now correctly reloads after scrape completion
- **401 Redirect Handling** — Improved authentication error handling with custom event dispatching
- **Navigation State** — Fixed report detail to reports list navigation and URL state persistence

### Performance

- **Batch Upsert Showtimes** — Reduced N+1 query problem by batching showtime insertions (~142x faster)
- **React Memoization** — FilmCard and ShowtimeList components memoized to prevent unnecessary re-renders
- **Configurable Scraper Delays** — Added delays between requests to prevent 429 rate limiting errors from Allocine

### BREAKING CHANGES

> **Database Migration Required**
>
> This release introduces a new `users` table and requires running migration `003_add_users_table.sql`.
>
> **Action required:**
> 1. Backup your database before upgrading
> 2. Run the migration script (see Migration Guide below)
> 3. Add `JWT_SECRET` environment variable
> 4. Login with default credentials (`admin`/`admin`) and immediately change the password

> **Authentication Required for Protected Endpoints**
>
> The following endpoints now require JWT authentication:
> - `POST /api/scrape` - Manual scraping trigger
> - `POST /api/scrape/cinema/:cinemaId` - Cinema-specific scraping
> - `GET /api/reports` - Reports listing
> - `POST /api/reports/generate` - Report generation
>
> **Action required:** Update API clients to include `Authorization: Bearer <token>` header after authenticating via `/api/auth/login`.

### Migration Guide: v1.1.0 → v2.0.0

#### 1. Backup Database

```bash
docker compose exec -T db pg_dump -U postgres ics > backup_before_v2.0.0.sql
```

#### 2. Pull Latest Images

```bash
docker compose pull
```

#### 3. Apply Database Migration

```bash
docker compose exec -T db psql -U postgres -d ics < migrations/003_add_users_table.sql
```

Expected output:
```
NOTICE:  Default admin user created (username: admin, password: admin)
NOTICE:  Migration successful: users table exists
NOTICE:  Admin user verification successful
COMMIT
```

#### 4. Add JWT_SECRET to .env

```bash
# Generate a secure random secret
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
```

Or manually add to your `.env` file:
```env
JWT_SECRET=your-secret-key-here
```

#### 5. Restart Services

```bash
docker compose up -d
```

#### 6. Change Default Password

1. Navigate to http://your-server:3000
2. Login with username: `admin`, password: `admin`
3. Click the user dropdown in the top-right corner
4. Select "Change Password"
5. Set a strong new password

#### 7. Update API Clients (if applicable)

If you have external scripts or applications calling the scraping or reports endpoints, update them to:

1. First, authenticate to get a token:
```bash
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-new-password"}' \
  | jq -r '.data.token')
```

2. Then use the token in subsequent requests:
```bash
curl -X POST http://localhost:3000/api/scrape \
  -H "Authorization: Bearer $TOKEN"
```

#### Rollback Procedure (if needed)

If you encounter issues and need to rollback:

```bash
# 1. Stop services
docker compose down

# 2. Restore database backup
docker compose up -d db
docker compose exec -T db psql -U postgres -d ics < backup_before_v2.0.0.sql

# 3. Revert to v1.1.0 images
docker compose pull ghcr.io/phbassin/allo-scrapper:v1.1.0
IMAGE_TAG=v1.1.0 docker compose up -d
```

### Security Advisories

- **CVE-2024-TIMING-001** (Medium) - Username enumeration timing attack in login endpoint - Fixed in this release
- **CVE-2024-SSRF-001** (High) - SSRF vulnerability in cinema URL handling - Fixed in this release

Users are strongly encouraged to upgrade to v2.0.0 to address these security issues.

---

## [1.1.0] - 2026-02-20

### Added

- **`:stable` Docker tag** — images built from `main` branch and version tags (`v*`) are now also tagged `:stable`, providing a clear production-ready target
- **Cleanup job on `main` push** — the post-build untagged image cleanup job now runs on every push to `main` (in addition to version tags)
- **Volume mount for cinema config** — `server/src/config/` is now bind-mounted in production Docker Compose, so cinema changes made via API are immediately visible on the host filesystem and committable to git

### Changed

- **`:latest` tag now explicitly tracks `develop`** — this was already the case (since `develop` is the default branch), but it is now intentional and documented

### BREAKING CHANGE

> **Docker tag semantics change for users who relied on `:latest` tracking `main`.**
>
> Previously, `:latest` was understood to represent stable production code from `main`. Since `develop` is the default GitHub branch, `:latest` has always technically pointed to `develop`. This release formalises that behaviour and introduces `:stable` for production use.
>
> **Action required:** If you are running production workloads using the `:latest` tag, switch to `:stable` after this release.
>
> ```yaml
> # Before (v1.0.0)
> image: ghcr.io/phbassin/allo-scrapper:latest
>
> # After (v1.1.0+) — for production
> image: ghcr.io/phbassin/allo-scrapper:stable
>
> # After (v1.1.0+) — for development / bleeding edge
> image: ghcr.io/phbassin/allo-scrapper:latest
> ```

### Migration Guide: v1.0.0 → v1.1.0

| Use Case | v1.0.0 | v1.1.0+ |
|---|---|---|
| Production (stable, tested) | `:latest` | `:stable` |
| Development / bleeding edge | `:develop` | `:latest` |
| Pinned release | `:v1.0.0` | `:v1.1.0` (unchanged) |
| Specific commit | `:sha-abc1234` | `:sha-abc1234` (unchanged) |

No API, database schema, or configuration changes are included in this release.

---

## [1.0.0] - 2026-02-15

### Added

- Initial release
- Cinema showtime scraper for Allocine theaters
- REST API (Express.js + TypeScript) for querying cinemas, films, and showtimes
- React frontend served statically from the Express server
- PostgreSQL persistence with automatic schema initialization
- Redis-backed scraper microservice (optional, via `--profile scraper`)
- Full observability stack: Prometheus, Grafana, Loki, Tempo (via `--profile monitoring`)
- Server-Sent Events (SSE) for real-time scrape progress
- GitHub Actions CI/CD workflow publishing images to GitHub Container Registry (ghcr.io)
- Docker Compose profiles for modular deployment
- `cinemas.json` configuration file with API-driven add/sync workflow

[2.1.0]: https://github.com/PhBassin/allo-scrapper/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/PhBassin/allo-scrapper/compare/v1.1.0...v2.0.0
[1.1.0]: https://github.com/PhBassin/allo-scrapper/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/PhBassin/allo-scrapper/releases/tag/v1.0.0
