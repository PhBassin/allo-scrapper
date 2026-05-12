-- Migration 012: Add read-only permissions for theaters and users
-- Idempotency: Safe (INSERT ON CONFLICT DO NOTHING)
-- These permissions were referenced in client code but didn't exist in the database.
-- Adding them enables granular access control for view-only roles.

-- Add read-only permissions
INSERT INTO permissions (name, description, category) VALUES
  ('theaters:read', 'View theaters list and details', 'theaters'),
  ('users:read',   'View user details',             'users')
ON CONFLICT (name) DO NOTHING;

-- Assign new permissions to operator role
-- Operators need to view theater and user lists as part of their workflow
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'operator'
  AND p.name IN ('theaters:read', 'users:read')
ON CONFLICT (role_id, permission_id) DO NOTHING;
