/**
 * Test helpers for mocking the auth middleware (`../middleware/auth.js`).
 *
 * These helpers return `vi.mock()` factory functions so the mock is
 * configured declaratively and reused across test files.
 *
 * Usage (inside a test file, at module level):
 *   import { mockAuthPassthrough } from '../test-utils/auth.js';
 *   vi.mock('../middleware/auth.js', mockAuthPassthrough);
 *
 * Or for JWT-aware tests:
 *   import { mockAuthJwt } from '../test-utils/auth.js';
 *   const TEST_SECRET = 'test-jwt-secret-...';
 *   vi.mock('../middleware/auth.js', () => mockAuthJwt(TEST_SECRET));
 */

import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MockUser {
  id: number;
  username: string;
}

// ---------------------------------------------------------------------------
// Auth mock — simple passthrough (accept everything)
// ---------------------------------------------------------------------------

/** Mock that lets every request through — `requireAuth` calls `next()` unconditionally. */
export const mockAuthPassthrough = () => ({
  requireAuth: vi.fn((_req: any, _res: any, next: any) => next()),
});

// ---------------------------------------------------------------------------
// Auth mock — token-based (for JWT flows)
// ---------------------------------------------------------------------------

/**
 * Mock that verifies a Bearer token or access_token cookie against
 * `TEST_JWT_SECRET` and sets `req.user` from the decoded payload.
 *
 * Unauthenticated requests get a 401 JSON response.
 */
export const mockAuthJwt = (testSecret: string) => ({
  requireAuth: vi.fn((req: any, res: any, next: any) => {
    const authHeader = req.headers?.authorization as string | undefined;
    const cookieToken = req.cookies?.access_token as string | undefined;
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : null;
    const token = cookieToken || bearerToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. No token provided.',
      });
    }

    try {
      // Dynamic import avoids hoisting issues — the test file passes
      // its own jwt instance (or we use the same one).
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, testSecret, {
        algorithms: ['HS256'],
      }) as MockUser;
      req.user = decoded;
      next();
    } catch {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token.',
      });
    }
  }),
  AuthRequest: {} as any,
});

// ---------------------------------------------------------------------------
// Auth mock — simple token-based (fixed users, no JWT)
// ---------------------------------------------------------------------------

/**
 * Mock that maps `Authorization: Bearer <token>` to a user.
 * Accepts a map of `{ token: user }`. Unknown tokens get 401.
 */
export const mockAuthTokenMap = (
  users: Record<string, MockUser>,
  orUndefined = false,
) => ({
  requireAuth: (req: any, res: any, next: any) => {
    const authHeader = req.headers?.authorization as string | undefined;
    const bearer = authHeader?.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : undefined;

    if (!bearer) {
      if (orUndefined) {
        next();
        return;
      }
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const user = users[bearer];
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    req.user = { ...user };
    next();
  },
});

// ---------------------------------------------------------------------------
// Auth mock — conditional (like users.test.ts)
// ---------------------------------------------------------------------------

/**
 * Mock that maps specific `Authorization: Bearer <token>` values to users.
 *
 * Usage:
 *   mockAuthConditional([
 *     { token: 'Bearer valid-admin-token', user: { id: 1, username: 'admin' } },
 *     { token: 'Bearer valid-user-token',  user: { id: 2, username: 'user1' } },
 *   ])
 */
export const mockAuthConditional = (
  entries: { token: string; user: MockUser }[],
) => ({
  requireAuth: (req: any, res: any, next: any) => {
    const authHeader = req.headers?.authorization as string | undefined;
    const match = entries.find((e) => authHeader === e.token);
    if (match) {
      req.user = { ...match.user };
      next();
    } else {
      res.status(401).json({ success: false, error: 'Unauthorized' });
    }
  },
});

// ---------------------------------------------------------------------------
// Auth mock — reject all
// ---------------------------------------------------------------------------

/** Mock that rejects every request with a configurable status + message. */
export const mockRejectAuth = (
  status = 401,
  error = 'Authentication required.',
) => ({
  requireAuth: vi.fn((_req: any, res: any, _next: any) => {
    return res.status(status).json({ success: false, error });
  }),
});
