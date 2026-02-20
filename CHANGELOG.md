# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.1.0]: https://github.com/PhBassin/allo-scrapper/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/PhBassin/allo-scrapper/releases/tag/v1.0.0
