BEGIN;

-- Add roles:read permission to decouple Roles tab from users:list
INSERT INTO permissions (name, description, category) VALUES
  ('roles:read', 'Lister les rôles et leurs permissions', 'roles')
ON CONFLICT (name) DO NOTHING;

COMMIT;
