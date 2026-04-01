import { Router, type Request, type Response } from 'express';
import { EmailService } from '../services/email-service.js';
import { InvitationService } from '../services/invitation-service.js';
import { SaasAuthService } from '../services/saas-auth-service.js';
import { checkQuota } from '../middleware/quota.js';
import type { Pool } from '../db/types.js';
import type { Organization } from '../db/org-queries.js';

// Extend Express Request with SaaS fields populated by resolveTenant / requireAuth
declare module 'express-serve-static-core' {
  interface Request {
    org?: Organization;
    user?: {
      id: number;
      username: string;
      role_name: string;
      is_system_role?: boolean;
      permissions?: string[];
      org_id?: string;
      org_slug?: string;
    };
  }
}

export function createOnboardingRouter(): Router {
  const router = Router({ mergeParams: true });

  // ── GET /api/auth/verify-email/:token ──────────────────────────────────────
  // Public — no auth required.
  // The token encodes which org the user belongs to — look it up in public.organizations
  // via a join, then flip email_verified in the org schema.
  //
  // For simplicity in Phase 2 the token itself stores the org info embedded as
  // `<orgSlug>:<hex>` so we can route to the right schema without a global token table.
  router.get('/auth/verify-email/:token', async (req: Request, res: Response) => {
    const { token } = req.params;

    // Token format: "<orgSlug>:<hex32>"
    const sepIdx = token.indexOf(':');
    if (sepIdx === -1) {
      return res.status(400).json({ success: false, error: 'Invalid verification token format' });
    }
    const orgSlug = token.slice(0, sepIdx);
    const rawToken = token.slice(sepIdx + 1);

    const pool = req.app.get('pool') as Pool;

    // Resolve the org by slug to get schema_name
    // Re-use a lightweight inline query against public.organizations
    const client = await pool.connect();
    let org: { id: string; slug: string; schema_name: string } | null = null;
    try {
      const result = await client.query<{ id: string; slug: string; schema_name: string }>(
        `SELECT id, slug, schema_name FROM organizations WHERE slug = $1`,
        [orgSlug],
      );
      org = result.rows[0] ?? null;
    } finally {
      client.release();
    }

    if (!org) {
      return res.status(400).json({ success: false, error: 'Invalid verification token' });
    }

    const emailService = new EmailService(pool);
    const userId = await emailService.verifyEmailToken(org, rawToken);
    if (userId === null) {
      return res.status(400).json({ success: false, error: 'Invalid or expired verification token' });
    }

    await emailService.markEmailVerified(org, userId);

    return res.json({ success: true, message: 'Email verified successfully' });
  });

  // ── POST /api/auth/join/:token ─────────────────────────────────────────────
  // Public — no auth required.
  // Body: { password }
  // Token is a raw hex stored in the invitations table.
  // We need to locate which org the invitation belongs to.
  // Strategy: store org_slug in the invitation token prefix: "<orgSlug>:<hex32>"
  router.post('/auth/join/:token', async (req: Request, res: Response) => {
    const { token } = req.params;
    const { password } = req.body as { password?: string };

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        errors: ['password must be at least 8 characters'],
      });
    }

    // Token format: "<orgSlug>:<hex32>"
    const sepIdx = token.indexOf(':');
    if (sepIdx === -1) {
      return res.status(404).json({ success: false, error: 'Invalid invitation token' });
    }
    const orgSlug = token.slice(0, sepIdx);
    const rawToken = token.slice(sepIdx + 1);

    const pool = req.app.get('pool') as Pool;

    // Resolve org
    const client = await pool.connect();
    let org: { id: string; slug: string; schema_name: string } | null = null;
    try {
      const result = await client.query<{ id: string; slug: string; schema_name: string }>(
        `SELECT id, slug, schema_name FROM organizations WHERE slug = $1`,
        [orgSlug],
      );
      org = result.rows[0] ?? null;
    } finally {
      client.release();
    }

    if (!org) {
      return res.status(404).json({ success: false, error: 'Invalid invitation token' });
    }

    const invitationService = new InvitationService(pool);
    const invitation = await invitationService.getInvitationByToken(org, token);
    if (!invitation) {
      return res.status(404).json({ success: false, error: 'Invitation not found or expired' });
    }

    const user = await invitationService.acceptInvitation(org, invitation, password);

    const authService = new SaasAuthService(pool);
    const jwt = authService.mintJwt({
      userId: user.id,
      username: user.username,
      orgId: org.id,
      orgSlug: org.slug,
      roleId: user.role_id,
      roleName: user.role_name,
      permissions: [],
    });

    return res.status(201).json({
      success: true,
      token: jwt,
      user: {
        id: user.id,
        username: user.username,
        role_id: user.role_id,
        role_name: user.role_name,
      },
    });
  });

  // ── POST /api/org/:slug/invitations ────────────────────────────────────────
  // Protected — caller must be authenticated (req.user set by requireAuth).
  // req.org is set by resolveTenant middleware on the org router.
  // Body: { email, role_id }
  // checkQuota('users') enforces max_users plan limit before creating the invitation.
  router.post('/org/:slug/invitations', checkQuota('users'), async (req: Request, res: Response) => {
    const { email, role_id } = req.body as { email?: string; role_id?: number };

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, errors: ['email must be a valid email'] });
    }
    if (!role_id || typeof role_id !== 'number') {
      return res.status(400).json({ success: false, errors: ['role_id must be a number'] });
    }

    const org = req.org;
    if (!org) {
      return res.status(500).json({ success: false, error: 'Tenant not resolved' });
    }

    const invitedBy = req.user?.id;
    if (!invitedBy) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const pool = req.app.get('pool') as Pool;
    const invitationService = new InvitationService(pool);

    // Build the prefixed token once — stored in DB AND sent by email.
    // Format: "<orgSlug>:<hex32>" so the /join/:token route can decode the org.
    const rawToken = (await import('crypto')).randomBytes(32).toString('hex');
    const prefixedToken = `${org.slug}:${rawToken}`;

    const invitation = await invitationService.createInvitation(org, {
      email,
      role_id,
      invited_by: invitedBy,
      token: prefixedToken,
    });

    const emailService = new EmailService(pool);
    await emailService.sendVerificationEmail(email, prefixedToken, org.slug);

    return res.status(201).json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role_id: invitation.role_id,
        expires_at: invitation.expires_at,
      },
    });
  });

  return router;
}
