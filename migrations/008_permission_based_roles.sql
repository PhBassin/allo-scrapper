BEGIN;

-- 1. Créer la table roles
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Créer la table permissions
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Créer la table de jointure role_permissions
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 4. Seed les rôles de base (idempotent)
INSERT INTO roles (name, description, is_system) VALUES
  ('admin', 'Administrateur — accès total', true),
  ('operator', 'Opérateur — scraping et gestion des cinémas', true)
ON CONFLICT (name) DO NOTHING;

-- 5. Seed les 19 permissions (idempotent)
INSERT INTO permissions (name, description, category) VALUES
  ('users:list',            'Lister les utilisateurs',                    'users'),
  ('users:create',          'Créer un utilisateur',                       'users'),
  ('users:update',          'Modifier un utilisateur',                    'users'),
  ('users:delete',          'Supprimer un utilisateur',                   'users'),
  ('scraper:trigger',       'Lancer un scrape global',                    'scraper'),
  ('scraper:trigger_single','Lancer un scrape pour un cinéma',            'scraper'),
  ('cinemas:create',        'Ajouter un cinéma',                          'cinemas'),
  ('cinemas:update',        'Modifier un cinéma',                         'cinemas'),
  ('cinemas:delete',        'Supprimer un cinéma',                        'cinemas'),
  ('settings:read',         'Lire les settings admin',                    'settings'),
  ('settings:update',       'Modifier les settings',                      'settings'),
  ('settings:reset',        'Réinitialiser les settings',                 'settings'),
  ('settings:export',       'Exporter les settings',                      'settings'),
  ('settings:import',       'Importer les settings',                      'settings'),
  ('reports:list',          'Lister les rapports de scraping',            'reports'),
  ('reports:view',          'Voir un rapport de scraping',                'reports'),
  ('system:info',           'Voir les informations système',              'system'),
  ('system:health',         'Voir le statut santé du système',            'system'),
  ('system:migrations',     'Voir les migrations de base de données',     'system')
ON CONFLICT (name) DO NOTHING;

-- 6. Seed role_permissions pour operator
-- (admin a toutes les permissions via bypass hardcodé dans le middleware — pas de lignes en DB)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'operator'
  AND p.name IN (
    'scraper:trigger', 'scraper:trigger_single',
    'cinemas:create', 'cinemas:update', 'cinemas:delete',
    'reports:list', 'reports:view'
  )
ON CONFLICT DO NOTHING;

-- 7. Ajouter colonne role_id à users (nullable d'abord pour la migration des données)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'role_id'
  ) THEN
    ALTER TABLE users ADD COLUMN role_id INTEGER REFERENCES roles(id);
  END IF;
END $$;

-- 8. Migrer les données existantes : role TEXT → role_id
UPDATE users u
SET role_id = r.id
FROM roles r
WHERE r.name = u.role
  AND u.role_id IS NULL;

-- 9. Rendre role_id NOT NULL et ajouter index
ALTER TABLE users ALTER COLUMN role_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);

-- 10. Supprimer l'ancienne colonne role et ses contraintes
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
DROP INDEX IF EXISTS idx_users_role;
ALTER TABLE users DROP COLUMN IF EXISTS role;

COMMIT;
