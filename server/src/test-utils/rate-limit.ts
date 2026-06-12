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

// ---------------------------------------------------------------------------
// Simulate rate limit triggered
// ---------------------------------------------------------------------------

/**
 * Mock that simulates a rate limit being hit.
 *
 * @param status - HTTP status code returned (default: 429).
 * @param message - Error message returned (default: 'Too Many Requests').
 */
export const mockRateLimitTrigger = (
  status: number = 429,
  message: string = 'Too Many Requests',
) => ({
  protectedLimiter: vi.fn((_req: any, res: any, _next: any) =>
    res.status(status).json({
      success: false,
      error: message,
    }),
  ),
  scraperLimiter: vi.fn((_req: any, res: any, _next: any) =>
    res.status(status).json({
      success: false,
      error: message,
    }),
  ),
});
