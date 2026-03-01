import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DB } from '../db/client.js';
import {
  getAppInfo,
  getServerHealth,
  getScraperStatus,
  type AppInfo,
  type ServerHealth,
  type ScraperStatus,
} from './system-info.js';

describe('System Info Service', () => {
  describe('getAppInfo', () => {
    it('should return application metadata', () => {
      const info = getAppInfo();

      expect(info).toHaveProperty('version');
      expect(info).toHaveProperty('buildDate');
      expect(info).toHaveProperty('environment');
      expect(info).toHaveProperty('nodeVersion');
      
      expect(typeof info.version).toBe('string');
      expect(typeof info.environment).toBe('string');
      expect(typeof info.nodeVersion).toBe('string');
    });

    it('should return correct Node.js version', () => {
      const info = getAppInfo();

      expect(info.nodeVersion).toBe(process.version);
    });

    it('should return environment from NODE_ENV', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const info = getAppInfo();
      expect(info.environment).toBe('production');

      process.env.NODE_ENV = originalEnv;
    });

    it('should default to "development" when NODE_ENV not set', () => {
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;

      const info = getAppInfo();
      expect(info.environment).toBe('development');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('getServerHealth', () => {
    it('should return server health metrics', () => {
      const health = getServerHealth();

      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('memoryUsage');
      expect(health).toHaveProperty('platform');
      expect(health).toHaveProperty('arch');

      expect(typeof health.uptime).toBe('number');
      expect(health.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should include memory usage with formatted strings', () => {
      const health = getServerHealth();

      expect(health.memoryUsage).toHaveProperty('heapUsed');
      expect(health.memoryUsage).toHaveProperty('heapTotal');
      expect(health.memoryUsage).toHaveProperty('rss');

      // Memory values should be formatted with MB suffix
      expect(health.memoryUsage.heapUsed).toMatch(/^\d+(\.\d+)? MB$/);
      expect(health.memoryUsage.heapTotal).toMatch(/^\d+(\.\d+)? MB$/);
      expect(health.memoryUsage.rss).toMatch(/^\d+(\.\d+)? MB$/);
    });

    it('should return correct platform and architecture', () => {
      const health = getServerHealth();

      expect(health.platform).toBe(process.platform);
      expect(health.arch).toBe(process.arch);
    });

    it('should format memory correctly (bytes to MB)', () => {
      const health = getServerHealth();

      // Extract numeric value from "XX.XX MB" format
      const heapUsedMB = parseFloat(health.memoryUsage.heapUsed);
      expect(heapUsedMB).toBeGreaterThan(0);
      expect(heapUsedMB).toBeLessThan(10000); // Sanity check: < 10GB
    });
  });

  describe('getScraperStatus', () => {
    it('should return scraper status from database', async () => {
      const mockDb: DB = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // Active jobs
          .mockResolvedValueOnce({ rows: [{ last_scrape: new Date('2026-03-01T12:00:00Z') }] }) // Last scrape
          .mockResolvedValueOnce({ rows: [{ count: '10' }] }), // Total cinemas
      } as unknown as DB;

      const status = await getScraperStatus(mockDb);

      expect(status).toEqual({
        activeJobs: 0,
        lastScrapeTime: new Date('2026-03-01T12:00:00Z'),
        totalCinemas: 10,
      });
    });

    it('should handle zero active jobs', async () => {
      const mockDb: DB = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [{ count: '0' }] })
          .mockResolvedValueOnce({ rows: [{ last_scrape: new Date() }] })
          .mockResolvedValueOnce({ rows: [{ count: '5' }] }),
      } as unknown as DB;

      const status = await getScraperStatus(mockDb);

      expect(status.activeJobs).toBe(0);
    });

    it('should handle null last scrape time (never scraped)', async () => {
      const mockDb: DB = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [{ count: '0' }] })
          .mockResolvedValueOnce({ rows: [{ last_scrape: null }] })
          .mockResolvedValueOnce({ rows: [{ count: '3' }] }),
      } as unknown as DB;

      const status = await getScraperStatus(mockDb);

      expect(status.lastScrapeTime).toBeNull();
    });

    it('should handle empty database (no cinemas)', async () => {
      const mockDb: DB = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [{ count: '0' }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] }),
      } as unknown as DB;

      const status = await getScraperStatus(mockDb);

      expect(status.activeJobs).toBe(0);
      expect(status.lastScrapeTime).toBeNull();
      expect(status.totalCinemas).toBe(0);
    });

    it('should handle database query errors', async () => {
      const mockDb: DB = {
        query: vi.fn().mockRejectedValue(new Error('Connection lost')),
      } as unknown as DB;

      await expect(getScraperStatus(mockDb)).rejects.toThrow('Connection lost');
    });
  });

  describe('Memory Formatting', () => {
    it('should format bytes to MB with 2 decimal places', () => {
      const health = getServerHealth();

      // Check that all memory values have at most 2 decimal places
      const heapUsed = health.memoryUsage.heapUsed.replace(' MB', '');
      const decimalPlaces = heapUsed.split('.')[1]?.length || 0;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });
  });
});
