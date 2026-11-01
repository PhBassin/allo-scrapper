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
  /** Set when the token was revoked by rotation: the token that replaced it. */
  replaced_by_id: number | null;
}

/** Anything that can run a query — the pool or a transaction client. */
type Queryable = Pick<DB, 'query'>;

/**
 * Outcome of presenting a refresh token:
 * - `valid`: the token is live; `userId` owns it.
 * - `race`: the token was rotated less than `REUSE_GRACE_MS` ago — a
 *   concurrent refresh won, and its fresh cookies supersede this one.
 * - `rejected`: unknown, expired, revoked, or replayed.
 */
export type RefreshTokenCheck =
  | { status: 'valid'; userId: number }
  | { status: 'race' }
  | { status: 'rejected' };

const REJECTED: RefreshTokenCheck = { status: 'rejected' };
const RACE: RefreshTokenCheck = { status: 'race' };

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
    `SELECT id, user_id, token_hash, expires_at, created_at, revoked_at, replaced_by_id
     FROM refresh_tokens
     WHERE token_hash = $1`,
    [tokenHash]
  );
  return result.rows[0];
}

async function findSuccessor(
  db: DB,
  id: number
): Promise<Pick<RefreshTokenRow, 'id' | 'replaced_by_id'> | undefined> {
  const result = await db.query<Pick<RefreshTokenRow, 'id' | 'replaced_by_id'>>(
    `SELECT id, replaced_by_id FROM refresh_tokens WHERE id = $1`,
    [id]
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

async function revokeById(db: DB, id: number): Promise<void> {
  await db.query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE id = $1 AND revoked_at IS NULL`,
    [id]
  );
}

async function revokeByUserId(db: Queryable, userId: number): Promise<void> {
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
 * supply pre-hashed values. The old token records its successor in
 * `replaced_by_id`, which is what marks it as rotated rather than revoked.
 * Returns false (and inserts nothing) if the old token is not found / already
 * revoked (rowCount = 0).
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
       WHERE token_hash = $1 AND user_id = $2 AND revoked_at IS NULL
       RETURNING id`,
      [oldTokenHash, userId]
    );

    if ((updateResult.rowCount ?? 0) === 0) {
      return false;
    }

    const insertResult = await client.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [userId, newTokenHash, expiresAt]
    );

    await client.query(
      `UPDATE refresh_tokens SET replaced_by_id = $1 WHERE id = $2`,
      [insertResult.rows[0].id, updateResult.rows[0].id]
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
 * Check a presented refresh token (see `RefreshTokenCheck`).
 *
 * Reuse detection only concerns tokens revoked by *rotation*
 * (`replaced_by_id` set): a token revoked on purpose (logout, password change,
 * admin action) is simply rejected. A rotated token presented more than
 * `REUSE_GRACE_MS` after its rotation is a replay:
 * - if its successor was itself rotated, two parties hold diverging copies of
 *   the session — a theft signal, so every refresh token of the user is
 *   revoked;
 * - otherwise the successor was never used (typically a refresh response lost
 *   on the network, or a thief that has not refreshed yet), so only that
 *   successor is revoked: the replayed branch dies, the user's other Sessions
 *   live on.
 * Inside the grace window it is the legitimate concurrent-refresh race.
 */
export async function validateRefreshToken(
  db: DB,
  rawToken: string,
): Promise<RefreshTokenCheck> {
  const tokenHash = hashToken(rawToken);

  const record = await findByTokenHash(db, tokenHash);

  if (!record) {
    return REJECTED;
  }

  if (record.revoked_at !== null) {
    if (record.replaced_by_id === null) {
      logger.debug(`Revoked refresh token presented for user ${record.user_id}`);
      return REJECTED;
    }
    const revokedForMs = Date.now() - new Date(record.revoked_at).getTime();
    if (revokedForMs <= REUSE_GRACE_MS) {
      logger.debug(`Refresh token presented within reuse grace window for user ${record.user_id}`);
      return RACE;
    }
    await handleRotatedTokenReplay(db, record.user_id, record.replaced_by_id);
    return REJECTED;
  }

  if (new Date(record.expires_at) < new Date()) {
    logger.debug(`Refresh token expired for user ${record.user_id}`);
    return REJECTED;
  }

  return { status: 'valid', userId: record.user_id };
}

async function handleRotatedTokenReplay(
  db: DB,
  userId: number,
  successorId: number,
): Promise<void> {
  const successor = await findSuccessor(db, successorId);
  if (successor?.replaced_by_id != null) {
    await revokeByUserId(db, userId);
    logger.warn('Security: refresh token reuse detected, all sessions revoked', { userId });
    return;
  }
  await revokeById(db, successorId);
  logger.warn('Security: rotated refresh token replayed, its unused successor revoked', { userId });
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
 * Accepts a transaction client so callers can revoke atomically with the
 * change that motivates it.
 */
export async function revokeAllUserTokens(
  db: Queryable,
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
