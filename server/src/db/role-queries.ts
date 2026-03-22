import { type DB } from './client.js';
import { type Role, type Permission, type RoleWithPermissions } from '../types/role.js';

/**
 * Fetch permissions for a given role ID
 */
async function fetchPermissionsForRole(db: DB, roleId: number): Promise<Permission[]> {
  const result = await db.query<Permission>(
    `SELECT p.id, p.name, p.description, p.category, p.created_at
     FROM permissions p
     JOIN role_permissions rp ON rp.permission_id = p.id
     WHERE rp.role_id = $1
     ORDER BY p.category, p.name`,
    [roleId]
  );
  return result.rows;
}

/**
 * Get all roles with their permissions
 */
export async function getAllRoles(db: DB): Promise<RoleWithPermissions[]> {
  const rolesResult = await db.query<Role>(
    'SELECT id, name, description, is_system, created_at FROM roles ORDER BY id',
    []
  );

  if (rolesResult.rows.length === 0) {
    return [];
  }

  const rolesWithPermissions: RoleWithPermissions[] = [];
  for (const role of rolesResult.rows) {
    const permissions = await fetchPermissionsForRole(db, role.id);
    rolesWithPermissions.push({ ...role, permissions });
  }

  return rolesWithPermissions;
}

/**
 * Get a role by ID with its permissions
 * Returns undefined if not found
 */
export async function getRoleById(db: DB, roleId: number): Promise<RoleWithPermissions | undefined> {
  const result = await db.query<Role>(
    'SELECT id, name, description, is_system, created_at FROM roles WHERE id = $1',
    [roleId]
  );

  if (result.rows.length === 0) {
    return undefined;
  }

  const role = result.rows[0];
  const permissions = await fetchPermissionsForRole(db, role.id);

  return { ...role, permissions };
}

/**
 * Get a role by name (without permissions)
 * Returns undefined if not found
 */
export async function getRoleByName(db: DB, name: string): Promise<Role | undefined> {
  const result = await db.query<Role>(
    'SELECT id, name, description, is_system, created_at FROM roles WHERE name = $1',
    [name]
  );

  return result.rows[0];
}

/**
 * Create a new role
 */
export async function createRole(
  db: DB,
  data: { name: string; description?: string }
): Promise<Role> {
  const result = await db.query<Role>(
    `INSERT INTO roles (name, description) VALUES ($1, $2)
     RETURNING id, name, description, is_system, created_at`,
    [data.name, data.description ?? null]
  );

  return result.rows[0];
}

/**
 * Update a role's name and/or description
 * Returns the updated role or undefined if not found
 */
export async function updateRole(
  db: DB,
  roleId: number,
  data: { name?: string; description?: string }
): Promise<Role | undefined> {
  const result = await db.query<Role>(
    `UPDATE roles SET
       name = COALESCE($1, name),
       description = COALESCE($2, description)
     WHERE id = $3
     RETURNING id, name, description, is_system, created_at`,
    [data.name ?? null, data.description ?? null, roleId]
  );

  return result.rows[0];
}

/**
 * Delete a role by ID
 * Returns false if the role is a system role (is_system=true) or not found
 * Returns true if successfully deleted
 */
export async function deleteRole(db: DB, roleId: number): Promise<boolean> {
  const lookupResult = await db.query<Role>(
    'SELECT id, name, description, is_system, created_at FROM roles WHERE id = $1',
    [roleId]
  );

  if (lookupResult.rows.length === 0) {
    return false;
  }

  const role = lookupResult.rows[0];
  if (role.is_system) {
    return false;
  }

  await db.query('DELETE FROM roles WHERE id = $1', [roleId]);
  return true;
}

/**
 * Get all available permissions
 */
export async function getAllPermissions(db: DB): Promise<Permission[]> {
  const result = await db.query<Permission>(
    'SELECT id, name, description, category, created_at FROM permissions ORDER BY category, name',
    []
  );
  return result.rows;
}

/**
 * Get permissions assigned to a specific role
 */
export async function getRolePermissions(db: DB, roleId: number): Promise<Permission[]> {
  const result = await db.query<Permission>(
    `SELECT p.id, p.name, p.description, p.category, p.created_at
     FROM permissions p
     JOIN role_permissions rp ON rp.permission_id = p.id
     WHERE rp.role_id = $1
     ORDER BY p.category, p.name`,
    [roleId]
  );
  return result.rows;
}

/**
 * Assign permissions to a role (idempotent — uses ON CONFLICT DO NOTHING)
 * Does nothing if permissionIds is empty
 */
export async function assignPermissionsToRole(
  db: DB,
  roleId: number,
  permissionIds: number[]
): Promise<void> {
  if (permissionIds.length === 0) {
    return;
  }

  // Build VALUES clause for bulk insert
  const values = permissionIds.map((_, i) => `($1, $${i + 2})`).join(', ');
  await db.query(
    `INSERT INTO role_permissions (role_id, permission_id) VALUES ${values} ON CONFLICT DO NOTHING`,
    [roleId, ...permissionIds]
  );
}

/**
 * Remove specific permissions from a role
 * Does nothing if permissionIds is empty
 */
export async function removePermissionsFromRole(
  db: DB,
  roleId: number,
  permissionIds: number[]
): Promise<void> {
  if (permissionIds.length === 0) {
    return;
  }

  const placeholders = permissionIds.map((_, i) => `$${i + 2}`).join(', ');
  await db.query(
    `DELETE FROM role_permissions WHERE role_id = $1 AND permission_id IN (${placeholders})`,
    [roleId, ...permissionIds]
  );
}

/**
 * Replace all permissions for a role (atomic operation)
 * Deletes all existing permissions and inserts the new set
 */
export async function setRolePermissions(
  db: DB,
  roleId: number,
  permissionIds: number[]
): Promise<void> {
  await db.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

  if (permissionIds.length > 0) {
    const values = permissionIds.map((_, i) => `($1, $${i + 2})`).join(', ');
    await db.query(
      `INSERT INTO role_permissions (role_id, permission_id) VALUES ${values} ON CONFLICT DO NOTHING`,
      [roleId, ...permissionIds]
    );
  }
}

/**
 * Get permission names for a role by role ID
 *
 * Special case: admin role (name='admin' AND is_system=true) returns ALL permissions
 * to support the admin bypass pattern in middleware.
 *
 * Returns empty array if role not found.
 */
export async function getPermissionNamesByRoleId(db: DB, roleId: number): Promise<string[]> {
  const roleResult = await db.query<Role>(
    'SELECT id, name, description, is_system, created_at FROM roles WHERE id = $1',
    [roleId]
  );

  if (roleResult.rows.length === 0) {
    return [];
  }

  const role = roleResult.rows[0];

  // Admin bypass: return all permissions
  if (role.is_system && role.name === 'admin') {
    const allResult = await db.query<{ name: string }>(
      'SELECT name FROM permissions ORDER BY name',
      []
    );
    return allResult.rows.map(r => r.name);
  }

  // Other roles: return only assigned permissions
  const assignedResult = await db.query<{ name: string }>(
    `SELECT p.name
     FROM permissions p
     JOIN role_permissions rp ON rp.permission_id = p.id
     WHERE rp.role_id = $1
     ORDER BY p.name`,
    [roleId]
  );
  return assignedResult.rows.map(r => r.name);
}
