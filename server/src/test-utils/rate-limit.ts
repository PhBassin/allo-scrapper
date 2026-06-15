/**
 * Test helpers for mocking rate-limit middleware (`../middleware/rate-limit.js`).
 *
 * Usage:
 *   import { mockRateLimits } from '../test-utils/rate-limit.js';
 *   vi.mock('../middleware/rate-limit.js', mockRateLimits);
 */

import { vi, expect } from 'vitest';
import type { Express } from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Bypass all rate limiters
// ---------------------------------------------------------------------------

/**
 * Mock that bypasses every rate limiter exported by the rate-limit module.
 * All `protectedLimiter`, `scraperLimiter`, etc. are no-ops that call `next()`.
 */
export const mockRateLimits = () => ({
  protectedLimiter: vi.fn((_req: any, _res: any, next: any) => next()),
  scraperLimiter: vi.fn((_req: any, _res: any, next: any) => next()),
});

// ---------------------------------------------------------------------------
// Rate-limit PUT validation helper
// ---------------------------------------------------------------------------

/**
 * Helper for rate-limit PUT validation tests.
 * Sends a PUT to /api/admin/rate-limits and asserts
 * it's rejected with a 400 and the expected error substring.
 * The caller is responsible for setting up vi.mock on
 * getValidationConstraints before calling.
 */
export async function assertRateLimitPutRejected(
  app: Express,
  payload: Record<string, unknown>,
  expectedError: string,
) {
  const response = await request(app)
    .put('/api/admin/rate-limits')
    .set('Authorization', 'Bearer valid-token')
    .send(payload)
    .expect(400);

  expect(response.body.success).toBe(false);
  expect(response.body.error).toContain(expectedError);
}
