import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DB } from './client.js';
import {
  createScrapeAttempt,
  updateScrapeAttempt,
  getPendingScrapeAttempts,
  getScrapeAttemptsByReport,
  getScrapeAttempt,
  hasSuccessfulAttempt,
  type ScrapeAttempt,
} from './scrape-attempt-queries.js';

describe('Scrape Attempt Queries', () => {
  let mockDb: DB;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    } as unknown as DB;
  });

  describe('createScrapeAttempt', () => {
    it('should create a new scrape attempt with default pending status', async () => {
      (mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ id: 42 }],
      });

      const id = await createScrapeAttempt(mockDb, {
        report_id: 1,
        cinema_id: 'C0001',
        date: '2026-03-25',
      });

      expect(id).toBe(42);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO scrape_attempts'),
        [1, 'C0001', '2026-03-25', 'pending']
      );
    });

    it('should create a scrape attempt with custom status', async () => {
      (mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ id: 43 }],
      });

      const id = await createScrapeAttempt(mockDb, {
        report_id: 1,
        cinema_id: 'C0002',
        date: '2026-03-26',
        status: 'success',
      });

      expect(id).toBe(43);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO scrape_attempts'),
        [1, 'C0002', '2026-03-26', 'success']
      );
    });

    it('should use ON CONFLICT to update existing attempts', async () => {
      (mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ id: 44 }],
      });

      await createScrapeAttempt(mockDb, {
        report_id: 1,
        cinema_id: 'C0001',
        date: '2026-03-25',
        status: 'failed',
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        expect.anything()
      );
    });
  });

  describe('updateScrapeAttempt', () => {
    it('should update attempt status', async () => {
      (mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });

      await updateScrapeAttempt(mockDb, 42, { status: 'success' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE scrape_attempts'),
        ['success', 42]
      );
    });

    it('should update multiple fields', async () => {
      (mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });

      await updateScrapeAttempt(mockDb, 42, {
        status: 'success',
        films_scraped: 5,
        showtimes_scraped: 25,
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE scrape_attempts'),
        ['success', 5, 25, 42]
      );
    });

    it('should update error details', async () => {
      (mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });

      await updateScrapeAttempt(mockDb, 42, {
        status: 'rate_limited',
        error_type: 'http_429',
        error_message: 'Rate limit exceeded',
        http_status_code: 429,
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE scrape_attempts'),
        ['rate_limited', 'http_429', 'Rate limit exceeded', 429, 42]
      );
    });

    it('should do nothing if no fields provided', async () => {
      await updateScrapeAttempt(mockDb, 42, {});

      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  describe('getPendingScrapeAttempts', () => {
    it('should return failed, rate_limited, and not_attempted attempts', async () => {
      const mockAttempts: ScrapeAttempt[] = [
        {
          id: 1,
          report_id: 1,
          cinema_id: 'C0001',
          date: '2026-03-25',
          status: 'failed',
          error_type: 'network',
          error_message: 'Timeout',
          http_status_code: null,
          films_scraped: 0,
          showtimes_scraped: 0,
          attempted_at: '2026-03-24T10:00:00Z',
        },
        {
          id: 2,
          report_id: 1,
          cinema_id: 'C0002',
          date: '2026-03-25',
          status: 'rate_limited',
          error_type: 'http_429',
          error_message: 'Too many requests',
          http_status_code: 429,
          films_scraped: 0,
          showtimes_scraped: 0,
          attempted_at: '2026-03-24T10:05:00Z',
        },
        {
          id: 3,
          report_id: 1,
          cinema_id: 'C0003',
          date: '2026-03-25',
          status: 'not_attempted',
          error_type: null,
          error_message: null,
          http_status_code: null,
          films_scraped: 0,
          showtimes_scraped: 0,
          attempted_at: '2026-03-24T10:05:00Z',
        },
      ];

      (mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: mockAttempts,
      });

      const result = await getPendingScrapeAttempts(mockDb, 1);

      expect(result).toEqual(mockAttempts);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("status IN ('failed', 'rate_limited', 'not_attempted')"),
        [1]
      );
    });

    it('should return empty array if no pending attempts', async () => {
      (mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [],
      });

      const result = await getPendingScrapeAttempts(mockDb, 1);

      expect(result).toEqual([]);
    });
  });

  describe('getScrapeAttemptsByReport', () => {
    it('should return all attempts for a report', async () => {
      const mockAttempts: ScrapeAttempt[] = [
        {
          id: 1,
          report_id: 1,
          cinema_id: 'C0001',
          date: '2026-03-25',
          status: 'success',
          error_type: null,
          error_message: null,
          http_status_code: null,
          films_scraped: 5,
          showtimes_scraped: 25,
          attempted_at: '2026-03-24T10:00:00Z',
        },
        {
          id: 2,
          report_id: 1,
          cinema_id: 'C0001',
          date: '2026-03-26',
          status: 'failed',
          error_type: 'network',
          error_message: 'Connection timeout',
          http_status_code: null,
          films_scraped: 0,
          showtimes_scraped: 0,
          attempted_at: '2026-03-24T10:05:00Z',
        },
      ];

      (mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: mockAttempts,
      });

      const result = await getScrapeAttemptsByReport(mockDb, 1);

      expect(result).toEqual(mockAttempts);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM scrape_attempts'),
        [1]
      );
    });
  });

  describe('getScrapeAttempt', () => {
    it('should return specific attempt by report, cinema, and date', async () => {
      const mockAttempt: ScrapeAttempt = {
        id: 1,
        report_id: 1,
        cinema_id: 'C0001',
        date: '2026-03-25',
        status: 'success',
        error_type: null,
        error_message: null,
        http_status_code: null,
        films_scraped: 5,
        showtimes_scraped: 25,
        attempted_at: '2026-03-24T10:00:00Z',
      };

      (mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [mockAttempt],
      });

      const result = await getScrapeAttempt(mockDb, 1, 'C0001', '2026-03-25');

      expect(result).toEqual(mockAttempt);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE report_id = $1 AND cinema_id = $2 AND date = $3'),
        [1, 'C0001', '2026-03-25']
      );
    });

    it('should return null if attempt not found', async () => {
      (mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [],
      });

      const result = await getScrapeAttempt(mockDb, 1, 'C0001', '2026-03-25');

      expect(result).toBeNull();
    });
  });

  describe('hasSuccessfulAttempt', () => {
    it('should return true if successful attempt exists', async () => {
      (mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ exists: true }],
      });

      const result = await hasSuccessfulAttempt(mockDb, 'C0001', '2026-03-25');

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'success'"),
        ['C0001', '2026-03-25']
      );
    });

    it('should return false if no successful attempt exists', async () => {
      (mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ exists: false }],
      });

      const result = await hasSuccessfulAttempt(mockDb, 'C0001', '2026-03-25');

      expect(result).toBe(false);
    });
  });
});
