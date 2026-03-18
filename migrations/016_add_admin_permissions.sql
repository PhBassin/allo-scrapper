-- Migration 016: Assign all permissions to admin role
-- Admin has is_system_role bypass in code, but we explicitly assign
-- all permissions to the database for transparency and tooling.

BEGIN;

-- Assign all permissions to admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin' AND r.is_system = true
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Verify permissions were assigned
DO $$
DECLARE
  permission_count INTEGER;
  admin_role_id INTEGER;
BEGIN
  SELECT id INTO admin_role_id FROM roles WHERE name = 'admin' AND is_system = true;
  
  SELECT COUNT(*) INTO permission_count
  FROM role_permissions
  WHERE role_id = admin_role_id;
  
  RAISE NOTICE 'Admin role now has % explicit permissions', permission_count;
END $$;

COMMIT;
