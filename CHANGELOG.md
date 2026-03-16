# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.2] - 2026-03-16

### Added

- feat(ci): add automated version tagging workflow (#494) (872aab7)
- feat(ci): add version tag workflow (974c7a4)

### Fixed

- fix(ci): resolve merge conflict markers in version-tag workflow (#508) (8f93cd3)
- fix(ci): resolve merge conflict markers in version-tag workflow (#507) (71c9283)
- fix(ci): resolve merge conflict markers in version-tag workflow (6091d53)
- fix(ci): fix version-tag workflow for stable tag handling (#506) (ab0f92e)
- fix(ci): filter non-semver tags and move stable tag on release (#505) (25bc5a1)
- fix(ci): filter non-semver tags and move stable tag on release (83d03f2)
- fix(ci): complete version-tag workflow fix (#503) (67ed1e9)
- fix(ci): explicitly checkout main branch in version-tag workflow (#502) (b5683aa)
- fix(ci): workflow_run branch filter fix (#500) (a856767)
- fix(ci): add explicit branch check to version-tag workflow (#499) (938f2e8)
- fix(ci): add explicit git auth for version-tag workflow (#497) (516e7f7)
- fix(ci): add explicit git auth for version-tag workflow push (2eba644)
- fix(ci): fix merge reference in sync-main-to-develop workflow (13c76e7)

### Changed

- Merge branch 'main' into develop (029a37a)
- test: verify automated version tagging workflow (#496) (483f6ca)

### Documentation

- docs: add version labeling to contribution checklist (8b93f80)
- docs(ci): document automated versioning workflow in AGENTS.md (1edaee9)

### Maintenance

- chore: sync develop to main (v4.0.1 + workflow fix) (#492) (4fa2c19)
- chore: bump version to v4.0.1 (1b266a4)
- chore: sync main into develop (9bc2966)

## [4.0.1] - 2026-03-16

### Fixed
- Fixed bug where POST `/api/scraper/trigger` fails with 500 when called without a body (e.g., "Scrap All" button)
- Added regression test to prevent future occurrences

## [4.0.0] - 2026-03-16

### Added

**Node.js 24 LTS:**
- Migrated from Node.js 22 to Node.js 24 LTS
- Updated engine requirements to `>=24.0.0`

**Scraper Microservice:**
- Replaced Playwright with Puppeteer for browser automation
- Migrated from `playwright-core` to `puppeteer-core`
- Added arm64 native support using Debian's `chromium-headless-shell` package

### Changed

**Docker Optimization:**
- Scraper image reduced from ~1.38 GB to ~1.20 GB (13% smaller)
- Simplified Dockerfile: removed architecture-conditional logic
- Using `chromium-headless-shell` from apt instead of `@puppeteer/browsers`

**OpenTelemetry:**
- Replaced auto-instrumentation with targeted packages
- Reduced dependency footprint

**TypeScript:**
- Disabled declaration and declarationMap generation for scraper

### Fixed

**Security:**
- Security vulnerability fixes from dependabot
- JWT expiry enforcement in route guards and Docker runtime
- RBAC permission count updated to 26 across 7 categories

**Performance:**
- Parallel DB queries in FilmService
- Optimized Docker build time with npm cache

### Database

**Migrations Added:**
- `008_permission_based_roles.sql` - Roles and permissions tables
- `009_add_roles_permission.sql` - Role management permission
- `010_remove_phantom_permissions.sql` - Clean non-canonical permissions
- `011_add_roles_crud_permissions.sql` - Full CRUD for roles
- `012_add_read_permissions.sql` - Read permissions for cinemas and users
- `013_add_cinema_source.sql` - Source column for cinema scraping strategy

## [3.0.1] - 2026-03-08

### Changed

**DevOps:**
- Added major version Docker tag pattern (`type=semver,pattern={{major}}`)
- Docker images now tagged with `:3` (tracks latest 3.x.x release) in addition to `:3.0.1` and `:3.0`

This is a DevOps-only release with no code changes, database migrations, or API modifications. The only change is enhanced Docker image tagging for easier version tracking.

## [3.0.0] - 2026-03-08

### Added

**White-Label Branding System:**
- Full branding customization (logo, favicon, colors, typography, footer)
- Dynamic theme CSS endpoint (`/api/theme.css`)
- Settings import/export as JSON
- Live preview in admin interface
- Admin settings UI at `/admin?tab=settings`

**Unified Admin Interface:**
- Tabbed navigation consolidating all admin functions (`/admin`)
- Five tabs: Cinemas, Reports, Users, Settings, System
- URL-based navigation with query params
- Replaced header "Rapports" link with "Admin" link
- Removed admin links from user dropdown menu

**Cinema Management:**
- Admin CRUD UI for cinemas (`/admin?tab=cinemas`)
- Real-time scraping progress with SSE
- URL persistence in database
- Edit cinema metadata (name, address, screen count, image)
- One-click cinema addition with validation

**User Management:**
- Admin CRUD UI for users (`/admin?tab=users`)
- Role-based access control (admin vs user)
- Password reset functionality (admin action)
- Self-service password change

**DevOps & Tooling:**
- Environment migration script (`scripts/migrate-env.sh`)
- Automated Docker tag cleanup (CI workflow)
- Enhanced CORS error messages for LAN access
- Production diagnostics script

### Fixed

**Critical Issues:**
- Google Fonts CSP violation blocking font loading (#330)
- Docker permission errors causing 500s on static assets
- JSON parsing cache performance for repeated queries
- Modal stale state when editing different items
- Zero value handling in cinema display
- CORS error messages missing blocked origin details

**Type Safety:**
- TypeScript compilation errors in test mocks
- Missing properties in context providers
- Type narrowing for literal unions

### Changed

- Admin navigation consolidated into single `/admin` route
- Reports page adapted to use URL search params
- Layout header simplified (removed multiple admin links)
- User dropdown streamlined (removed admin-specific links)

### Security

- Rate-limiting middleware applied to all mutation endpoints
- Input validation for cinema URLs (SSRF prevention)
- Improved CSP directives for Google Fonts

### Performance

- JSON parsing cache for database result mapping
- Batch inserts for weekly program updates (98x faster)
- Optimized Docker image build process

### Documentation

- Added CORS LAN access troubleshooting guide
- Updated AGENTS.md with new gotchas
- Enhanced WHITE-LABEL.md with troubleshooting
- Improved deployment networking documentation

### Tests

- Added 29 new client tests (admin tabs, reports, layout)
- Total coverage: 203 client tests + 600 server tests
- Enhanced test fixtures and mocking patterns

## [3.0.0-beta.4] - 2026-03-08

### Fixed
- Google Fonts CSP violation (#330)
- Docker user permission errors causing 500s on static assets
- Added production diagnostics script

## [3.0.0-beta.3] - 2026-03-XX

### Added
- Cinema management CRUD UI
- Real-time scraping progress tracking
- URL persistence for cinemas

## [3.0.0-beta.2] - 2026-03-01

### Changed
- Documentation restructure following Divio system
- Reorganized guides and reference materials

## [3.0.0-beta.1] - 2026-03-01

### Added
- White-label branding system foundation
- Settings management API
- Theme generation service

## [2.1.1] - 2026-03-01

### Fixed
- Security vulnerabilities
- Bug fixes

## [2.1.0] - 2026-02-28

### Added
- Additional features (details TBD)

## [2.0.0] - 2026-02-26

### Added
- Authentication system
- Security improvements

## [1.1.0] - 2026-02-24

### Added
- Scraper microservice
- Observability stack (Prometheus, Grafana, Loki, Tempo)

## [1.0.0] - 2026-02-19

### Added
- Initial stable release
- Core cinema scraping functionality
- REST API
- React frontend

[4.0.2]: https://github.com/PhBassin/allo-scrapper/compare/v4.0.1...v4.0.2
[3.0.0]: https://github.com/PhBassin/allo-scrapper/compare/v2.1.1...v3.0.0
[4.0.0]: https://github.com/PhBassin/allo-scrapper/compare/v3.0.1...v4.0.0
[4.0.1]: https://github.com/PhBassin/allo-scrapper/compare/v4.0.0...v4.0.1
[3.0.0-beta.4]: https://github.com/PhBassin/allo-scrapper/compare/v3.0.0-beta.3...v3.0.0-beta.4
[3.0.0-beta.3]: https://github.com/PhBassin/allo-scrapper/compare/v3.0.0-beta.2...v3.0.0-beta.3
[3.0.0-beta.2]: https://github.com/PhBassin/allo-scrapper/compare/v3.0.0-beta.1...v3.0.0-beta.2
[3.0.0-beta.1]: https://github.com/PhBassin/allo-scrapper/compare/v2.1.1...v3.0.0-beta.1
[2.1.1]: https://github.com/PhBassin/allo-scrapper/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/PhBassin/allo-scrapper/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/PhBassin/allo-scrapper/compare/v1.1.0...v2.0.0
[1.1.0]: https://github.com/PhBassin/allo-scrapper/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/PhBassin/allo-scrapper/releases/tag/v1.0.0
