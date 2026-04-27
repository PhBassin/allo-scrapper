# Allo-Scrapper Documentation

This documentation is aligned to the current codebase.

## Start Here

- [Getting Started](./getting-started/README.md)
- [Development Guides](./guides/development/README.md)
- [Deployment Guides](./guides/deployment/README.md)
- [API Reference](./reference/api/README.md)
- [Architecture Reference](./reference/architecture/README.md)
- [Troubleshooting](./troubleshooting/README.md)

## Important Current Behaviors

- Local dev compose does not start the scraper worker.
- Scraping is always Redis-backed and handled by the separate `scraper` workspace.
- Fresh installs create username `admin`, but the password may be randomly generated and logged at startup.
- Playwright does not auto-start the app.
- The frontend discovers SaaS mode from `GET /api/config`.

## Repo Pointers

- Main README: [`../README.md`](../README.md)
- Migration notes: [`../migrations/README.md`](../migrations/README.md)
- AI/workflow conventions: [`../AGENTS.md`](../AGENTS.md)
