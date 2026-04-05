/**
 * Onboarding routes.
 *
 * GET  /api/auth/verify-email/:token   — verify a user's email address
 * POST /api/auth/join/:token           — accept a member invitation (set password → JWT)
 * POST /api/org/:slug/invitations      — create a member invitation (authenticated)
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { getOrgBySlug } from '../db/org-queries.js';
import type { DB, Pool } from '../db/types.js';
import { EmailService } from '../services/email-service.js';
import { InvitationService } from '../services/invitation-service.js';
import { SaasAuthService } from '../services/saas-auth-service.js';

export function createOnboardingRouter(): Router {
  const router = Router();

  /**
   * GET /api/auth/verify-email/:token
   *
   * Token format: `orgSlug:hex64`
   * Resolves the org from the slug prefix, then verifies the token.
   */
  router.get('/auth/verify-email/:token', async (req: Request, res: Response) => {
    try {
      const { token } = req.params as { token: string };

      // Validate token prefix
      const colonIdx = token.indexOf(':');
      if (colonIdx < 1) {
        res.status(400).json({ success: false, error: 'INVALID_TOKEN_FORMAT' });
        return;
      }

      const orgSlug = token.slice(0, colonIdx);
      const db = req.app.get('db') as DB;

      const org = await getOrgBySlug(db, orgSlug);
      if (!org) {
        res.status(400).json({ success: false, error: 'INVALID_OR_EXPIRED_TOKEN' });
        return;
      }

      const emailSvc = new EmailService(db);
      const userId = await emailSvc.verifyEmailToken(org, token);

      if (!userId) {
        res.status(400).json({ success: false, error: 'INVALID_OR_EXPIRED_TOKEN' });
        return;
      }

      await emailSvc.markEmailVerified(org, userId);
      res.status(200).json({ success: true });
    } catch (err) {
      console.error('[onboarding] verify-email error:', err);
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR' });
    }
  });

  /**
   * POST /api/auth/join/:token
   *
   * Accept a member invitation. Requires { password } in the body.
   * Returns a JWT on success.
   *
   * Token format: `orgSlug:hex64`
   */
  router.post('/auth/join/:token', async (req: Request, res: Response) => {
    try {
      const { token } = req.params as { token: string };
      const { password } = req.body as { password?: string };

      if (!password) {
        res.status(400).json({ success: false, error: 'PASSWORD_REQUIRED' });
        return;
      }

      const colonIdx = token.indexOf(':');
      if (colonIdx < 1) {
        res.status(400).json({ success: false, error: 'INVALID_TOKEN_FORMAT' });
        return;
      }

      const orgSlug = token.slice(0, colonIdx);
      const db = req.app.get('db') as DB;
      const pool = req.app.get('pool') as Pool;

      const org = await getOrgBySlug(db, orgSlug);
      if (!org) {
        res.status(400).json({ success: false, error: 'INVALID_OR_EXPIRED_TOKEN' });
        return;
      }

      const invitationSvc = new InvitationService(db);
      const invitation = await invitationSvc.getInvitationByToken(org, token);
      if (!invitation) {
        res.status(400).json({ success: false, error: 'INVALID_OR_EXPIRED_TOKEN' });
        return;
      }

      // Hash password using bcrypt
      const bcrypt = await import('bcryptjs');
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const user = await invitationSvc.acceptInvitation(org, invitation, passwordHash);

      const authSvc = new SaasAuthService(pool);
      const jwtToken = authSvc.mintJwt({
        userId: user.id,
        username: user.username,
        orgId: org.id,
        orgSlug: org.slug,
        roleId: user.role_id,
        roleName: user.role_name ?? 'member',
        permissions: [],
      });

      res.status(201).json({ success: true, token: jwtToken });
    } catch (err) {
      console.error('[onboarding] join error:', err);
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR' });
    }
  });

  /**
   * POST /api/org/:slug/invitations
   *
   * Create a member invitation. Requires authentication.
   * Body: { email: string, role_id?: number }
   */
  router.post('/org/:slug/invitations', async (req: Request, res: Response) => {
    try {
      const { slug } = req.params as { slug: string };
      const { email, role_id } = req.body as { email?: string; role_id?: number };

      if (!email) {
        res.status(400).json({ success: false, error: 'EMAIL_REQUIRED' });
        return;
      }

      // req.org is set by resolveTenant if the route is nested under org middleware,
      // otherwise fall back to loading org by slug
      const org = (req as any).org ?? await (async () => {
        const db = req.app.get('db') as DB;
        return getOrgBySlug(db, slug);
      })();

      if (!org) {
        res.status(404).json({ success: false, error: 'ORGANIZATION_NOT_FOUND' });
        return;
      }

      // Use req.dbClient if available (from tenant middleware), otherwise use app db
      const db: DB = (req as any).dbClient ?? (req.app.get('db') as DB);

      const invitationSvc = new InvitationService(db);
      const createdBy = (req as any).user?.id as number | undefined;

      const invitation = await invitationSvc.createInvitation(org, {
        email,
        role_id: role_id ?? 1,
        created_by: createdBy,
      });

      res.status(201).json({ success: true, token: invitation.token, invitation });
    } catch (err) {
      console.error('[onboarding] create-invitation error:', err);
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR' });
    }
  });

  return router;
}
