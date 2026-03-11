BEGIN;

-- Remove any permissions that are not in the canonical list.
-- This cleans up phantom permissions (e.g. system:read) that may have been
-- inserted outside of migrations.
--
-- Canonical permission set (20 permissions as of migration 009):
--   users:       users:list, users:create, users:update, users:delete
--   scraper:     scraper:trigger, scraper:trigger_single
--   cinemas:     cinemas:create, cinemas:update, cinemas:delete
--   settings:    settings:read, settings:update, settings:reset, settings:export, settings:import
--   reports:     reports:list, reports:view
--   system:      system:info, system:health, system:migrations
--   roles:       roles:read
--
-- The DELETE cascades to role_permissions via ON DELETE CASCADE on the FK.
DELETE FROM permissions
WHERE name NOT IN (
  'users:list',
  'users:create',
  'users:update',
  'users:delete',
  'scraper:trigger',
  'scraper:trigger_single',
  'cinemas:create',
  'cinemas:update',
  'cinemas:delete',
  'settings:read',
  'settings:update',
  'settings:reset',
  'settings:export',
  'settings:import',
  'reports:list',
  'reports:view',
  'system:info',
  'system:health',
  'system:migrations',
  'roles:read'
);

COMMIT;
