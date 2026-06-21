import type { DB } from './index.js';

export interface RefreshTokenRow {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
  revoked_at: Date | null;
}

/**
 * Insert a new refresh token hash into the store.
 */
export async function insertRefreshToken(
  db: DB,
  userId: number,
  tokenHash: string,
  expiresAt: Date
): Promise<void> {
  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
}

/**
 * Look up a refresh token by its SHA-256 hash.
 * Returns the full row or undefined if not found.
 */
export async function findByTokenHash(
  db: DB,
  tokenHash: string
): Promise<RefreshTokenRow | undefined> {
  const result = await db.query<RefreshTokenRow>(
    `SELECT id, user_id, token_hash, expires_at, created_at, revoked_at
     FROM refresh_tokens
     WHERE token_hash = $1`,
    [tokenHash]
  );
  return result.rows[0];
}

/**
 * Revoke a single token by its hash (soft-delete).
 * Only revokes if not already revoked.
 */
export async function revokeByTokenHash(
  db: DB,
  tokenHash: string
): Promise<void> {
  await db.query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [tokenHash]
  );
}

/**
 * Revoke all active tokens for a given user.
 */
export async function revokeByUserId(
  db: DB,
  userId: number
): Promise<void> {
  await db.query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
}

/**
 * Delete expired or long-revoked tokens older than the retention window.
 * Returns the number of deleted rows.
 */
export async function cleanupExpired(
  db: DB,
  retentionDays: number
): Promise<number> {
  const result = await db.query<{ count: string }>(
    `WITH deleted AS (
       DELETE FROM refresh_tokens
       WHERE expires_at < NOW() - INTERVAL '1 day' * $1
          OR revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '1 day' * $1
       RETURNING id
     )
     SELECT COUNT(*)::text AS count FROM deleted`,
    [retentionDays]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Atomically revoke an old token and insert a new one inside a transaction.
 * Throws if the old token is not found / already revoked (rowCount = 0).
 */
export async function rotateRefreshToken(
  db: DB,
  userId: number,
  oldTokenHash: string,
  newTokenHash: string,
  expiresAt: Date
): Promise<void> {
  await db.transaction(async (client) => {
    const updateResult = await client.query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE token_hash = $1 AND user_id = $2 AND revoked_at IS NULL`,
      [oldTokenHash, userId]
    );

    if ((updateResult.rowCount ?? 0) === 0) {
      throw new Error('Refresh token already consumed or invalid');
    }

    await client.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, newTokenHash, expiresAt]
    );
  });
}
