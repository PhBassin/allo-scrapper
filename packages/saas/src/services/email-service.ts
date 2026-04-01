import crypto from 'crypto';
import type { Pool } from '../db/types.js';

export interface OrgRef {
  id: string;
  slug: string;
  schema_name: string;
}

/** Token validity window: 24 hours */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export class EmailService {
  constructor(private pool: Pool) {}

  /**
   * Generates a cryptographically random URL-safe token.
   */
  generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Persists the verification token against the user record in the org schema.
   * Uses a dedicated pool client to scope SET search_path to this connection only.
   */
  async storeVerificationToken(org: OrgRef, userId: number, token: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`SET search_path TO "${org.schema_name}", public`);
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
      await client.query(
        `UPDATE users
            SET verification_token   = $1,
                verification_expires = $2
          WHERE id = $3`,
        [token, expiresAt, userId],
      );
    } finally {
      client.release();
    }
  }

  /**
   * Looks up a verification token in the org schema.
   * Returns the user_id when the token is valid and not expired, null otherwise.
   */
  async verifyEmailToken(org: OrgRef, token: string): Promise<number | null> {
    const client = await this.pool.connect();
    try {
      await client.query(`SET search_path TO "${org.schema_name}", public`);
      const result = await client.query<{ user_id: number; expires_at: string }>(
        `SELECT id AS user_id, verification_expires AS expires_at
           FROM users
          WHERE verification_token = $1`,
        [token],
      );
      if (result.rows.length === 0) return null;
      const { user_id, expires_at } = result.rows[0];
      if (new Date(expires_at) < new Date()) return null;
      return user_id;
    } finally {
      client.release();
    }
  }

  /**
   * Sets email_verified = true and clears the verification token fields.
   */
  async markEmailVerified(org: OrgRef, userId: number): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`SET search_path TO "${org.schema_name}", public`);
      await client.query(
        `UPDATE users
            SET email_verified       = true,
                verification_token   = NULL,
                verification_expires = NULL
          WHERE id = $1`,
        [userId],
      );
    } finally {
      client.release();
    }
  }

  /**
   * Sends a verification email.
   *
   * This is a stub — no SMTP is configured yet.
   * Phase 2 extension point: swap in nodemailer / Resend / SendGrid.
   */
  async sendVerificationEmail(
    email: string,
    token: string,
    orgSlug: string,
  ): Promise<void> {
    // TODO (Phase 2 extension): integrate SMTP/transactional email provider
    // For now log to console so the token is visible during development.
    const verifyUrl = `/api/auth/verify-email/${token}`;
    console.info(
      `[EmailService] Verification email → ${email} (org: ${orgSlug})\n` +
        `  URL: ${verifyUrl}`,
    );
  }
}
