# Database Migrations

This directory contains the SQL migrations applied by the server migration runner.

## Current behavior

- `AUTO_MIGRATE` defaults to `true`
- on startup, the server runs pending migrations from `migrations/`
- when SaaS is enabled, SaaS migrations are added by the plugin
- applied migrations are tracked in `schema_migrations`
- migration file checksums are verified and mismatches are warned about

## Current migration set

Core files currently present:

- `001_neutralize_references.sql`
- `002_add_pg_trgm_extension.sql`
- `003_add_users_table.sql`
- `004_add_app_settings.sql`
- `005_add_user_roles.sql`
- `006_fix_app_settings_schema.sql`
- `007_seed_default_admin.sql`
- `008_permission_based_roles.sql`
- `009_add_roles_permission.sql`
- `010_remove_phantom_permissions.sql`
- `011_add_roles_crud_permissions.sql`
- `012_add_read_permissions.sql`
- `013_add_cinema_source.sql`
- `014_add_scrape_schedules.sql`
- `015_add_schedule_permissions.sql`
- `016_add_admin_permissions.sql`
- `017_add_rate_limit_configs.sql`
- `017_add_rate_limited_status.sql`
- `018_add_rate_limit_permissions.sql`
- `018_add_scrape_attempts.sql`
- `019_add_permission_category_labels.sql`
- `020_add_film_screenwriters.sql`
- `021_add_film_trailer_url.sql`
- `022_fix_showtime_deduplication.sql`
- `023_add_scrape_settings.sql`

Note that the numbering includes two `017_*` files and two `018_*` files. The runner sorts by filename and tracks the full filename, not just the numeric prefix.

## Fresh install notes

- username `admin` is created during the migration flow
- on a fresh DB, the password may be randomly generated and logged once by the migration runner
- save that password from logs if you need it

## Manual run

If you disable auto-migration:

```bash
cd server
npm run db:migrate
```

Or in production compose:

```bash
docker compose exec ics-web npm run db:migrate
```

## Tracking table

`schema_migrations` stores:

- `version`
- `checksum`
- `applied_at`

## Related

- [`server/src/db/migrations.ts`](../server/src/db/migrations.ts)
- [`server/src/db/schema.ts`](../server/src/db/schema.ts)
