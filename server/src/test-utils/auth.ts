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
 *   const TEST_SECRET='test-j...-...';
 *   vi.mock('../middleware/auth.js', () => mockAuthJwt(TEST_SECRET));
 */

import { vi, expect } from 'vitest';
import type { Express } from 'express';
import request from 'supertest';

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
 * Mock that maps `Authorization: Bearer ***` to a user.
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
// Change-password validation helper
// ---------------------------------------------------------------------------

/**
 * Helper for change-password validation tests.
 * Asserts that changing password to `newPassword` is rejected
 * with a 400 and the expected error substring.
 * The caller is responsible for setting up the mock user via createMockUser.
 */
export async function assertChangePasswordRejected(
  app: Express,
  token: string,
  newPassword: string,
  expectedError: string,
) {
  const response = await request(app)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${token}`)
    .send({ currentPassword: 'OldPass123!', newPassword });

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
  expect(response.body.error).toContain(expectedError);
}
