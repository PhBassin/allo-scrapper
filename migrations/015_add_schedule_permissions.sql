-- Migration 015: Add scrape schedule management permissions
-- Enables RBAC for the new scrape scheduling system.

BEGIN;

-- Add schedule management permissions
INSERT INTO permissions (name, description, category) VALUES
  ('scraper:schedules:list',   'View list of scrape schedules',          'scraper'),
  ('scraper:schedules:create', 'Create new scrape schedules',            'scraper'),
  ('scraper:schedules:update', 'Modify existing scrape schedules',       'scraper'),
  ('scraper:schedules:delete', 'Delete scrape schedules',               'scraper')
ON CONFLICT (name) DO NOTHING;

-- Assign new permissions to operator role
-- Operators need to view and manage scrape schedules
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'operator'
  AND p.name IN ('scraper:schedules:list', 'scraper:schedules:create', 'scraper:schedules:update', 'scraper:schedules:delete')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Verify permissions were added
DO $$
DECLARE
  permission_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO permission_count
  FROM permissions
  WHERE name IN ('scraper:schedules:list', 'scraper:schedules:create', 'scraper:schedules:update', 'scraper:schedules:delete');
  
  IF permission_count = 4 THEN
    RAISE NOTICE 'Migration successful: 4 schedule permissions added';
  ELSE
    RAISE EXCEPTION 'Migration failed: expected 4 permissions, found %', permission_count;
  END IF;
END $$;

COMMIT;
