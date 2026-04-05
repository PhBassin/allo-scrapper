/**
 * InvitationService — manages pending member invitations for an org.
 *
 * Token format: `orgSlug:hex64`
 * This allows resolving the org schema from the token without a global lookup table.
 */
import crypto from 'crypto';
import type { DB, Organization, Invitation } from '../db/types.js';

const INVITATION_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

export interface CreateInvitationInput {
  email: string;
  role_id: number;
  created_by?: number;
}

export class InvitationService {
  constructor(private readonly db: DB) {}

  /**
   * Create a new invitation row in the org schema.
   * Token is prefixed with `orgSlug:` so it can be resolved without a DB lookup.
   */
  async createInvitation(org: Organization, input: CreateInvitationInput): Promise<Invitation> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const token = `${org.slug}:${rawToken}`;
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS).toISOString();

    await this.db.query(`SET search_path TO "${org.schema_name}", public`);
    const result = await this.db.query<Invitation>(
      `INSERT INTO invitations (email, role_id, token, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.email, input.role_id, token, expiresAt, input.created_by ?? null]
    );

    return result.rows[0]!;
  }

  /**
   * Look up an invitation by its token.
   * Returns null if the token is not found, already accepted, or expired.
   */
  async getInvitationByToken(org: Organization, token: string): Promise<Invitation | null> {
    await this.db.query(`SET search_path TO "${org.schema_name}", public`);
    const result = await this.db.query<Invitation>(
      `SELECT * FROM invitations WHERE token = $1`,
      [token]
    );

    if (!result.rows.length) return null;

    const inv = result.rows[0]!;

    if (inv.accepted_at !== null) return null;
    if (new Date(inv.expires_at).getTime() < Date.now()) return null;

    return inv;
  }

  /**
   * Accept an invitation: create a user and mark the invitation accepted.
   * Returns the newly created user row.
   */
  async acceptInvitation(
    org: Organization,
    invitation: Invitation,
    passwordHash: string
  ): Promise<{ id: number; username: string; role_id: number; role_name?: string }> {
    await this.db.query(`SET search_path TO "${org.schema_name}", public`);

    const userResult = await this.db.query<{
      id: number;
      username: string;
      role_id: number;
      role_name?: string;
    }>(
      `INSERT INTO users (username, password_hash, role_id, email_verified)
       VALUES ($1, $2, $3, TRUE)
       RETURNING id, username, role_id`,
      [invitation.email, passwordHash, invitation.role_id]
    );

    const user = userResult.rows[0]!;

    await this.db.query(
      `UPDATE invitations SET accepted_at = NOW() WHERE id = $1`,
      [invitation.id]
    );

    return user;
  }
}
