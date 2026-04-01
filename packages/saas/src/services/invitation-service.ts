import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { Pool } from '../db/types.js';

export interface OrgRef {
  id: string;
  slug: string;
  schema_name: string;
}

export interface Invitation {
  id: string;
  email: string;
  role_id: number;
  token: string;
  invited_by: number;
  accepted_at: Date | null;
  expires_at: Date;
  created_at: Date;
  /** Present when loaded via a join to public.organizations */
  org_id?: string;
  org_slug?: string;
  org_schema_name?: string;
}

export interface CreateInvitationInput {
  email: string;
  role_id: number;
  invited_by: number;
  /** Optional: caller-supplied token (e.g. prefixed with orgSlug). If omitted, a random token is generated. */
  token?: string;
}

export interface AcceptedUser {
  id: number;
  username: string;
  role_id: number;
  role_name: string;
}

/** Invitation validity window: 48 hours */
const INVITE_TTL_MS = 48 * 60 * 60 * 1000;

export class InvitationService {
  constructor(private pool: Pool) {}

  /**
   * Creates a new pending invitation in the org schema.
   * Generates a unique secure token valid for 48 hours.
   */
  async createInvitation(org: OrgRef, input: CreateInvitationInput): Promise<Invitation> {
    const token = input.token ?? crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    const client = await this.pool.connect();
    try {
      await client.query(`SET search_path TO "${org.schema_name}", public`);
      const result = await client.query<Invitation>(
        `INSERT INTO invitations (email, role_id, token, invited_by, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [input.email, input.role_id, token, input.invited_by, expiresAt],
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Looks up a pending invitation by token.
   * Returns null if not found, expired, or already accepted.
   */
  async getInvitationByToken(org: OrgRef, token: string): Promise<Invitation | null> {
    const client = await this.pool.connect();
    try {
      await client.query(`SET search_path TO "${org.schema_name}", public`);
      const result = await client.query<Invitation>(
        `SELECT * FROM invitations WHERE token = $1`,
        [token],
      );
      if (result.rows.length === 0) return null;

      const invite = result.rows[0];
      if (new Date(invite.expires_at) < new Date()) return null;
      if (invite.accepted_at !== null) return null;

      return invite;
    } finally {
      client.release();
    }
  }

  /**
   * Accepts an invitation:
   *  1. Creates the user in the org schema with a bcrypt-hashed password
   *  2. Marks the invitation as accepted
   * All within a single dedicated pool client (same search_path).
   */
  async acceptInvitation(
    org: OrgRef,
    invitation: Invitation,
    password: string,
  ): Promise<AcceptedUser> {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const client = await this.pool.connect();
    try {
      await client.query(`SET search_path TO "${org.schema_name}", public`);

      // Insert the new user with the invited role
      const userResult = await client.query<AcceptedUser>(
        `INSERT INTO users (username, password_hash, role_id)
         VALUES ($1, $2, $3)
         RETURNING id, username, role_id,
                   (SELECT name FROM roles WHERE id = $3) AS role_name`,
        [invitation.email, passwordHash, invitation.role_id],
      );

      // Mark invitation as accepted
      await client.query(
        `UPDATE invitations SET accepted_at = NOW() WHERE id = $1`,
        [invitation.id],
      );

      return userResult.rows[0];
    } finally {
      client.release();
    }
  }
}
