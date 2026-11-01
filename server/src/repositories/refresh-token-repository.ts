import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import type { DB } from '../db/index.js';

/**
 * Refresh-token data-access module.
 *
 * One deep module behind which the entire credential lifecycle lives:
 * raw-token generation, SHA-256 hashing, expiry parsing, storage, validation,
 * rotation, revocation, and cleanup. The public surface deals exclusively in
 * raw tokens — hashing is an internal implementation detail and never crosses
 * this seam.
 */

interface RefreshTokenRow {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
  revoked_at: Date | null;
}

const DEFAULT_EXPIRY_MS = parseRefreshTokenExpiry();

/**
 * How long after its rotation a refresh token may still be presented without
 * being treated as stolen. Covers the legitimate race where two requests (tabs,
 * retries) send the same cookie and one of them rotates it first.
 */
export const REUSE_GRACE_MS = 30 * 1000;

export function parseRefreshTokenExpiry(): number {
  const DEFAULT = 7 * 24 * 60 * 60 * 1000; // 7 days
  const envValue = process.env.REFRESH_TOKEN_EXPIRY;
  if (!envValue) return DEFAULT;
  const match = envValue.trim().match(/^(\d+)([dh])$/i);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num <= 0) {
      logger.warn(`REFRESH_TOKEN_EXPIRY value must be positive: "${envValue}", using default 7d`);
      return DEFAULT;
    }
    const unit = match[2].toLowerCase();
    if (unit === 'd') return num * 24 * 60 * 60 * 1000;
    if (unit === 'h') return num * 60 * 60 * 1000;
  }
  const ms = parseInt(envValue, 10);
  if (!isNaN(ms) && ms > 0) return ms;
  logger.warn(`Invalid REFRESH_TOKEN_EXPIRY value: "${envValue}", using default 7d`);
  return DEFAULT;
}

/**
 * Hash a raw token using SHA-256 for storage.
 * We never store raw tokens in the database.
 */
function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

// ---------------------------------------------------------------------------
// Internal SQL primitives — not exported. All hashing happens in the public
// functions below, so no SQL primitive ever receives a pre-hashed token from
// outside this module.
// ---------------------------------------------------------------------------

async function insertRefreshToken(
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

async function findByTokenHash(
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

async function revokeByTokenHash(db: DB, tokenHash: string): Promise<void> {
  await db.query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [tokenHash]
  );
}

async function revokeByUserId(db: DB, userId: number): Promise<void> {
  await db.query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
}

async function cleanupExpired(db: DB, retentionDays: number): Promise<number> {
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
 * Internal: atomically revoke an old token and insert a new one inside a
 * transaction. Both hashes are computed within this module — callers never
 * supply pre-hashed values. Returns false (and inserts nothing) if the old
 * token is not found / already revoked (rowCount = 0).
 */
async function rotateRefreshTokenTx(
  db: DB,
  userId: number,
  oldTokenHash: string,
  newTokenHash: string,
  expiresAt: Date
): Promise<boolean> {
  return db.transaction(async (client) => {
    const updateResult = await client.query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE token_hash = $1 AND user_id = $2 AND revoked_at IS NULL`,
      [oldTokenHash, userId]
    );

    if ((updateResult.rowCount ?? 0) === 0) {
      return false;
    }

    await client.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, newTokenHash, expiresAt]
    );
    return true;
  });
}

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

/**
 * Generate a new refresh token for a user.
 * Returns the raw token (to set as cookie) and stores the hash in DB.
 */
export async function generateRefreshToken(
  db: DB,
  userId: number,
  expiryMs: number = DEFAULT_EXPIRY_MS,
): Promise<string> {
  const rawToken = crypto.randomBytes(48).toString('base64url');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + expiryMs);

  await insertRefreshToken(db, userId, tokenHash, expiresAt);

  logger.debug(`Refresh token generated for user ${userId}`);
  return rawToken;
}

/**
 * Validate a refresh token and return the associated user ID.
 * Returns null if token is invalid, expired, or revoked.
 *
 * Reuse detection: a token presented more than `REUSE_GRACE_MS` after its
 * revocation is a theft signal (either the attacker or the real user is
 * replaying a rotated copy), so every refresh token of the user is revoked.
 * Inside the grace window it is the legitimate concurrent-refresh race and
 * only this request is rejected.
 */
export async function validateRefreshToken(
  db: DB,
  rawToken: string,
): Promise<number | null> {
  const tokenHash = hashToken(rawToken);

  const record = await findByTokenHash(db, tokenHash);

  if (!record) {
    return null;
  }

  if (record.revoked_at !== null) {
    const revokedForMs = Date.now() - new Date(record.revoked_at).getTime();
    if (revokedForMs <= REUSE_GRACE_MS) {
      logger.debug(`Refresh token presented within reuse grace window for user ${record.user_id}`);
      return null;
    }
    await revokeByUserId(db, record.user_id);
    logger.warn('Security: refresh token reuse detected, all sessions revoked', {
      userId: record.user_id,
    });
    return null;
  }

  if (new Date(record.expires_at) < new Date()) {
    logger.debug(`Refresh token expired for user ${record.user_id}`);
    return null;
  }

  return record.user_id;
}

/**
 * Revoke a specific refresh token by its raw value.
 */
export async function revokeRefreshToken(
  db: DB,
  rawToken: string,
): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await revokeByTokenHash(db, tokenHash);
}

/**
 * Atomically rotate a refresh token: revoke the old one and generate a new one
 * inside a single database transaction. If any part fails, the entire operation
 * is rolled back — no two-token state can persist.
 *
 * Returns the raw new token on success, or null when the old token was
 * consumed concurrently (another request rotated it after validation).
 */
export async function rotateRefreshToken(
  db: DB,
  userId: number,
  oldToken: string,
  expiryMs: number = DEFAULT_EXPIRY_MS,
): Promise<string | null> {
  const oldTokenHash = hashToken(oldToken);
  const rawToken = crypto.randomBytes(48).toString('base64url');
  const newTokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + expiryMs);

  const rotated = await rotateRefreshTokenTx(db, userId, oldTokenHash, newTokenHash, expiresAt);
  if (!rotated) {
    logger.debug(`Refresh token already consumed during rotation for user ${userId}`);
    return null;
  }

  logger.debug(`Refresh token rotated for user ${userId}`);
  return rawToken;
}

/**
 * Revoke all refresh tokens for a user (e.g., on password change or logout-all).
 */
export async function revokeAllUserTokens(
  db: DB,
  userId: number,
): Promise<void> {
  await revokeByUserId(db, userId);
}

/**
 * Clean up expired or revoked tokens older than the retention period.
 * Should be called periodically (e.g., via cron or startup).
 */
export async function cleanupExpiredTokens(
  db: DB,
  retentionDays: number = 30,
): Promise<number> {
  const count = await cleanupExpired(db, retentionDays);
  if (count > 0) {
    logger.info(`Cleaned up ${count} expired refresh tokens`);
  }
  return count;
}
