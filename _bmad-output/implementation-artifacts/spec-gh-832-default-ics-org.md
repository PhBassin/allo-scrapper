---
title: 'Create default ICS organization in SaaS mode'
type: 'feature'
created: '2026-04-14'
status: 'ready-for-dev'
baseline_commit: '914078dc62075f797adbe606d56d914823f2fd08'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** In SaaS mode, there is no continuity between single-tenant and multi-tenant deployments. When enabling `SAAS_ENABLED=true`, existing data becomes inaccessible, and the admin user has no organization context, creating a broken migration path.

**Approach:** Automatically create a default organization (`slug: ics`, name: "Independent Cinema Showtimes") on server startup when SaaS mode is enabled. Migrate all existing core data tables into this organization's schema, and associate the system admin user as an organization member with admin privileges.

## Boundaries & Constraints

**Always:**
- Use schema-per-tenant architecture (data lives in `org_ics` schema, NOT via `org_id` column)
- Creation must be idempotent (safe to run multiple times without errors)
- System admin retains superadmin access (`is_system_role=true`) AND becomes org admin
- Follow existing migration patterns (checksum-tracked SQL files in `packages/saas/migrations/`)
- All existing core data (cinemas, films, showtimes, reports) must be migrated to `org_ics` schema

**Ask First:**
- If migration strategy requires downtime or cannot be made idempotent
- If default organization name should be configurable via environment variable
- If admin user association fails and requires manual intervention

**Never:**
- Create org_id columns in core tables (violates schema-per-tenant pattern)
- Modify core migrations (changes must be in SaaS plugin migrations only)
- Break single-tenant mode behavior (SAAS_ENABLED=false must work unchanged)
- Skip quota initialization for the default org

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First SaaS activation | `SAAS_ENABLED=true`, org `ics` does not exist, public schema has data | Org created, schema created with bootstrapped tables, data migrated from public to `org_ics`, admin becomes member | Log error and halt startup if creation fails |
| Subsequent startups | `SAAS_ENABLED=true`, org `ics` already exists | No-op (idempotent check) | None |
| SaaS re-enabled after disable | `SAAS_ENABLED=true`, org `ics` was deleted, public schema has new data | Org re-created, new schema created, data migrated again | Log warning if org exists but schema is missing |
| Single-tenant mode | `SAAS_ENABLED=false` | No org created, public schema used directly | None |
| Admin user missing | `SAAS_ENABLED=true`, no admin user in public.users | Org created but no member added | Log error, allow startup (superadmin can fix manually) |

</frozen-after-approval>

## Code Map

- `packages/saas/migrations/saas_008_create_default_ics_org.sql` -- Migration to create default ICS organization
- `packages/saas/src/services/org-service.ts` -- Existing org creation logic (`createOrg` function)
- `packages/saas/src/plugin.ts` -- SaaS plugin registration and startup hooks
- `packages/saas/migrations/org_schema/000_bootstrap.sql` -- Per-org schema bootstrap template
- `server/src/index.ts` -- Server startup sequence (migration runner)
- `packages/saas/src/routes/register.ts` -- Existing org registration endpoint (reference for patterns)
- `server/src/db/migrations.ts` -- Migration execution system (`runMigrations` function)

## Tasks & Acceptance

**Execution:**
- [x] `packages/saas/migrations/saas_008_create_default_ics_org.sql` -- Create migration that checks if org `ics` exists; if not, creates organization record, creates `org_ics` schema, bootstraps schema structure, migrates data from public schema (cinemas, films, showtimes, reports), and adds admin user to `org_ics.users` table -- Idempotent migration ensures seamless SaaS activation
- [x] `packages/saas/migrations/saas_008_create_default_ics_org.sql` -- Initialize quota tracking in `public.org_usage` for default org with zero usage and current date -- Ensures quota enforcement works immediately after org creation
- [x] `packages/saas/migrations/saas_008_create_default_ics_org.sql` -- Add test coverage in migration test inventory (`packages/saas/src/plugin.test.ts`) to verify migration is tracked -- Ensures migration integrity

**Acceptance Criteria:**
- Given `SAAS_ENABLED=true` and org `ics` does not exist, when server starts, then org `ics` is created with schema `org_ics`, all existing data is migrated, and admin user is associated
- Given `SAAS_ENABLED=true` and org `ics` already exists, when server starts, then no duplicate org is created and no errors occur
- Given `SAAS_ENABLED=false`, when server starts, then no default org is created and public schema remains unchanged
- Given admin user logs in after org creation, when accessing `/org/ics`, then dashboard loads with existing cinemas and films
- Given superadmin accesses `/superadmin`, when viewing organizations, then `ics` org appears in the list

## Spec Change Log

### 2026-04-14 - Quota initialization instructions added

**Reason:** Review finding (bad_spec classification)

**Finding:** Frozen intent states "Never skip quota initialization for the default org" (line 36), but Design Notes and Tasks did not include instructions for initializing `public.org_usage` table.

**Action:** Added quota initialization section to Design Notes (after Plan integration) and corresponding task to Tasks section.

**Impact:** Implementation now includes explicit instructions to initialize quota tracking for the default organization.

## Design Notes

**Migration Strategy:**

The migration uses a multi-step idempotent approach:

1. **Check existence**: Query `public.organizations` for `slug = 'ics'`
2. **Create org record**: Insert into `organizations` table with predefined values
3. **Create schema**: Execute `CREATE SCHEMA IF NOT EXISTS org_ics`
4. **Bootstrap tables**: Run `org_schema/000_bootstrap.sql` against `org_ics` schema
5. **Migrate data**: Copy records from `public.cinemas`, `public.films`, `public.showtimes`, `public.scrape_reports` to `org_ics.*`
6. **Associate admin**: Insert admin user from `public.users` into `org_ics.users` with admin role

**Key idempotency mechanisms:**
- `IF NOT EXISTS` checks for org record and schema
- `ON CONFLICT DO NOTHING` for user association
- Skip data migration if `org_ics` tables already have records

**Data migration approach:**

```sql
-- Example pattern for cinemas table
INSERT INTO org_ics.cinemas (id, name, address, city, ...)
SELECT id, name, address, city, ...
FROM public.cinemas
ON CONFLICT (id) DO NOTHING;
```

**Admin user association:**

The admin user exists in `public.users` with `is_system_role=true`. The migration creates a corresponding record in `org_ics.users`:

```sql
INSERT INTO org_ics.users (username, password_hash, role_id, email_verified)
SELECT u.username, u.password_hash, r.id, true
FROM public.users u
CROSS JOIN org_ics.roles r
WHERE u.username = 'admin' AND u.is_system_role = true AND r.name = 'admin'
ON CONFLICT (username) DO NOTHING;
```

**Plan integration:**

Default org uses the "free" plan (should be the first plan record). No trial end date.

**Quota initialization:**

The default organization must have quota tracking initialized in `public.org_usage`:

```sql
-- Initialize quota tracking for default org
INSERT INTO public.org_usage (org_id, scrapes_used, last_reset_date)
SELECT id, 0, CURRENT_DATE
FROM public.organizations
WHERE slug = 'ics'
ON CONFLICT (org_id) DO NOTHING;
```

Default quota limits come from the plan associated with the org (typically the "free" plan).

## Verification

**Commands:**
- `cd server && npm run test:run` -- expected: all tests pass including new migration inventory test
- `docker compose down -v && docker compose up -d` -- expected: fresh startup creates org `ics` without errors
- `docker compose exec -T ics-db psql -U postgres -d ics -c "SELECT slug, name, schema_name FROM public.organizations WHERE slug='ics'"` -- expected: one row returned with correct values
- `docker compose exec -T ics-db psql -U postgres -d ics -c "SELECT COUNT(*) FROM org_ics.cinemas"` -- expected: count matches original public.cinemas count
- `docker compose exec -T ics-db psql -U postgres -d ics -c "SELECT username, role_id FROM org_ics.users WHERE username='admin'"` -- expected: admin user present with role_id for 'admin' role

**Manual checks (if no CLI):**
- Login as admin, navigate to `/org/ics`, verify existing cinemas and films are visible
- Login as admin, navigate to `/superadmin`, verify org `ics` appears in organizations list
