import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import type { DB } from '../db/index.js';
import {
  insertRefreshToken,
  findByTokenHash,
  revokeByTokenHash,
  revokeByUserId,
  cleanupExpired,
  rotateRefreshTokenTx,
} from '../db/refresh-token-queries.js';

const DEFAULT_EXPIRY_MS = parseRefreshTokenExpiry();

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
    logger.warn(`Refresh token used after revocation for user ${record.user_id}`);
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
 * Returns the raw new token on success.
 */
export async function rotateRefreshToken(
  db: DB,
  userId: number,
  oldToken: string,
  expiryMs: number = DEFAULT_EXPIRY_MS,
): Promise<string> {
  const oldTokenHash = hashToken(oldToken);
  const rawToken = crypto.randomBytes(48).toString('base64url');
  const newTokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + expiryMs);

  await rotateRefreshTokenTx(db, userId, oldTokenHash, newTokenHash, expiresAt);

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
