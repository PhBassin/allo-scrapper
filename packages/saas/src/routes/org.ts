/**
 * Org-scoped routes — mounted under /api/org/:slug by plugin.ts.
 *
 * All routes go through resolveTenant (sets req.org + req.dbClient) and then
 * requireOrgAuth (validates JWT org_slug claim matches :slug).
 *
 * Core route handlers (cinemas, films, reports, scraper) are re-used directly
 * via router.use() sub-mounting. They pick up the tenant-scoped DB client
 * through getDbFromRequest(req) which returns req.dbClient when present.
 *
 * User management uses org-specific inline handlers because the org schema has
 * a different (simpler) role model: admin | editor | viewer (not the public RBAC).
 */
import { Router, type Response, type NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { resolveTenant } from '../middleware/tenant.js';
import { checkQuota } from '../middleware/quota.js';

// ── Server route handlers re-used as sub-routers ────────────────────────────
// These default-export routers already use getDbFromRequest(req), so they work
// correctly under /api/org/:slug (req.dbClient set by resolveTenant).
// @ts-ignore
import cinemasRouter from '@server/routes/cinemas.js';
// @ts-ignore
import filmsRouter from '@server/routes/films.js';
// @ts-ignore
import reportsRouter from '@server/routes/reports.js';
// @ts-ignore
import scraperRouter from '@server/routes/scraper.js';

// ── SaaS-specific route handlers ────────────────────────────────────────────
import orgSettingsRouter from './org-settings.js';
import { createOrgExportRouter } from './org-export.js';

// ── Auth helpers (from server) ───────────────────────────────────────────────
// @ts-ignore
import { optionalAuth, requireAuth } from '@server/middleware/auth.js';
// @ts-ignore
import { requirePermission } from '@server/middleware/permission.js';
// @ts-ignore
import { protectedLimiter, authLimiter } from '@server/middleware/rate-limit.js';
// @ts-ignore
import { ValidationError, NotFoundError, AuthError } from '@server/utils/errors.js';
// @ts-ignore
import { validatePasswordStrength } from '@server/utils/security.js';

// ── Inline org-specific helpers ─────────────────────────────────────────────
const USERNAME_REGEX = /^[a-zA-Z0-9]{3,15}$/;

/**
 * Validates that the JWT org_slug claim (if present) matches the :slug route param.
 * Prevents a token minted for org-a from accessing org-b's data.
 */
// @ts-ignore
const requireOrgAuth = (req: any, res: Response, next: NextFunction) => {
  const tokenSlug = req.user?.org_slug;
  const routeSlug = req.params['slug'];

  if (tokenSlug && routeSlug && tokenSlug !== routeSlug) {
    return next(new AuthError('Access denied: organization mismatch', 403));
  }

  next();
};

export function createOrgRouter(): Router {
  const router = Router({ mergeParams: true });

  // 0. Middleware to resolve tenant and attach DB client
  router.use(resolveTenant as any);

  // 1. Auth & Quota validation
  // requireAuth verifies valid session
  // authLimiter is used (matching the pattern in server/src/routes/auth.ts)
  // so CodeQL recognises this as a properly rate-limited auth handler (CWE-307).
  router.use(authLimiter, optionalAuth as any, requireOrgAuth as any);

  // ── Health / ping ───────────────────────────────────────────────────────────
  router.get('/ping', protectedLimiter, (req: any, res) => {
    if (!req.org) throw new Error('Tenant context (req.org) missing');
    res.json({
      success: true,
      org: {
        id: req.org.id,
        slug: req.org.slug,
        name: req.org.name,
        status: req.org.status,
      },
    });
  });

  // ── Cinemas ─────────────────────────────────────────────────────────────────
  router.post('/cinemas', protectedLimiter, checkQuota('cinemas') as any);
  router.use('/cinemas', protectedLimiter, cinemasRouter);

  // ── Films ───────────────────────────────────────────────────────────────────
  router.use('/films', protectedLimiter, filmsRouter);

  // ── Reports ─────────────────────────────────────────────────────────────────
  router.use('/reports', protectedLimiter, reportsRouter);

  // ── Scraper ─────────────────────────────────────────────────────────────────
  router.post('/scraper/trigger', protectedLimiter, requireAuth as any, checkQuota('scrapes') as any);
  router.use('/scraper', protectedLimiter, scraperRouter);

  // ── Org Settings ────────────────────────────────────────────────────────────
  router.use('/settings', protectedLimiter, orgSettingsRouter);

  /** GET /users — list all org users */
  router.get(
    '/users',
    protectedLimiter,
    requireAuth as any,
    requirePermission('users:list') as any,
    async (req: any, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.dbClient) throw new Error('DB client (req.dbClient) missing');
        const db = req.dbClient as any;
        const result = await db.query(
          `SELECT u.id, u.username, u.role_id, r.name AS role_name,
                  u.email_verified, u.created_at
             FROM users u
             JOIN roles r ON r.id = u.role_id
            ORDER BY u.created_at DESC`
        );
        res.json({ success: true, data: result.rows });
      } catch (error) {
        next(error);
      }
    }
  );

  /** GET /users/:id — get single org user */
  router.get(
    '/users/:id',
    protectedLimiter,
    requireAuth as any,
    requirePermission('users:list') as any,
    async (req: any, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.dbClient) throw new Error('DB client (req.dbClient) missing');
        const db = req.dbClient as any;
        const userId = parseInt(req.params['id'] as string, 10);
        if (isNaN(userId)) return next(new ValidationError('Invalid user ID'));

        const result = await db.query(
          `SELECT u.id, u.username, u.role_id, r.name AS role_name,
                  u.email_verified, u.created_at, u.updated_at
             FROM users u
             JOIN roles r ON r.id = u.role_id
            WHERE u.id = $1`,
          [userId]
        );

        if (result.rows.length === 0) return next(new NotFoundError('User not found'));
        res.json({ success: true, data: result.rows[0] });
      } catch (error) {
        next(error);
      }
    }
  );

  /** POST /users — create a new org user (quota-gated) */
  router.post(
    '/users',
    protectedLimiter,
    requireAuth as any,
    requirePermission('users:create') as any,
    checkQuota('users') as any,
    async (req: any, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.dbClient) throw new Error('DB client (req.dbClient) missing');
        const db = req.dbClient as any;
        const { username, password, role_id } = req.body as {
          username?: string;
          password?: string;
          role_id?: number;
        };

        if (!username || !password) {
          return next(new ValidationError('username and password are required'));
        }
        if (!USERNAME_REGEX.test(username)) {
          return next(new ValidationError('Username must be alphanumeric and 3-15 characters long'));
        }
        const passwordError = validatePasswordStrength(password);
        if (passwordError) return next(new ValidationError(passwordError));

        const roleId = role_id ?? 1;
        const roleCheck = await db.query(
          'SELECT id FROM roles WHERE id = $1',
          [roleId]
        );
        if (roleCheck.rows.length === 0) {
          return next(new ValidationError('Invalid role_id: role does not exist'));
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const result = await db.query(
          `INSERT INTO users (username, password_hash, role_id)
           VALUES ($1, $2, $3)
           RETURNING id, username, role_id,
             (SELECT name FROM roles WHERE id = $3) AS role_name,
             created_at`,
          [username, passwordHash, roleId]
        );

        res.status(201).json({ success: true, data: result.rows[0] });
      } catch (error: any) {
        if (error.code === '23505' || error.message?.includes('duplicate key')) {
          return next(new ValidationError('Username already exists'));
        }
        next(error);
      }
    }
  );

  /** PUT /users/:id — update user role */
  router.put(
    '/users/:id',
    protectedLimiter,
    requireAuth as any,
    requirePermission('users:update') as any,
    async (req: any, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.dbClient) throw new Error('DB client (req.dbClient) missing');
        const db = req.dbClient as any;
        const userId = parseInt(req.params['id'] as string, 10);
        if (isNaN(userId)) return next(new ValidationError('Invalid user ID'));

        const { role_id } = req.body as { role_id?: number };
        if (!role_id) return next(new ValidationError('role_id is required'));

        const roleCheck = await db.query(
          'SELECT id, name FROM roles WHERE id = $1',
          [role_id]
        );
        if (roleCheck.rows.length === 0) {
          return next(new ValidationError('Invalid role_id: role does not exist'));
        }

        // Safety: prevent demoting the last admin
        const targetUser = await db.query(
          `SELECT u.id, r.name AS role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
          [userId]
        );
        if (targetUser.rows.length === 0) return next(new NotFoundError('User not found'));

        if (targetUser.rows[0].role_name === 'admin' && roleCheck.rows[0].name !== 'admin') {
          const adminCount = await db.query(
            `SELECT COUNT(*) AS count FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin'`
          );
          if (parseInt(adminCount.rows[0].count, 10) <= 1) {
            return next(new AuthError('Cannot demote the last admin', 403));
          }
        }

        await db.query('UPDATE users SET role_id = $1, updated_at = NOW() WHERE id = $2', [role_id, userId]);
        const updated = await db.query(
          `SELECT u.id, u.username, u.role_id, r.name AS role_name
             FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
          [userId]
        );
        res.json({ success: true, data: updated.rows[0] });
      } catch (error) {
        next(error);
      }
    }
  );

  /** DELETE /users/:id — delete a user */
  router.delete(
    '/users/:id',
    protectedLimiter,
    requireAuth as any,
    requirePermission('users:delete') as any,
    async (req: any, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.dbClient) throw new Error('DB client (req.dbClient) missing');
        const db = req.dbClient as any;
        const userId = parseInt(req.params['id'] as string, 10);
        if (isNaN(userId)) return next(new ValidationError('Invalid user ID'));

        if (userId === req.user!.id) {
          return next(new AuthError('Cannot delete your own account', 403));
        }

        const targetUser = await db.query(
          `SELECT u.id, r.name AS role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
          [userId]
        );
        if (targetUser.rows.length === 0) return next(new NotFoundError('User not found'));

        if (targetUser.rows[0].role_name === 'admin') {
          const adminCount = await db.query(
            `SELECT COUNT(*) AS count FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin'`
          );
          if (parseInt(adminCount.rows[0].count, 10) <= 1) {
            return next(new AuthError('Cannot delete the last admin', 403));
          }
        }

        await db.query('DELETE FROM users WHERE id = $1', [userId]);

        res.json({ success: true, data: { message: 'User deleted successfully' } });
      } catch (error) {
        next(error);
      }
    }
  );

  /** POST /users/:id/change-password — change user password */
  router.post(
    '/users/:id/change-password',
    protectedLimiter,
    requireAuth as any,
    requirePermission('users:update') as any,
    async (req: any, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.dbClient) throw new Error('DB client (req.dbClient) missing');
        const db = req.dbClient as any;
        const userId = parseInt(req.params['id'] as string, 10);
        if (isNaN(userId)) return next(new ValidationError('Invalid user ID'));

        const { new_password } = req.body as { new_password?: string };
        if (!new_password) return next(new ValidationError('new_password is required'));

        const passwordError = validatePasswordStrength(new_password);
        if (passwordError) return next(new ValidationError(passwordError));

        const exists = await db.query(
          'SELECT id FROM users WHERE id = $1',
          [userId]
        );
        if (exists.rows.length === 0) return next(new NotFoundError('User not found'));

        const passwordHash = await bcrypt.hash(new_password, 10);
        await db.query(
          'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
          [passwordHash, userId]
        );

        res.json({ success: true, data: { message: 'Password updated successfully' } });
      } catch (error) {
        next(error);
      }
    }
  );

  // ── Org Data Export ─────────────────────────────────────────────────────────
  // GET /export - Complete JSON export of organization data
  router.use(requireAuth as any, createOrgExportRouter());

  return router;
}
