import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getRateLimitConfig, invalidateRateLimitCache, getDefaultConfig } from './rate-limits.js';
import type { DB } from '../db/client.js';

describe('rate-limits config', () => {
  beforeEach(() => {
    // Clear cache before each test
    invalidateRateLimitCache();
    // Clear all rate limit environment variables
    delete process.env.RATE_LIMIT_WINDOW_MS;
    delete process.env.RATE_LIMIT_GENERAL_MAX;
    delete process.env.RATE_LIMIT_AUTH_MAX;
    delete process.env.RATE_LIMIT_REGISTER_MAX;
    delete process.env.RATE_LIMIT_REGISTER_WINDOW_MS;
    delete process.env.RATE_LIMIT_PROTECTED_MAX;
    delete process.env.RATE_LIMIT_SCRAPER_MAX;
    delete process.env.RATE_LIMIT_PUBLIC_MAX;
    delete process.env.RATE_LIMIT_HEALTH_MAX;
    delete process.env.RATE_LIMIT_HEALTH_WINDOW_MS;
  });

  describe('getRateLimitConfig', () => {
    it('should return default config when no DB or env vars', async () => {
      const config = await getRateLimitConfig();
      
      expect(config).toEqual({
        windowMs: 15 * 60 * 1000,
        generalMax: 100,
        authMax: 5,
        registerMax: 3,
        registerWindowMs: 60 * 60 * 1000,
        protectedMax: 60,
        scraperMax: 10,
        publicMax: 100,
        healthMax: 10,
        healthWindowMs: 60 * 1000,
      });
    });

    it('should use environment variables as fallback', async () => {
      process.env.RATE_LIMIT_GENERAL_MAX = '200';
      process.env.RATE_LIMIT_AUTH_MAX = '10';
      
      const config = await getRateLimitConfig();
      
      expect(config.generalMax).toBe(200);
      expect(config.authMax).toBe(10);
      expect(config.scraperMax).toBe(10); // Still default
    });

    it('should prioritize database config over env vars', async () => {
      process.env.RATE_LIMIT_GENERAL_MAX = '200';
      
      const mockDb: DB = {
        query: vi.fn().mockResolvedValue({
          rows: [{
            window_ms: 900000,
            general_max: 300, // Different from env var
            auth_max: 5,
            register_max: 3,
            register_window_ms: 3600000,
            protected_max: 60,
            scraper_max: 10,
            public_max: 100,
            health_max: 10,
            health_window_ms: 60000,
          }]
        }),
        end: vi.fn(),
      };
      
      const config = await getRateLimitConfig(mockDb);
      
      expect(config.generalMax).toBe(300); // From DB, not env
      expect(mockDb.query).toHaveBeenCalledWith('SELECT * FROM rate_limit_configs WHERE id = 1');
    });

    it('should cache config for 30 seconds', async () => {
      const mockDb: DB = {
        query: vi.fn().mockResolvedValue({
          rows: [{
            window_ms: 900000,
            general_max: 100,
            auth_max: 5,
            register_max: 3,
            register_window_ms: 3600000,
            protected_max: 60,
            scraper_max: 10,
            public_max: 100,
            health_max: 10,
            health_window_ms: 60000,
          }]
        }),
        end: vi.fn(),
      };
      
      // First call
      await getRateLimitConfig(mockDb);
      expect(mockDb.query).toHaveBeenCalledTimes(1);
      
      // Second call (within cache TTL)
      await getRateLimitConfig(mockDb);
      expect(mockDb.query).toHaveBeenCalledTimes(1); // Still 1, used cache
    });

    it('should fallback to env vars if database query fails', async () => {
      process.env.RATE_LIMIT_GENERAL_MAX = '250';
      
      const mockDb: DB = {
        query: vi.fn().mockRejectedValue(new Error('DB connection failed')),
        end: vi.fn(),
      };
      
      const config = await getRateLimitConfig(mockDb);
      
      expect(config.generalMax).toBe(250); // From env vars
      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should handle empty database result', async () => {
      const mockDb: DB = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        end: vi.fn(),
      };
      
      const config = await getRateLimitConfig(mockDb);
      
      // Should fallback to defaults
      expect(config.generalMax).toBe(100);
    });
  });

  describe('invalidateRateLimitCache', () => {
    it('should force reload on next getRateLimitConfig call', async () => {
      const mockDb: DB = {
        query: vi.fn().mockResolvedValue({
          rows: [{
            window_ms: 900000,
            general_max: 100,
            auth_max: 5,
            register_max: 3,
            register_window_ms: 3600000,
            protected_max: 60,
            scraper_max: 10,
            public_max: 100,
            health_max: 10,
            health_window_ms: 60000,
          }]
        }),
        end: vi.fn(),
      };
      
      // First call (loads from DB)
      await getRateLimitConfig(mockDb);
      expect(mockDb.query).toHaveBeenCalledTimes(1);
      
      // Second call (uses cache)
      await getRateLimitConfig(mockDb);
      expect(mockDb.query).toHaveBeenCalledTimes(1);
      
      // Invalidate cache
      invalidateRateLimitCache();
      
      // Third call (reloads from DB)
      await getRateLimitConfig(mockDb);
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('getDefaultConfig', () => {
    it('should return default configuration', () => {
      const config = getDefaultConfig();
      
      expect(config).toEqual({
        windowMs: 15 * 60 * 1000,
        generalMax: 100,
        authMax: 5,
        registerMax: 3,
        registerWindowMs: 60 * 60 * 1000,
        protectedMax: 60,
        scraperMax: 10,
        publicMax: 100,
        healthMax: 10,
        healthWindowMs: 60 * 1000,
      });
    });

    it('should return a copy, not reference to internal default', () => {
      const config1 = getDefaultConfig();
      const config2 = getDefaultConfig();
      
      config1.generalMax = 999;
      
      expect(config2.generalMax).toBe(100); // Not affected
    });
  });
});
