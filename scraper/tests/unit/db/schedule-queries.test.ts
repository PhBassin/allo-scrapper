import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DB } from '../../../src/db/client.js';
import {
  getEnabledSchedules,
  updateScheduleRunStatus,
} from '../../../src/db/schedule-queries.js';

function createMockDb(): DB {
  return {
    query: vi.fn(),
  } as unknown as DB;
}

const mockScheduleRow = {
  id: 1,
  name: 'Weekly Scrape',
  description: 'Scrape every Wednesday',
  cron_expression: '0 8 * * 3',
  enabled: true,
  target_cinemas: '["C001", "C002"]',
  created_by: 1,
  updated_by: 1,
  created_at: '2026-03-01T06:00:00Z',
  updated_at: '2026-03-01T06:00:00Z',
  last_run_at: '2026-03-04T08:00:00Z',
  last_run_status: 'success',
};

describe('Schedule Queries', () => {
  let db: DB;

  beforeEach(() => {
    db = createMockDb();
  });

  describe('getEnabledSchedules', () => {
    it('should return enabled schedules ordered by name', async () => {
      vi.mocked(db.query).mockResolvedValue({ rows: [mockScheduleRow], rowCount: 1 } as any);

      const result = await getEnabledSchedules(db);

      expect(db.query).toHaveBeenCalledWith(
        'SELECT * FROM scrape_schedules WHERE enabled = true ORDER BY name ASC'
      );
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Weekly Scrape');
      expect(result[0].target_cinemas).toEqual(['C001', 'C002']);
    });

    it('should return empty array when no schedules', async () => {
      vi.mocked(db.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await getEnabledSchedules(db);

      expect(result).toEqual([]);
    });
  });

  describe('updateScheduleRunStatus', () => {
    it('should update last run status', async () => {
      vi.mocked(db.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      await updateScheduleRunStatus(db, 1, 'success');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE scrape_schedules'),
        ['success', 1]
      );
    });

    it('should handle failed status', async () => {
      vi.mocked(db.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      await updateScheduleRunStatus(db, 1, 'failed');

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        ['failed', 1]
      );
    });
  });
});
