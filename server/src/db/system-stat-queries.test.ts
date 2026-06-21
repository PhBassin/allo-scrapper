import { describe, it, expect, vi } from 'vitest';
import { getActiveScrapeJobsCount } from './system-stat-queries.js';
import { type DB } from './index.js';

describe('System Stat Queries', () => {
  describe('getActiveScrapeJobsCount', () => {
    it('should return active scrape job count from pg_stat_activity', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({
          rows: [{ count: '3' }],
        }),
      } as unknown as DB;

      const result = await getActiveScrapeJobsCount(mockDb);

      expect(result).toBe(3);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("state = 'active'"),
        []
      );
    });

    it('should return 0 when no active scrape jobs', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({
          rows: [{ count: '0' }],
        }),
      } as unknown as DB;

      const result = await getActiveScrapeJobsCount(mockDb);

      expect(result).toBe(0);
    });

    it('should return 0 when count row is missing', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      } as unknown as DB;

      const result = await getActiveScrapeJobsCount(mockDb);

      expect(result).toBe(0);
    });
  });
});
