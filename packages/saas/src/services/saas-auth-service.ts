/**
 * SaaS-specific auth service.
 *
 * Differs from the core AuthService by:
 *  - Targeting a tenant schema (uses pool.connect() + SET search_path)
 *  - Including org_id / org_slug in the JWT payload
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Pool, Organization, MintJwtInput } from '../db/types.js';

interface AdminUserRow {
  id: number;
  username: string;
  role_id: number;
  role_name: string;
}

export class SaasAuthService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Creates the initial admin user inside the org's private schema.
   *
   * Uses a dedicated pool client so that SET search_path is scoped to
   * this connection only and does not bleed into other queries.
   */
  async createAdminUser(
    org: Organization,
    email: string,
    password: string
  ): Promise<AdminUserRow> {
    const client = await this.pool.connect();
    try {
      // NOTE: PostgreSQL does not support $1 parameterized form for SET.
      // schema_name is guaranteed safe: slugToSchemaName produces [a-z0-9_] only.
      await client.query(`SET search_path TO "${org.schema_name}", public`);
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // role_id = 1 assumes the 'admin' system role seeded in 000_bootstrap.sql
      const result = await client.query<AdminUserRow>(
        `INSERT INTO users (username, password_hash, role_id)
         VALUES ($1, $2, 1)
         RETURNING id, username, role_id,
                   (SELECT name FROM roles WHERE id = 1) AS role_name`,
        [email, passwordHash]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Mints a JWT for the newly created admin user.
   * The payload includes org_id and org_slug so downstream middleware
   * can resolve the tenant without a DB round-trip.
   */
  mintJwt(input: MintJwtInput): string {
    const secret = process.env.JWT_SECRET?.trim();
    if (!secret || secret.length < 32) {
      throw new Error(
        'FATAL: JWT_SECRET is missing or too short. ' +
          'Generate a secure secret with: openssl rand -base64 64'
      );
    }
    const expiresIn = process.env.JWT_EXPIRES_IN ?? '24h';
    return jwt.sign(
      {
        id: input.userId,
        username: input.username,
        org_id: input.orgId,
        org_slug: input.orgSlug,
        role_id: input.roleId,
        role_name: input.roleName,
        permissions: input.permissions,
      },
      secret,
      { expiresIn: expiresIn as any }
    );
  }
}
