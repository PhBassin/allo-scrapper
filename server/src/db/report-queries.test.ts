import { describe, it, expect, vi } from 'vitest';
import { createScrapeReport, getLatestScrapeReport } from './report-queries.js';
import { type DB } from './client.js';

describe('Report Queries', () => {
  describe('createScrapeReport', () => {
    it('should insert a new report and return its ID', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [{ id: 123 }] }),
      } as unknown as DB;

      const reportId = await createScrapeReport(mockDb, 'manual');

      expect(reportId).toBe(123);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO scrape_reports'),
        ['manual']
      );
    });
  });

  describe('getLatestScrapeReport', () => {
    it('should return the most recent report', async () => {
      const mockReport = { id: 123, status: 'success' };
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [mockReport] }),
      } as unknown as DB;

      const result = await getLatestScrapeReport(mockDb);

      expect(result).toEqual(mockReport);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY started_at DESC LIMIT 1')
      );
    });
  });
});
