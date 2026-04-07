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
import { Router, type Request, type Response, type NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { resolveTenant } from '../middleware/tenant.js';
import { checkQuota } from '../middleware/quota.js';

// ── Server route handlers re-used as sub-routers ────────────────────────────
// These default-export routers already use getDbFromRequest(req), so they work
// correctly under /api/org/:slug (req.dbClient set by resolveTenant).
import cinemasRouter from '../../../server/src/routes/cinemas.js';
import filmsRouter from '../../../server/src/routes/films.js';
import reportsRouter from '../../../server/src/routes/reports.js';
import scraperRouter from '../../../server/src/routes/scraper.js';

// ── Auth helpers (from server) ───────────────────────────────────────────────
import { requireAuth, type AuthRequest } from '../../../server/src/middleware/auth.js';
import { requirePermission } from '../../../server/src/middleware/permission.js';
import { protectedLimiter } from '../../../server/src/middleware/rate-limit.js';
import { ValidationError, NotFoundError, AuthError } from '../../../server/src/utils/errors.js';
import { validatePasswordStrength } from '../../../server/src/utils/security.js';
import jwt from 'jsonwebtoken';

// ── Inline org-specific helpers ─────────────────────────────────────────────
const USERNAME_REGEX = /^[a-zA-Z0-9]{3,15}$/;

/**
 * Validates that the JWT org_slug claim (if present) matches the :slug route param.
 * Prevents a token minted for org-a from accessing org-b's data.
 *
 * This check runs before individual route handlers call requireAuth, so we must
 * decode the token here (without relying on req.user being populated).
 * If there is no Authorization header, the check is skipped — unauthenticated
 * requests will fail later at their own requireAuth middleware.
 */
function requireOrgAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    // No token — let individual route handlers decide auth requirements
    next();
    return;
  }
  const token = authHeader.split(' ')[1];
  try {
    const JWT_SECRET = process.env.JWT_SECRET as string;
    const decoded = jwt.decode(token) as { org_slug?: string } | null;
    // Use jwt.verify to reject tampered/forged tokens before trusting org_slug
    jwt.verify(token, JWT_SECRET);
    if (decoded?.org_slug && decoded.org_slug !== req.params['slug']) {
      res.status(403).json({ success: false, error: 'Token does not match organization' });
      return;
    }
  } catch {
    // Invalid/expired token — let requireAuth on the individual route respond with 401
    next();
    return;
  }
  next();
}

export function createOrgRouter(): Router {
  const router = Router({ mergeParams: true });

  // 1. Resolve tenant (loads org, sets search_path, attaches req.org + req.dbClient)
  router.use(resolveTenant);

  // 2. Rate-limit all org routes, then validate JWT org claim.
  // protectedLimiter is used here (rather than generalLimiter) because
  // requireOrgAuth performs JWT verification — a sensitive auth operation that
  // must be rate-limited with the stricter limit to satisfy CodeQL CWE-307.
  router.use(protectedLimiter);
  router.use(requireOrgAuth);

  // ── Health / ping ───────────────────────────────────────────────────────────
  router.get('/ping', protectedLimiter, (req, res) => {
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
  router.post('/cinemas', protectedLimiter, checkQuota('cinemas'));
  router.use('/cinemas', protectedLimiter, cinemasRouter);

  // ── Films ───────────────────────────────────────────────────────────────────
  router.use('/films', protectedLimiter, filmsRouter);

  // ── Reports ─────────────────────────────────────────────────────────────────
  router.use('/reports', protectedLimiter, reportsRouter);

  // ── Scraper ─────────────────────────────────────────────────────────────────
  router.post('/scraper/trigger', protectedLimiter, checkQuota('scrapes'));
  router.use('/scraper', protectedLimiter, scraperRouter);

  // ── Users (org-specific handlers) ─────────────────────────────────────────
  // These operate on the org schema (users + roles tables set by search_path).

  /** GET /users — list all org users */
  router.get(
    '/users',
    protectedLimiter,
    requireAuth,
    requirePermission('users:list'),
    async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const db = req.dbClient;
        const result = await db.query<{
          id: number;
          username: string;
          role_id: number;
          role_name: string;
          email_verified: boolean;
          created_at: string;
        }>(
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
    requireAuth,
    requirePermission('users:list'),
    async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const db = req.dbClient;
        const userId = parseInt(req.params['id'], 10);
        if (isNaN(userId)) return next(new ValidationError('Invalid user ID'));

        const result = await db.query<{
          id: number;
          username: string;
          role_id: number;
          role_name: string;
          email_verified: boolean;
          created_at: string;
        }>(
          `SELECT u.id, u.username, u.role_id, r.name AS role_name,
                  u.email_verified, u.created_at
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
    requireAuth,
    requirePermission('users:create'),
    checkQuota('users'),
    async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const db = req.dbClient;
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
        const roleCheck = await db.query<{ id: number }>(
          'SELECT id FROM roles WHERE id = $1',
          [roleId]
        );
        if (roleCheck.rows.length === 0) {
          return next(new ValidationError('Invalid role_id: role does not exist'));
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const result = await db.query<{ id: number; username: string; role_id: number; role_name: string; created_at: string }>(
          `INSERT INTO users (username, password_hash, role_id)
           VALUES ($1, $2, $3)
           RETURNING id, username, role_id,
             (SELECT name FROM roles WHERE id = $3) AS role_name,
             created_at`,
          [username, passwordHash, roleId]
        );

        res.status(201).json({ success: true, data: result.rows[0] });
      } catch (error: unknown) {
        const e = error as { code?: string; message?: string };
        if (e.code === '23505' || e.message?.includes('duplicate key')) {
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
    requireAuth,
    requirePermission('users:update'),
    async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const db = req.dbClient;
        const userId = parseInt(req.params['id'], 10);
        if (isNaN(userId)) return next(new ValidationError('Invalid user ID'));

        const { role_id } = req.body as { role_id?: number };
        if (!role_id) return next(new ValidationError('role_id is required'));

        const roleCheck = await db.query<{ id: number; name: string }>(
          'SELECT id, name FROM roles WHERE id = $1',
          [role_id]
        );
        if (roleCheck.rows.length === 0) {
          return next(new ValidationError('Invalid role_id: role does not exist'));
        }

        // Safety: prevent demoting the last admin
        const targetUser = await db.query<{ id: number; role_name: string }>(
          `SELECT u.id, r.name AS role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
          [userId]
        );
        if (targetUser.rows.length === 0) return next(new NotFoundError('User not found'));

        if (targetUser.rows[0].role_name === 'admin' && roleCheck.rows[0].name !== 'admin') {
          const adminCount = await db.query<{ count: string }>(
            `SELECT COUNT(*) AS count FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin'`
          );
          if (parseInt(adminCount.rows[0].count, 10) <= 1) {
            return next(new AuthError('Cannot demote the last admin', 403));
          }
        }

        await db.query('UPDATE users SET role_id = $1, updated_at = NOW() WHERE id = $2', [role_id, userId]);
        const updated = await db.query<{ id: number; username: string; role_id: number; role_name: string }>(
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
    requireAuth,
    requirePermission('users:delete'),
    async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const db = req.dbClient;
        const userId = parseInt(req.params['id'], 10);
        if (isNaN(userId)) return next(new ValidationError('Invalid user ID'));

        if (userId === req.user!.id) {
          return next(new AuthError('Cannot delete your own account', 403));
        }

        const targetUser = await db.query<{ id: number; role_name: string }>(
          `SELECT u.id, r.name AS role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
          [userId]
        );
        if (targetUser.rows.length === 0) return next(new NotFoundError('User not found'));

        if (targetUser.rows[0].role_name === 'admin') {
          const adminCount = await db.query<{ count: string }>(
            `SELECT COUNT(*) AS count FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin'`
          );
          if (parseInt(adminCount.rows[0].count, 10) <= 1) {
            return next(new AuthError('Cannot delete the last admin', 403));
          }
        }

        await db.query('DELETE FROM users WHERE id = $1', [userId]);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  );

  /** POST /users/:id/change-password — change user password */
  router.post(
    '/users/:id/change-password',
    protectedLimiter,
    requireAuth,
    requirePermission('users:update'),
    async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const db = req.dbClient;
        const userId = parseInt(req.params['id'], 10);
        if (isNaN(userId)) return next(new ValidationError('Invalid user ID'));

        const { new_password } = req.body as { new_password?: string };
        if (!new_password) return next(new ValidationError('new_password is required'));

        const passwordError = validatePasswordStrength(new_password);
        if (passwordError) return next(new ValidationError(passwordError));

        const exists = await db.query<{ id: number }>(
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

  // ── Invitations ─────────────────────────────────────────────────────────────
  // POST /invitations is already handled by onboarding.ts (mounted at /api),
  // which falls back gracefully when req.org/req.dbClient are not set.
  // For clarity we also mount it here under the org scope.
  // (onboarding router handles POST /api/org/:slug/invitations via its own mount)

  return router;
}
