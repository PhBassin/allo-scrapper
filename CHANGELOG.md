# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[3.0.0]: https://github.com/PhBassin/allo-scrapper/compare/v2.1.1...v3.0.0
[3.0.0-beta.4]: https://github.com/PhBassin/allo-scrapper/compare/v3.0.0-beta.3...v3.0.0-beta.4
[3.0.0-beta.3]: https://github.com/PhBassin/allo-scrapper/compare/v3.0.0-beta.2...v3.0.0-beta.3
[3.0.0-beta.2]: https://github.com/PhBassin/allo-scrapper/compare/v3.0.0-beta.1...v3.0.0-beta.2
[3.0.0-beta.1]: https://github.com/PhBassin/allo-scrapper/compare/v2.1.1...v3.0.0-beta.1
[2.1.1]: https://github.com/PhBassin/allo-scrapper/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/PhBassin/allo-scrapper/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/PhBassin/allo-scrapper/compare/v1.1.0...v2.0.0
[1.1.0]: https://github.com/PhBassin/allo-scrapper/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/PhBassin/allo-scrapper/releases/tag/v1.0.0
