# Architecture — Shared Libraries (Packages)

## Executive Summary
Monorepo workspace packages providing shared logging and SaaS multi-tenant extensions across the allo-scrapper codebase.

## Packages

### logger (`packages/logger/`)
- **Type**: Winston wrapper
- **Purpose**: Standardized logging across server and scraper
- **Output**: Compiled to `dist/` (TypeScript → JS + .d.ts)
- **Usage**: Imported as workspace dependency by server and scraper

### saas (`packages/saas/`)
- **Type**: Multi-tenant server extensions
- **Purpose**: Organization-boundary enforcement, tenant-aware services
- **Middleware included**: rate-limit, input-validation, auth, permission, org-boundary
- **Services included**: scraper-service, cinema-service, film-service, theme-generator, redis-client
- **Status**: Compiled but not currently active in main codebase (future SaaS deployment path)
