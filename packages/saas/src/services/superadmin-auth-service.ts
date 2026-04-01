import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Pool, PoolClient } from '../db/types.js';

export interface SuperadminRow {
  id: number;
  username: string;
  password_hash?: string;
}

export interface MintSuperadminJwtInput {
  superadminId: number;
  username: string;
}

/**
 * Authentication service for system-level superadmin accounts.
 *
 * Uses SUPERADMIN_JWT_SECRET (not JWT_SECRET) to sign tokens.
 * Tokens carry scope='superadmin' and are non-interoperable with org JWTs.
 */
export class SuperadminAuthService {
  constructor(private pool: Pool) {}

  /**
   * Creates a new superadmin in public.superadmins with a hashed password.
   */
  async createSuperadmin(username: string, password: string): Promise<SuperadminRow> {
    const client: PoolClient = await this.pool.connect();
    try {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const result = await client.query<SuperadminRow>(
        `INSERT INTO superadmins (username, password_hash)
         VALUES ($1, $2)
         RETURNING id, username`,
        [username, passwordHash],
      );

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Validates username + password against public.superadmins.
   * Returns the superadmin row (without password_hash) on success, null on failure.
   */
  async validateCredentials(username: string, password: string): Promise<SuperadminRow | null> {
    const client: PoolClient = await this.pool.connect();
    try {
      const result = await client.query<SuperadminRow>(
        'SELECT id, username, password_hash FROM superadmins WHERE username = $1',
        [username],
      );

      const row = result.rows[0];
      if (!row || !row.password_hash) return null;

      const match = await bcrypt.compare(password, row.password_hash);
      if (!match) return null;

      return { id: row.id, username: row.username };
    } finally {
      client.release();
    }
  }

  /**
   * Mints a short-lived JWT for superadmin access.
   *
   * - Signed with SUPERADMIN_JWT_SECRET (separate from org JWT_SECRET)
   * - Payload: { id, username, scope: 'superadmin' }
   * - Default expiry: 8h (overridable via SUPERADMIN_JWT_EXPIRES_IN)
   */
  mintSuperadminJwt(input: MintSuperadminJwtInput): string {
    const secret = process.env.SUPERADMIN_JWT_SECRET?.trim();
    if (!secret || secret.length < 32) {
      throw new Error(
        'FATAL: SUPERADMIN_JWT_SECRET is missing or too short. ' +
          'Generate a secure secret with: openssl rand -base64 64',
      );
    }

    const expiresIn = (process.env.SUPERADMIN_JWT_EXPIRES_IN ?? '8h') as string;

    return jwt.sign(
      {
        id: input.superadminId,
        username: input.username,
        scope: 'superadmin',
      },
      secret,
      { expiresIn: expiresIn as any },
    );
  }
}
