/**
 * Test helpers for mocking rate-limit middleware (`../middleware/rate-limit.js`).
 *
 * Usage:
 *   import { mockRateLimits } from '../test-utils/rate-limit.js';
 *   vi.mock('../middleware/rate-limit.js', mockRateLimits);
 */

import { vi } from 'vitest';

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
