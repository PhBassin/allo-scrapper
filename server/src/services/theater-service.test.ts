import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TheaterService } from './theater-service.js';
import * as theaterQueries from '../db/theater-queries.js';
import * as showtimeQueries from '../db/showtime-queries.js';
import * as reportQueries from '../db/report-queries.js';
import * as redisClient from './redis-client.js';
import { type DB } from '../db/client.js';
import { isValidAllocineUrl, extractTheaterIdFromUrl } from '../utils/url.js';

vi.mock('../db/theater-queries.js');
vi.mock('../db/showtime-queries.js');
vi.mock('../db/report-queries.js');
vi.mock('./redis-client.js');
vi.mock('../utils/url.js', () => ({
  isValidAllocineUrl: vi.fn(() => true),
  extractTheaterIdFromUrl: vi.fn(() => 'C0013'),
  cleanTheaterUrl: vi.fn(() => 'https://cleaned-url'),
}));

describe('TheaterService', () => {
  let theaterService: TheaterService;
  const mockDb = {} as DB;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isValidAllocineUrl).mockReturnValue(true);
    vi.mocked(extractTheaterIdFromUrl).mockReturnValue('C0013');
    theaterService = new TheaterService(mockDb);
  });

  describe('getAllTheaters', () => {
    it('should call getTheaters query', async () => {
      vi.mocked(theaterQueries.getTheaters).mockResolvedValue([{ id: '1', name: 'Theater' }] as any);
      const result = await theaterService.getAllTheaters();
      expect(result).toHaveLength(1);
      expect(theaterQueries.getTheaters).toHaveBeenCalledWith(mockDb);
    });
  });

  describe('getTheaterShowtimes', () => {
    it('should call getShowtimesByTheaterAndWeek query', async () => {
      vi.mocked(showtimeQueries.getShowtimesByTheaterAndWeek).mockResolvedValue([] as any);
      await theaterService.getTheaterShowtimes('C1', '2026-03-11');
      expect(showtimeQueries.getShowtimesByTheaterAndWeek).toHaveBeenCalledWith(mockDb, 'C1', '2026-03-11');
    });
  });

  describe('addTheaterViaUrl', () => {
    it('should throw if URL too long', async () => {
      await expect(theaterService.addTheaterViaUrl('a'.repeat(2049))).rejects.toThrow('URL is too long');
    });

    it('should throw if URL invalid', async () => {
      const { isValidAllocineUrl } = await import('../utils/url.js');
      vi.mocked(isValidAllocineUrl).mockReturnValue(false);
      await expect(theaterService.addTheaterViaUrl('http://bad')).rejects.toThrow('Invalid Allocine URL');
    });

    it('should throw if theater ID cannot be extracted', async () => {
      const { extractTheaterIdFromUrl } = await import('../utils/url.js');
      vi.mocked(extractTheaterIdFromUrl).mockReturnValue(null);
      await expect(theaterService.addTheaterViaUrl('http://valid')).rejects.toThrow('Could not extract theater ID');
    });

    it('should add theater and publish job on success', async () => {
      const mockPublish = vi.fn().mockResolvedValue(1);
      vi.mocked(redisClient.getRedisClient).mockReturnValue({ publishAddTheaterJob: mockPublish } as any);
      vi.mocked(reportQueries.createScrapeReport).mockResolvedValue(42 as any);
      vi.mocked(theaterQueries.addTheater).mockResolvedValue({ id: 'C0013' } as any);

      const result = await theaterService.addTheaterViaUrl('http://valid');

      expect(result.id).toBe('C0013');
      expect(mockPublish).toHaveBeenCalledWith(42, 'https://cleaned-url');
    });
  });

  describe('addTheaterManual', () => {
    it('should validate inputs and throw if invalid', async () => {
      await expect(theaterService.addTheaterManual('id!', 'name', 'url')).rejects.toThrow('Invalid ID format');
      await expect(theaterService.addTheaterManual('id', 'a'.repeat(101), 'url')).rejects.toThrow('Name must be');
    });

    it('should handle duplicate key error', async () => {
      vi.mocked(theaterQueries.addTheater).mockRejectedValue(new Error('duplicate key'));
      await expect(theaterService.addTheaterManual('C1', 'Name', 'http://valid')).rejects.toThrow('already exists');
    });

    it('should return theater on success', async () => {
      vi.mocked(theaterQueries.addTheater).mockResolvedValue({ id: 'C1' } as any);
      const result = await theaterService.addTheaterManual('C1', 'Name', 'http://valid');
      expect(result.id).toBe('C1');
    });
  });

  describe('updateTheater', () => {
    it('should throw if no fields provided', async () => {
      await expect(theaterService.updateTheater('C1', {})).rejects.toThrow('At least one field must be provided');
    });

    it('should throw if screen count invalid', async () => {
      await expect(theaterService.updateTheater('C1', { screen_count: 0 })).rejects.toThrow('between 1 and 50');
      await expect(theaterService.updateTheater('C1', { screen_count: 51 })).rejects.toThrow('between 1 and 50');
    });

    it('should throw if theater not found', async () => {
      vi.mocked(theaterQueries.updateTheaterConfig).mockResolvedValue(undefined);
      await expect(theaterService.updateTheater('C1', { name: 'New' })).rejects.toThrow('not found');
    });

    it('should return updated theater on success', async () => {
      vi.mocked(theaterQueries.updateTheaterConfig).mockResolvedValue({ id: 'C1', name: 'New' } as any);
      const result = await theaterService.updateTheater('C1', { name: 'New' });
      expect(result.name).toBe('New');
    });
  });

  describe('deleteTheater', () => {
    it('should throw if not found', async () => {
      vi.mocked(theaterQueries.deleteTheater).mockResolvedValue(false);
      await expect(theaterService.deleteTheater('C1')).rejects.toThrow('not found');
    });

    it('should return true on success', async () => {
      vi.mocked(theaterQueries.deleteTheater).mockResolvedValue(true);
      const result = await theaterService.deleteTheater('C1');
      expect(result).toBe(true);
    });
  });
});
