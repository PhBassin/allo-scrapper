# Architecture — Packages (allo-scrapper)

> Generated: 2026-05-21 | Shared libraries for allo-scrapper monorepo

## Overview

The `packages/` directory contains shared libraries used by the server and scraper. These are part of the **npm workspaces** monorepo setup.

**Location:** `packages/`

---

## Package Inventory

| Package | Purpose |
|---------|---------|
| Shared logger | Winston logging configuration used by server + scraper |
| SaaS extensions | White-label / multi-tenant utilities |

---

## NPM Workspaces

The project root `package.json` defines workspaces:
```json
{
  "workspaces": ["server", "scraper", "client", "packages/*"]
}
```

Shared packages are referenced as local dependencies in `server/package.json` and `scraper/package.json`.

---

## Build

Packages are typically compiled TypeScript → JavaScript and consumed as compiled output by dependents.

## Note

The `packages/` directory currently has **0 compiled TypeScript source files** (compiled output only). Most shared code evolved to live directly in `server/src/utils/` and `scraper/src/utils/` for simplicity.
