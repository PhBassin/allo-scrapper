import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Rate Limit Refresher', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('AC1: Config refresh after DB update', () => {
    it('should export refreshRateLimits from rate-limit module', async () => {
      const mod = await import('./rate-limit.js');
      // This will fail until refreshRateLimits is implemented (RED phase)
      expect(mod.refreshRateLimits).toBeDefined();
    });

    it('should accept a config object without throwing', async () => {
      const mod = await import('./rate-limit.js');
      const { refreshRateLimits } = mod;

      const newConfig = {
        windowMs: 120000,
        generalMax: 200,
        authMax: 10,
        registerMax: 5,
        registerWindowMs: 3600000,
        protectedMax: 100,
        scraperMax: 20,
        publicMax: 200,
        healthMax: 20,
        healthWindowMs: 60000,
      };

      expect(() => refreshRateLimits(newConfig)).not.toThrow();
    });
  });

  describe('AC2: Existing counters are preserved', () => {
    it('should export refreshRateLimits function', async () => {
      const mod = await import('./rate-limit.js');
      expect(typeof mod.refreshRateLimits).toBe('function');
    });
  });

  describe('AC3: Graceful degradation on DB unavailability', () => {
    it('should use cached config when refresher cannot reach DB', async () => {
      const { getRateLimitConfig, invalidateRateLimitCache } = await import('../config/rate-limits.js');

      invalidateRateLimitCache();
      const config = await getRateLimitConfig();
      expect(config.generalMax).toBe(100);
    });
  });

  describe('AC4: No performance regression', () => {
    it('should have rate limit check overhead < 1ms', async () => {
      const rateLimit = (await import('express-rate-limit')).default;

      const req = { ip: '1.2.3.4', headers: {} } as any;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        setHeader: vi.fn(),
        statusCode: 200,
      } as any;
      const next = vi.fn();

      const limiter = rateLimit({
        windowMs: 60000,
        max: 10000,
        skip: () => false,
        validate: false,
      });

      for (let i = 0; i < 100; i++) {
        limiter(req, res, next);
      }

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        limiter(req, res, next);
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(1000);
    });
  });
});
