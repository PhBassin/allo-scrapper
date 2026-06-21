import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import type { DB } from '../db/index.js';

interface RefreshTokenRecord {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
  revoked_at: Date | null;
}

const DEFAULT_EXPIRY_MS = parseRefreshTokenExpiry();

export function parseRefreshTokenExpiry(): number {
  const DEFAULT = 7 * 24 * 60 * 60 * 1000; // 7 days
  const envValue = process.env.REFRESH_TOKEN_EXPIRY;
  if (!envValue) return DEFAULT;
  // Support human-readable format like '7d', '30d'
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
  // Fallback: parse as milliseconds
  const ms = parseInt(envValue, 10);
  if (!isNaN(ms) && ms > 0) return ms;
  logger.warn(`Invalid REFRESH_TOKEN_EXPIRY value: "${envValue}", using default 7d`);
  return DEFAULT;
}

/**
 * Service for generating, validating, and revoking refresh tokens.
 * 
 * Refresh tokens are opaque random strings stored as SHA-256 hashes in the DB.
 * The raw token is sent to the client as an httpOnly cookie.
 */
export class RefreshTokenService {
  constructor(private db: DB) {}

  /**
   * Generate a new refresh token for a user.
   * Returns the raw token (to set as cookie) and stores the hash in DB.
   */
  async generate(userId: number, expiryMs: number = DEFAULT_EXPIRY_MS): Promise<string> {
    const rawToken = crypto.randomBytes(48).toString('base64url');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + expiryMs);

    await this.db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt]
    );

    logger.debug(`Refresh token generated for user ${userId}`);
    return rawToken;
  }

  /**
   * Validate a refresh token and return the associated user ID.
   * Returns null if token is invalid, expired, or revoked.
   */
  async validate(rawToken: string): Promise<number | null> {
    const tokenHash = this.hashToken(rawToken);

    const result = await this.db.query<RefreshTokenRecord>(
      `SELECT id, user_id, token_hash, expires_at, revoked_at
       FROM refresh_tokens
       WHERE token_hash = $1`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const record = result.rows[0];

    // Check if revoked
    if (record.revoked_at !== null) {
      logger.warn(`Refresh token used after revocation for user ${record.user_id}`);
      return null;
    }

    // Check if expired
    if (new Date(record.expires_at) < new Date()) {
      logger.debug(`Refresh token expired for user ${record.user_id}`);
      return null;
    }

    return record.user_id;
  }

  /**
   * Revoke a specific refresh token by its raw value.
   */
  async revoke(rawToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);

    await this.db.query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash]
    );
  }

  /**
   * Atomically rotate a refresh token: revoke the old one and generate a new one
   * inside a single database transaction. If any part fails, the entire operation
   * is rolled back — no two-token state can persist.
   *
   * Returns the raw new token on success.
   */
  async rotate(userId: number, oldToken: string, expiryMs: number = DEFAULT_EXPIRY_MS): Promise<string> {
    const oldTokenHash = this.hashToken(oldToken);
    const rawToken = crypto.randomBytes(48).toString('base64url');
    const newTokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + expiryMs);

    await this.db.transaction(async (client) => {
      const updateResult = await client.query(
        `UPDATE refresh_tokens SET revoked_at = NOW()
         WHERE token_hash = $1 AND user_id = $2 AND revoked_at IS NULL`,
        [oldTokenHash, userId]
      );

      if (updateResult.rowCount === 0) {
        throw new Error('Refresh token already consumed or invalid');
      }

      await client.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [userId, newTokenHash, expiresAt]
      );
    });

    logger.debug(`Refresh token rotated for user ${userId}`);
    return rawToken;
  }

  /**
   * Revoke all refresh tokens for a user (e.g., on password change or logout-all).
   */
  async revokeAllForUser(userId: number): Promise<void> {
    await this.db.query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
  }

  /**
   * Clean up expired or revoked tokens older than the retention period.
   * Should be called periodically (e.g., via cron or startup).
   */
  async cleanup(retentionDays: number = 30): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `WITH deleted AS (
         DELETE FROM refresh_tokens
         WHERE expires_at < NOW() - INTERVAL '1 day' * $1
         OR revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '1 day' * $1
         RETURNING id
       )
       SELECT COUNT(*) as count FROM deleted`,
      [retentionDays]
    );

    const count = parseInt(result.rows[0].count);
    if (count > 0) {
      logger.info(`Cleaned up ${count} expired refresh tokens`);
    }
    return count;
  }

  /**
   * Hash a raw token using SHA-256 for storage.
   * We never store raw tokens in the database.
   */
  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');
  }
}
