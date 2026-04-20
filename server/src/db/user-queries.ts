import { type DB } from './client.js';
import { type UserPublic } from '../types/user.js';
import crypto from 'crypto';

// --- Database Row Interfaces ---

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  role_id: number;
  role_name: string;
  is_system_role: boolean;
  created_at: string;
  org_id?: number;
  org_slug?: string;
}

interface OrganizationRow {
  id: number;
  slug: string;
  schema_name: string;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

/**
 * Get all users without passwords (for admin panel)
 * Uses JOIN on roles table to get role_name
 * @param db - Database client
 * @param options - Pagination options (limit, offset)
 * @returns Array of users without password hashes
 */
export async function getAllUsers(
  db: DB,
  options?: { limit?: number; offset?: number }
): Promise<UserPublic[]> {
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  const result = await db.query<UserPublic>(
    `SELECT u.id, u.username, u.role_id, r.name as role_name, u.created_at
     FROM users u
     JOIN roles r ON r.id = u.role_id
     ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return result.rows;
}

/**
 * Get user by ID without password
 * Uses JOIN on roles table to get role_name
 * @param db - Database client
 * @param userId - User ID
 * @returns User without password hash, or undefined if not found
 */
export async function getUserById(
  db: DB,
  userId: number
): Promise<UserPublic | undefined> {
  const result = await db.query<UserPublic>(
    `SELECT u.id, u.username, u.role_id, r.name as role_name, u.created_at
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1`,
    [userId]
  );

  return result.rows[0];
}

/**
 * Update user role by role ID
 * @param db - Database client
 * @param userId - User ID
 * @param roleId - New role ID (must reference a valid role in the roles table)
 */
export async function updateUserRole(
  db: DB,
  userId: number,
  roleId: number
): Promise<void> {
  await db.query(
    'UPDATE users SET role_id = $1 WHERE id = $2',
    [roleId, userId]
  );
}

/**
 * Delete user by ID
 * @param db - Database client
 * @param userId - User ID
 * @returns true if deleted, false if user didn't exist
 */
export async function deleteUser(
  db: DB,
  userId: number
): Promise<boolean> {
  const result = await db.query(
    'DELETE FROM users WHERE id = $1',
    [userId]
  );

  return (result.rowCount ?? 0) > 0;
}

/**
 * Get count of admin users (for last admin protection)
 * Uses JOIN on roles table to find users with role name 'admin'
 * @param db - Database client
 * @returns Number of users with role_name='admin'
 */
export async function getAdminCount(db: DB): Promise<number> {
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE r.name = 'admin'`
  );

  return parseInt(result.rows[0]?.count ?? '0', 10);
}

/**
 * Get user by username with password hash
 * @param db - Database client
 * @param username - Username to search for
 * @returns UserRow or undefined
 */
export async function getUserByUsername(db: DB, username: string): Promise<UserRow | undefined> {
  const result = await db.query<UserRow>(
    `SELECT u.id, u.username, u.password_hash, u.role_id,
            r.name AS role_name, r.is_system AS is_system_role, u.created_at
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.username = $1`,
    [username]
  );
  return result.rows[0];
}

export async function getTenantUserByUsername(db: DB, username: string): Promise<UserRow | undefined> {
  const orgsResult = await db.query<OrganizationRow>(
    'SELECT id, slug, schema_name FROM organizations ORDER BY id'
  );

  for (const org of orgsResult.rows) {
    const schemaName = quoteIdentifier(org.schema_name);

    try {
      const result = await db.query<UserRow>(
        `SELECT u.id, u.username, u.password_hash, u.role_id,
                r.name AS role_name, r.is_system AS is_system_role, u.created_at,
                $2::integer AS org_id, $3::text AS org_slug
         FROM ${schemaName}.users u
         JOIN ${schemaName}.roles r ON r.id = u.role_id
         WHERE u.username = $1`,
        [username, org.id, org.slug]
      );

      if (result.rows[0]) {
        return result.rows[0];
      }
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === '42P01') {
        continue;
      }
      throw error;
    }
  }

  return undefined;
}

export async function hasTenantUserWithUsername(db: DB, username: string): Promise<boolean> {
  const tenantUser = await getTenantUserByUsername(db, username);
  return Boolean(tenantUser);
}

/**
 * Create a new user
 * @param db - Database client
 * @param username - Username
 * @param passwordHash - Hashed password
 * @returns Created UserRow
 */
export async function createUser(db: DB, username: string, passwordHash: string): Promise<UserRow> {
  const result = await db.query<UserRow>(
    `INSERT INTO users (username, password_hash)
     VALUES ($1, $2)
     RETURNING id, username, password_hash,
       role_id,
       (SELECT name FROM roles WHERE id = role_id) AS role_name,
       (SELECT is_system FROM roles WHERE id = role_id) AS is_system_role,
       created_at`,
    [username, passwordHash]
  );
  return result.rows[0];
}

/**
 * Update user password
 * @param db - Database client
 * @param userId - User ID
 * @param newPasswordHash - New hashed password
 */
export async function updateUserPassword(db: DB, userId: number, newPasswordHash: string): Promise<void> {
  await db.query(
    'UPDATE users SET password_hash = $1 WHERE id = $2',
    [newPasswordHash, userId]
  );
}

/**
 * Generate random secure password
 * Meets complexity requirements:
 * - 16 characters total
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 * - At least one special character
 *
 * @returns Random 16-character password
 */
export function generateRandomPassword(): string {
  const length = 16;
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const all = uppercase + lowercase + digits + special;

  // Ensure at least one character from each category
  let password = '';
  password += uppercase[crypto.randomInt(0, uppercase.length)];
  password += lowercase[crypto.randomInt(0, lowercase.length)];
  password += digits[crypto.randomInt(0, digits.length)];
  password += special[crypto.randomInt(0, special.length)];

  // Fill remaining with random characters
  for (let i = 4; i < length; i++) {
    password += all[crypto.randomInt(0, all.length)];
  }

  // Shuffle the password to avoid predictable pattern (first 4 chars always ULDS)
  const chars = password.split('');
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
