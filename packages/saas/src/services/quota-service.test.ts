import { describe, it, expect, vi } from 'vitest';
import { QuotaService } from './quota-service.js';
import type { DB } from '../db/types.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeDb(rows: unknown[] = []): DB {
  return {
    query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }),
  };
}

const ORG_ID = 'org-uuid-1';

const CURRENT_MONTH = new Date();
CURRENT_MONTH.setDate(1);
CURRENT_MONTH.setHours(0, 0, 0, 0);

const USAGE_ROW = {
  id: 1,
  org_id: ORG_ID,
  month: CURRENT_MONTH.toISOString(),
  cinemas_count: 2,
  scrapes_count: 10,
  api_calls_count: 500,
};

// ── QuotaService ──────────────────────────────────────────────────────────────

describe('QuotaService', () => {
  describe('getOrCreateUsage', () => {
    it('queries org_usage for the current month', async () => {
      const db = makeDb([USAGE_ROW]);
      const service = new QuotaService(db);

      await service.getOrCreateUsage(ORG_ID);

      const call = (db.query as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toMatch(/org_usage/i);
      expect(call[0]).toMatch(/org_id/i);
      expect(call[1]).toContain(ORG_ID);
    });

    it('returns the existing usage row when found', async () => {
      const db = makeDb([USAGE_ROW]);
      const service = new QuotaService(db);

      const result = await service.getOrCreateUsage(ORG_ID);

      expect(result.cinemas_count).toBe(2);
      expect(result.scrapes_count).toBe(10);
    });

    it('inserts a new usage row when none exists for current month', async () => {
      const newRow = { ...USAGE_ROW, cinemas_count: 0, scrapes_count: 0 };
      const db = makeDb([]);
      // First SELECT returns empty, INSERT returns new row
      (db.query as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [newRow], rowCount: 1 });
      const service = new QuotaService(db);

      const result = await service.getOrCreateUsage(ORG_ID);

      expect(result.cinemas_count).toBe(0);
      expect(result.scrapes_count).toBe(0);
      const insertCall = (db.query as ReturnType<typeof vi.fn>).mock.calls[1];
      expect(insertCall[0]).toMatch(/INSERT INTO org_usage/i);
    });
  });

  describe('incrementUsage', () => {
    it('increments cinemas_count by 1', async () => {
      const db = makeDb([]);
      const service = new QuotaService(db);

      await service.incrementUsage(ORG_ID, 'cinemas');

      const call = (db.query as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toMatch(/cinemas_count/i);
      expect(call[0]).toMatch(/\+\s*1/);
      expect(call[1]).toContain(ORG_ID);
    });

    it('increments scrapes_count by 1', async () => {
      const db = makeDb([]);
      const service = new QuotaService(db);

      await service.incrementUsage(ORG_ID, 'scrapes');

      const call = (db.query as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toMatch(/scrapes_count/i);
      expect(call[0]).toMatch(/\+\s*1/);
    });

    it('increments users_count by 1', async () => {
      const db = makeDb([]);
      const service = new QuotaService(db);

      await service.incrementUsage(ORG_ID, 'users');

      const call = (db.query as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toMatch(/users_count/i);
      expect(call[0]).toMatch(/\+\s*1/);
    });

    it('uses UPSERT so it creates the row if missing', async () => {
      const db = makeDb([]);
      const service = new QuotaService(db);

      await service.incrementUsage(ORG_ID, 'cinemas');

      const call = (db.query as ReturnType<typeof vi.fn>).mock.calls[0];
      // Should use INSERT ... ON CONFLICT ... DO UPDATE
      expect(call[0]).toMatch(/ON CONFLICT/i);
    });
  });

  describe('decrementUsage', () => {
    it('decrements cinemas_count by 1, floored at 0', async () => {
      const db = makeDb([]);
      const service = new QuotaService(db);

      await service.decrementUsage(ORG_ID, 'cinemas');

      const call = (db.query as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toMatch(/cinemas_count/i);
      // GREATEST(0, ...) ensures floor at 0
      expect(call[0]).toMatch(/GREATEST/i);
      expect(call[1]).toContain(ORG_ID);
    });
  });

  describe('resetMonthlyUsage', () => {
    it('resets scrapes_count and api_calls_count to 0 for the given org', async () => {
      const db = makeDb([]);
      const service = new QuotaService(db);

      await service.resetMonthlyUsage(ORG_ID);

      const call = (db.query as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toMatch(/UPDATE org_usage/i);
      expect(call[0]).toMatch(/scrapes_count\s*=\s*0/i);
      expect(call[0]).toMatch(/api_calls_count\s*=\s*0/i);
      expect(call[1]).toContain(ORG_ID);
    });
  });
});
