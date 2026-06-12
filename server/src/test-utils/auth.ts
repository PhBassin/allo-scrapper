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
  requireAuth: vi.fn(function requireAuth(_req: any, _res: any, next: any) { next(); }),
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


