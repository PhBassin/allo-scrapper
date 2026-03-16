import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CinemaService } from './cinema-service.js';
import * as cinemaQueries from '../db/cinema-queries.js';
import * as showtimeQueries from '../db/showtime-queries.js';
import * as reportQueries from '../db/report-queries.js';
import * as redisClient from './redis-client.js';
import { type DB } from '../db/client.js';
import { isValidAllocineUrl, extractCinemaIdFromUrl } from '../utils/url.js';

vi.mock('../db/cinema-queries.js');
vi.mock('../db/showtime-queries.js');
vi.mock('../db/report-queries.js');
vi.mock('./redis-client.js');
vi.mock('../utils/url.js', () => ({
  isValidAllocineUrl: vi.fn(() => true),
  extractCinemaIdFromUrl: vi.fn(() => 'C0013'),
  cleanCinemaUrl: vi.fn(() => 'https://cleaned-url'),
}));

describe('CinemaService', () => {
  let cinemaService: CinemaService;
  const mockDb = {} as DB;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isValidAllocineUrl).mockReturnValue(true);
    vi.mocked(extractCinemaIdFromUrl).mockReturnValue('C0013');
    cinemaService = new CinemaService(mockDb);
  });

  describe('getAllCinemas', () => {
    it('should call getCinemas query', async () => {
      vi.mocked(cinemaQueries.getCinemas).mockResolvedValue([{ id: '1', name: 'Cinema' }] as any);
      const result = await cinemaService.getAllCinemas();
      expect(result).toHaveLength(1);
      expect(cinemaQueries.getCinemas).toHaveBeenCalledWith(mockDb);
    });
  });

  describe('getCinemaShowtimes', () => {
    it('should call getShowtimesByCinemaAndWeek query', async () => {
      vi.mocked(showtimeQueries.getShowtimesByCinemaAndWeek).mockResolvedValue([] as any);
      await cinemaService.getCinemaShowtimes('C1', '2026-03-11');
      expect(showtimeQueries.getShowtimesByCinemaAndWeek).toHaveBeenCalledWith(mockDb, 'C1', '2026-03-11');
    });
  });

  describe('addCinemaViaUrl', () => {
    it('should throw if URL too long', async () => {
      await expect(cinemaService.addCinemaViaUrl('a'.repeat(2049))).rejects.toThrow('URL is too long');
    });

    it('should throw if URL invalid', async () => {
      const { isValidAllocineUrl } = await import('../utils/url.js');
      vi.mocked(isValidAllocineUrl).mockReturnValue(false);
      await expect(cinemaService.addCinemaViaUrl('http://bad')).rejects.toThrow('Invalid Allocine URL');
    });

    it('should throw if cinema ID cannot be extracted', async () => {
      const { extractCinemaIdFromUrl } = await import('../utils/url.js');
      vi.mocked(extractCinemaIdFromUrl).mockReturnValue(null);
      await expect(cinemaService.addCinemaViaUrl('http://valid')).rejects.toThrow('Could not extract cinema ID');
    });

    it('should add cinema and publish job on success', async () => {
      const mockPublish = vi.fn().mockResolvedValue(1);
      vi.mocked(redisClient.getRedisClient).mockReturnValue({ publishAddCinemaJob: mockPublish } as any);
      vi.mocked(reportQueries.createScrapeReport).mockResolvedValue(42 as any);
      vi.mocked(cinemaQueries.addCinema).mockResolvedValue({ id: 'C0013' } as any);

      const result = await cinemaService.addCinemaViaUrl('http://valid');

      expect(result.id).toBe('C0013');
      expect(mockPublish).toHaveBeenCalledWith(42, 'https://cleaned-url');
    });
  });

  describe('addCinemaManual', () => {
    it('should validate inputs and throw if invalid', async () => {
      await expect(cinemaService.addCinemaManual('id!', 'name', 'url')).rejects.toThrow('Invalid ID format');
      await expect(cinemaService.addCinemaManual('id', 'a'.repeat(101), 'url')).rejects.toThrow('Name must be');
    });

    it('should handle duplicate key error', async () => {
      vi.mocked(cinemaQueries.addCinema).mockRejectedValue(new Error('duplicate key'));
      await expect(cinemaService.addCinemaManual('C1', 'Name', 'http://valid')).rejects.toThrow('already exists');
    });

    it('should return cinema on success', async () => {
      vi.mocked(cinemaQueries.addCinema).mockResolvedValue({ id: 'C1' } as any);
      const result = await cinemaService.addCinemaManual('C1', 'Name', 'http://valid');
      expect(result.id).toBe('C1');
    });
  });

  describe('updateCinema', () => {
    it('should throw if no fields provided', async () => {
      await expect(cinemaService.updateCinema('C1', {})).rejects.toThrow('At least one field must be provided');
    });

    it('should throw if screen count invalid', async () => {
      await expect(cinemaService.updateCinema('C1', { screen_count: 0 })).rejects.toThrow('between 1 and 50');
      await expect(cinemaService.updateCinema('C1', { screen_count: 51 })).rejects.toThrow('between 1 and 50');
    });

    it('should throw if cinema not found', async () => {
      vi.mocked(cinemaQueries.updateCinemaConfig).mockResolvedValue(undefined);
      await expect(cinemaService.updateCinema('C1', { name: 'New' })).rejects.toThrow('not found');
    });

    it('should return updated cinema on success', async () => {
      vi.mocked(cinemaQueries.updateCinemaConfig).mockResolvedValue({ id: 'C1', name: 'New' } as any);
      const result = await cinemaService.updateCinema('C1', { name: 'New' });
      expect(result.name).toBe('New');
    });
  });

  describe('deleteCinema', () => {
    it('should throw if not found', async () => {
      vi.mocked(cinemaQueries.deleteCinema).mockResolvedValue(false);
      await expect(cinemaService.deleteCinema('C1')).rejects.toThrow('not found');
    });

    it('should return true on success', async () => {
      vi.mocked(cinemaQueries.deleteCinema).mockResolvedValue(true);
      const result = await cinemaService.deleteCinema('C1');
      expect(result).toBe(true);
    });
  });
});
