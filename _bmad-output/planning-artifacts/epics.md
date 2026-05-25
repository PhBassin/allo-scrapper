---
stepsCompleted: []
inputDocuments:
  - _bmad-output/project-context.md
  - Audit de sécurité du 2026-05-25
---

# Allo-Scrapper — Security Audit Remediation Epic

## Overview

Cet epic décompose la remédiation des vulnérabilités identifiées lors de l'audit de sécurité du 2026-05-25. Les points 3 (JWT 24h→1h) et 4 (refresh tokens) ont déjà été traités dans la PR #1075. Cet epic couvre les 5 points restants.

## Requirements Inventory

### Functional Requirements

- FR1: Les endpoints sensibles nécessitent une authentification
- FR2: La configuration Express doit être durcie (body parser)
- FR3: Les changements de rate limits doivent prendre effet sans redémarrage
- FR4: Le secret JWT doit pouvoir être roté sans interruption de service

### Non-Functional Requirements

- NFR1: Toute modification ne doit pas casser les tests existants
- NFR2: La couverture de tests doit rester ≥ 80%
- NFR3: Les changements de sécu ne doivent pas introduire de régression fonctionnelle
- NFR4: Compatibilité ascendante préservée pour les clients existants

### FR Coverage Map

| FR | Story | Description |
|----|-------|-------------|
| FR1 | 9.1, 9.2 | Endpoint protection + hardening |
| FR2 | 9.2 | Express config hardening |
| FR3 | 9.3 | Rate limit hot-reload |
| FR4 | 9.4 | JWT secret rotation |

## Epic List

- Epic 9: Security Audit Remediation

## Epic 9: Security Audit Remediation

**Goal:** Corriger les 5 vulnérabilités restantes de l'audit de sécurité du 2026-05-25 pour atteindre un score ≥ 9/10.

### Story 9.1: Protect Exposed Endpoints (/metrics + /api/scraper/status)

As a security operator,
I want `/metrics` and `/api/scraper/status` to require authentication,
So that system information and scraper state are not publicly accessible.

**Acceptance Criteria:**

**Given** an unauthenticated request to `GET /metrics`
**When** the server receives the request
**Then** the server returns `401 Unauthorized`
**And** Prometheus metrics are only accessible with a valid Bearer token

**Given** an unauthenticated request to `GET /api/scraper/status`
**When** the server receives the request
**Then** the server returns `401 Unauthorized`
**And** only authenticated users can view scraper status

**Given** an authenticated request to `GET /metrics`
**When** the user has a valid JWT
**Then** the server returns Prometheus metrics (`200 OK`)

**Given** an authenticated request to `GET /api/scraper/status`
**When** the user has a valid JWT
**Then** the server returns scraper status data (`200 OK`)

### Story 9.2: Harden Express Body Parser Configuration

As a security operator,
I want `express.urlencoded` to use `extended: false`,
So that nested object injection via URL-encoded bodies is prevented.

**Acceptance Criteria:**

**Given** the Express app starts with `extended: false`
**When** a request with nested URL-encoded parameters is sent
**Then** nested parameters are not parsed into objects
**And** the querystring library (not qs) is used for parsing

**Given** the change from `extended: true` to `extended: false`
**When** all existing tests are run
**Then** all tests continue to pass
**And** no functional regression is introduced

### Story 9.3: Hot-Reload Rate Limit Configuration

As a security operator,
I want rate limit configuration changes to take effect without server restart,
So that DoS protection can be adjusted dynamically during incidents.

**Acceptance Criteria:**

**Given** an admin updates a rate limit via `PUT /api/admin/rate-limits`
**When** the update is committed to the database
**Then** the new limits take effect within 60 seconds (or immediately)
**And** no server restart is required

**Given** the rate limit config is reloaded
**When** the new window/max values are applied
**Then** existing request counters are preserved (no reset)
**And** the `Retry-After` header reflects the new window

**Given** the rate limit hot-reload mechanism is in place
**When** the database is temporarily unavailable
**Then** the last known good configuration continues to be used
**And** the server logs a warning

### Story 9.4: JWT Secret Rotation Mechanism

As a security operator,
I want to rotate the JWT signing secret without service interruption,
So that compromised or aging secrets can be replaced safely.

**Acceptance Criteria:**

**Given** a new JWT secret is deployed alongside the current one
**When** a request arrives with a token signed by the OLD secret
**Then** the server accepts the token (backward compatibility)
**And** the server signs NEW tokens with the NEW secret

**Given** the rotation grace period has elapsed
**When** only the new secret is configured
**Then** tokens signed with the old secret are rejected (`401`)

**Given** a token verification attempt
**When** multiple valid secrets are configured
**Then** the server tries each secret in order until one succeeds
**And** verification time is not significantly impacted (< 5ms overhead)
