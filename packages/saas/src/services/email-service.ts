/**
 * EmailService — handles email verification tokens and sending.
 *
 * Sending is a console-log stub when SMTP_HOST is not configured.
 * A real SMTP integration can be added later without changing the interface.
 */
import crypto from 'crypto';
import type { DB, Organization } from '../db/types.js';
import { logger } from '../utils/logger.js';

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class EmailService {
  constructor(private readonly db: DB) {}

  /** Generate a cryptographically random 64-character hex token. */
  generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Store a verification token against a user in the org schema.
   * Sets search_path to the org schema before writing.
   */
  async storeVerificationToken(
    org: Organization,
    userId: number,
    token: string
  ): Promise<void> {
    const expires = new Date(Date.now() + VERIFICATION_TTL_MS).toISOString();
    await this.db.query(`SET search_path TO "${org.schema_name}", public`);
    await this.db.query(
      `UPDATE users
          SET verification_token = $1,
              verification_expires = $2,
              updated_at = NOW()
        WHERE id = $3`,
      [token, expires, userId]
    );
  }

  /**
   * Verify a token against the org's users table.
   * Returns the user id if the token is valid and not expired, null otherwise.
   */
  async verifyEmailToken(org: Organization, token: string): Promise<number | null> {
    await this.db.query(`SET search_path TO "${org.schema_name}", public`);
    const result = await this.db.query<{ id: number; verification_expires: string }>(
      `SELECT id, verification_expires
         FROM users
        WHERE verification_token = $1`,
      [token]
    );

    if (!result.rows.length) return null;

    const row = result.rows[0]!;
    const expires = new Date(row.verification_expires).getTime();
    if (Date.now() > expires) return null;

    return row.id;
  }

  /**
   * Mark a user's email as verified and clear the token fields.
   */
  async markEmailVerified(org: Organization, userId: number): Promise<void> {
    await this.db.query(`SET search_path TO "${org.schema_name}", public`);
    await this.db.query(
      `UPDATE users
          SET email_verified = TRUE,
              verification_token = NULL,
              verification_expires = NULL,
              updated_at = NOW()
        WHERE id = $1`,
      [userId]
    );
  }

  /**
   * Send a verification email to the user.
   * When SMTP_HOST is not set, logs to console instead of sending.
   */
  async sendVerificationEmail(
    to: string,
    token: string,
    orgSlug: string
  ): Promise<void> {
    if (!process.env['SMTP_HOST']) {
      logger.info(
        `[EmailService] SMTP not configured. Verification email stub:\n` +
        `  To: ${to}\n` +
        `  Org: ${orgSlug}\n` +
        `  Token: ${token}\n` +
        `  URL: /api/auth/verify-email/${token}`
      );
      return;
    }

    // Real SMTP integration placeholder — add nodemailer/SES here when ready
    throw new Error('SMTP sending not yet implemented');
  }
}
