import { type DB } from '../db/index.js';

/**
 * Count how many users currently hold the given role.
 * Used by the role-deletion route to enforce "role must not be in use".
 */
export async function getRoleInUseCount(db: DB, roleId: number): Promise<number> {
  const result = await db.query<{ count: string }>(
    'SELECT COUNT(*) as count FROM users WHERE role_id = $1',
    [roleId]
  );
  return parseInt(result.rows[0]?.count ?? '0', 10);
}
