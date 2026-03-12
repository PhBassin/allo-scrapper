-- Migration 011: Add full CRUD permissions for roles management
-- Previously, roles management used users:* permissions as a workaround.
-- This adds dedicated roles:list, roles:create, roles:update, roles:delete permissions.

-- Add new roles CRUD permissions
INSERT INTO permissions (name, description, category) VALUES
  ('roles:list',   'Lister les rôles',                    'roles'),
  ('roles:create', 'Créer des rôles',                     'roles'),
  ('roles:update', 'Modifier des rôles et permissions',   'roles'),
  ('roles:delete', 'Supprimer des rôles',                 'roles')
ON CONFLICT (name) DO NOTHING;

-- Update roles:read description to clarify it's for viewing a single role's details
UPDATE permissions 
SET description = 'Voir les détails d''un rôle' 
WHERE name = 'roles:read';
