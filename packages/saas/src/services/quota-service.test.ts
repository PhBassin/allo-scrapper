import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QuotaService } from './quota-service.js';
import type { DB } from '../db/types.js';

describe('QuotaService', () => {
  let mockDb: DB;
  let service: QuotaService;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    } as unknown as DB;
    service = new QuotaService(mockDb);
  });

  describe('getOrCreateUsage', () => {
    it('returns existing usage row if present', async () => {
      const existingRow = {
        id: 1,
        org_id: 42,
        month: '2026-04-01',
        cinemas_count: 2,
        users_count: 5,
        scrapes_count: 10,
        api_calls_count: 100,
      };

      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [existingRow],
        rowCount: 1,
      });

      const result = await service.getOrCreateUsage(42);

      expect(result).toEqual(existingRow);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM org_usage WHERE org_id = $1 AND month = $2'),
        expect.arrayContaining([42, expect.stringMatching(/^\d{4}-\d{2}-01$/)])
      );
    });

    it('creates new usage row if absent', async () => {
      const newRow = {
        id: 2,
        org_id: 42,
        month: '2026-04-01',
        cinemas_count: 0,
        users_count: 0,
        scrapes_count: 0,
        api_calls_count: 0,
      };

      // First query returns empty (row doesn't exist)
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      // Second query returns inserted row
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [newRow],
        rowCount: 1,
      });

      const result = await service.getOrCreateUsage(42);

      expect(result).toEqual(newRow);
      expect(mockDb.query).toHaveBeenCalledTimes(2);
      expect(mockDb.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO org_usage (org_id, month)'),
        expect.arrayContaining([42, expect.stringMatching(/^\d{4}-\d{2}-01$/)])
      );
    });
  });

  describe('incrementUsage', () => {
    it('atomically increments cinemas_count using UPSERT', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      });

      await service.incrementUsage(42, 'cinemas');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO org_usage (org_id, month, cinemas_count)'),
        expect.arrayContaining([42, expect.stringMatching(/^\d{4}-\d{2}-01$/)])
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (org_id, month) DO UPDATE'),
        expect.anything()
      );
    });

    it('atomically increments users_count using UPSERT', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      });

      await service.incrementUsage(42, 'users');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('users_count'),
        expect.anything()
      );
    });

    it('atomically increments scrapes_count using UPSERT', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      });

      await service.incrementUsage(42, 'scrapes');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('scrapes_count'),
        expect.anything()
      );
    });
  });

  describe('decrementUsage', () => {
    it('atomically decrements counter with GREATEST(0, count - 1)', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      });

      await service.decrementUsage(42, 'cinemas');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE org_usage'),
        expect.arrayContaining([42, expect.stringMatching(/^\d{4}-\d{2}-01$/)])
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('GREATEST(0,'),
        expect.anything()
      );
    });
  });

  describe('resetMonthlyUsage', () => {
    it('resets scrapes_count and api_calls_count to 0', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      });

      await service.resetMonthlyUsage(42);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE org_usage'),
        expect.arrayContaining([42, expect.stringMatching(/^\d{4}-\d{2}-01$/)])
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('scrapes_count   = 0'),
        expect.anything()
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('api_calls_count = 0'),
        expect.anything()
      );
    });
  });
});
