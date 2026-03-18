import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { DB } from './client.js';
import {
  getAllSchedules,
  getScheduleById,
  getEnabledSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  updateScheduleRunStatus,
} from './schedule-queries.js';

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

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllSchedules', () => {
    it('should return all schedules ordered by name', async () => {
      vi.mocked(db.query).mockResolvedValue({ rows: [mockScheduleRow], rowCount: 1 } as any);

      const result = await getAllSchedules(db);

      expect(db.query).toHaveBeenCalledWith(
        'SELECT * FROM scrape_schedules ORDER BY name ASC'
      );
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Weekly Scrape');
      expect(result[0].target_cinemas).toEqual(['C001', 'C002']);
    });

    it('should return empty array when no schedules exist', async () => {
      vi.mocked(db.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await getAllSchedules(db);

      expect(result).toEqual([]);
    });
  });

  describe('getScheduleById', () => {
    it('should return schedule when found', async () => {
      vi.mocked(db.query).mockResolvedValue({ rows: [mockScheduleRow], rowCount: 1 } as any);

      const result = await getScheduleById(db, 1);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Weekly Scrape');
    });

    it('should return null when not found', async () => {
      vi.mocked(db.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await getScheduleById(db, 999);

      expect(result).toBeNull();
    });
  });

  describe('getEnabledSchedules', () => {
    it('should return only enabled schedules', async () => {
      vi.mocked(db.query).mockResolvedValue({ rows: [mockScheduleRow], rowCount: 1 } as any);

      const result = await getEnabledSchedules(db);

      expect(db.query).toHaveBeenCalledWith(
        'SELECT * FROM scrape_schedules WHERE enabled = true ORDER BY name ASC'
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('createSchedule', () => {
    it('should create a new schedule', async () => {
      vi.mocked(db.query).mockResolvedValue({ 
        rows: [{ 
          ...mockScheduleRow, 
          id: 2, 
          name: 'New Schedule',
          cron_expression: '0 6 * * *',
        }], 
        rowCount: 1 
      } as any);

      const result = await createSchedule(db, {
        name: 'New Schedule',
        cron_expression: '0 6 * * *',
        description: 'Test description',
        enabled: true,
        target_cinemas: ['C001'],
      }, 1);

      expect(result.name).toBe('New Schedule');
      expect(db.query).toHaveBeenCalled();
    });

    it('should handle null target_cinemas', async () => {
      vi.mocked(db.query).mockResolvedValue({ rows: [mockScheduleRow], rowCount: 1 } as any);

      await createSchedule(db, {
        name: 'Test',
        cron_expression: '0 6 * * *',
        target_cinemas: null,
      }, 1);

      const call = vi.mocked(db.query).mock.calls[0];
      const params = call[1] as any[];
      expect(params[4]).toBeNull();
    });
  });

  describe('updateSchedule', () => {
    it('should update schedule fields', async () => {
      vi.mocked(db.query).mockResolvedValue({ rows: [{ ...mockScheduleRow, name: 'Updated Name' }], rowCount: 1 } as any);

      const result = await updateSchedule(db, 1, {
        name: 'Updated Name',
      }, 1);

      expect(result?.name).toBe('Updated Name');
    });

    it('should return existing schedule when no fields provided', async () => {
      vi.mocked(db.query).mockResolvedValue({ rows: [mockScheduleRow], rowCount: 1 } as any);

      const result = await updateSchedule(db, 1, {}, 1);

      expect(result?.name).toBe('Weekly Scrape');
    });

    it('should return null when schedule not found', async () => {
      vi.mocked(db.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await updateSchedule(db, 999, { name: 'Test' }, 1);

      expect(result).toBeNull();
    });
  });

  describe('deleteSchedule', () => {
    it('should return true when schedule was deleted', async () => {
      vi.mocked(db.query).mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 } as any);

      const result = await deleteSchedule(db, 1);

      expect(result).toBe(true);
    });

    it('should return false when schedule not found', async () => {
      vi.mocked(db.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await deleteSchedule(db, 999);

      expect(result).toBe(false);
    });
  });

  describe('updateScheduleRunStatus', () => {
    it('should update last run status', async () => {
      vi.mocked(db.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      await updateScheduleRunStatus(db, 1, 'success');

      const call = vi.mocked(db.query).mock.calls[0];
      expect(call[1]).toContain('success');
      expect(call[1]).toContain(1);
    });
  });
});
