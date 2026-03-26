-- Migration 018: Add rate limit management permissions
-- Date: 2026-03-25
-- Description: Create permissions for rate limit configuration management
-- This migration is idempotent - safe to run multiple times

BEGIN;

-- Add rate limit permissions
INSERT INTO permissions (name, description, category) VALUES
  ('ratelimits:read', 'View rate limit configurations', 'security'),
  ('ratelimits:update', 'Update rate limit configurations', 'security'),
  ('ratelimits:reset', 'Reset rate limit configurations to defaults', 'security'),
  ('ratelimits:audit', 'View rate limit change audit log', 'security')
ON CONFLICT (name) DO NOTHING;

-- Assign rate limit permissions to admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  r.id,
  p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin' 
  AND r.is_system = true
  AND p.name IN ('ratelimits:read', 'ratelimits:update', 'ratelimits:reset', 'ratelimits:audit')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Verification
DO $$
DECLARE
  permission_count INTEGER;
  admin_role_id INTEGER;
BEGIN
  -- Check that all 4 permissions were created
  SELECT COUNT(*) INTO permission_count
  FROM permissions
  WHERE name IN ('ratelimits:read', 'ratelimits:update', 'ratelimits:reset', 'ratelimits:audit');
  
  IF permission_count = 4 THEN
    RAISE NOTICE 'Migration successful: All 4 rate limit permissions created';
  ELSE
    RAISE EXCEPTION 'Migration failed: Expected 4 rate limit permissions, found %', permission_count;
  END IF;
  
  -- Check that admin role has all permissions assigned
  SELECT id INTO admin_role_id FROM roles WHERE name = 'admin' AND is_system = true;
  
  SELECT COUNT(*) INTO permission_count
  FROM role_permissions rp
  JOIN permissions p ON rp.permission_id = p.id
  WHERE rp.role_id = admin_role_id
    AND p.name IN ('ratelimits:read', 'ratelimits:update', 'ratelimits:reset', 'ratelimits:audit');
  
  IF permission_count = 4 THEN
    RAISE NOTICE 'Migration successful: Admin role has all 4 rate limit permissions';
  ELSE
    RAISE NOTICE 'Warning: Admin role has only % of 4 rate limit permissions', permission_count;
  END IF;
END $$;

COMMIT;
