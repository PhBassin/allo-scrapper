import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFile, writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { DB } from '../db/client.js';
import type { CinemaConfig } from '../types/scraper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the functions we'll test
import {
  readCinemasJson,
  writeCinemasJson,
  addCinemaWithSync,
  updateCinemaWithSync,
  deleteCinemaWithSync,
  syncCinemasFromDatabase,
} from './cinema-config.js';

// Mock proper-lockfile
vi.mock('proper-lockfile', () => ({
  lock: vi.fn().mockResolvedValue(vi.fn()), // Returns release function
  unlock: vi.fn().mockResolvedValue(undefined),
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  rename: vi.fn(),
  unlink: vi.fn(),
}));

// Mock db queries
vi.mock('../db/queries.js', () => ({
  addCinema: vi.fn(),
  updateCinemaConfig: vi.fn(),
  deleteCinema: vi.fn(),
  getCinemaConfigs: vi.fn(),
}));

import * as queries from '../db/queries.js';

describe('Cinema Config Service', () => {
  let mockDb: DB;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      query: vi.fn(),
    } as unknown as DB;
  });

  describe('readCinemasJson', () => {
    it('should read and parse cinemas.json', async () => {
      const mockContent = JSON.stringify([
        { id: 'C0001', name: 'Cinema 1', url: 'https://example.com/1' },
        { id: 'C0002', name: 'Cinema 2', url: 'https://example.com/2' },
      ]);

      vi.mocked(readFile).mockResolvedValue(mockContent);

      const result = await readCinemasJson();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('C0001');
      expect(result[1].id).toBe('C0002');
      expect(readFile).toHaveBeenCalledWith(
        expect.stringContaining('cinemas.json'),
        'utf-8'
      );
    });

    it('should throw error when JSON is malformed', async () => {
      vi.mocked(readFile).mockResolvedValue('{ invalid json }');

      await expect(readCinemasJson()).rejects.toThrow();
    });

    it('should throw error when file does not exist', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('ENOENT: no such file'));

      await expect(readCinemasJson()).rejects.toThrow();
    });
  });

  describe('writeCinemasJson', () => {
    it('should write cinemas with proper formatting (2-space indent)', async () => {
      const cinemas: CinemaConfig[] = [
        { id: 'C0001', name: 'Cinema 1', url: 'https://example.com/1' },
        { id: 'C0002', name: 'Cinema 2', url: 'https://example.com/2' },
      ];

      await writeCinemasJson(cinemas);

      expect(writeFile).toHaveBeenCalled();
      const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
      
      // Verify proper JSON formatting
      expect(writtenContent).toContain('  "id": "C0001"'); // 2-space indent
      expect(writtenContent).toMatch(/\n$/); // Ends with newline
      
      // Verify it's valid JSON
      const parsed = JSON.parse(writtenContent);
      expect(parsed).toHaveLength(2);
    });

    it('should handle empty array', async () => {
      await writeCinemasJson([]);

      expect(writeFile).toHaveBeenCalled();
      const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
      expect(JSON.parse(writtenContent)).toEqual([]);
    });
  });

  describe('addCinemaWithSync', () => {
    it('should add cinema to DB and update JSON file', async () => {
      const newCinema = { id: 'C0003', name: 'New Cinema', url: 'https://example.com/3' };
      const existingCinemas = [
        { id: 'C0001', name: 'Cinema 1', url: 'https://example.com/1' },
        { id: 'C0002', name: 'Cinema 2', url: 'https://example.com/2' },
      ];

      // Mock DB operations
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);
      vi.mocked(queries.addCinema).mockResolvedValue(newCinema);
      vi.mocked(queries.getCinemaConfigs).mockResolvedValue([
        ...existingCinemas,
        newCinema,
      ]);

      const result = await addCinemaWithSync(mockDb, newCinema);

      // Verify transaction
      expect(mockDb.query).toHaveBeenCalledWith('BEGIN');
      expect(mockDb.query).toHaveBeenCalledWith('COMMIT');

      // Verify DB insert
      expect(queries.addCinema).toHaveBeenCalledWith(mockDb, newCinema);

      // Verify JSON write
      expect(writeFile).toHaveBeenCalled();
      expect(result).toEqual(newCinema);
    });

    it('should rollback transaction if JSON write fails', async () => {
      const newCinema = { id: 'C0003', name: 'New Cinema', url: 'https://example.com/3' };

      // Mock DB operations
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);
      vi.mocked(queries.addCinema).mockResolvedValue(newCinema);
      vi.mocked(queries.getCinemaConfigs).mockResolvedValue([newCinema]);

      // Mock JSON write failure
      vi.mocked(writeFile).mockRejectedValue(new Error('EACCES: permission denied'));

      await expect(addCinemaWithSync(mockDb, newCinema)).rejects.toThrow('permission denied');

      // Verify rollback was called
      expect(mockDb.query).toHaveBeenCalledWith('BEGIN');
      expect(mockDb.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockDb.query).not.toHaveBeenCalledWith('COMMIT');
    });

    it('should rollback transaction if DB insert fails', async () => {
      const newCinema = { id: 'C0003', name: 'New Cinema', url: 'https://example.com/3' };

      // Mock DB operations
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);
      vi.mocked(queries.addCinema).mockRejectedValue(new Error('duplicate key'));

      await expect(addCinemaWithSync(mockDb, newCinema)).rejects.toThrow('duplicate key');

      // Verify rollback was called
      expect(mockDb.query).toHaveBeenCalledWith('BEGIN');
      expect(mockDb.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockDb.query).not.toHaveBeenCalledWith('COMMIT');

      // Verify JSON was not written
      expect(writeFile).not.toHaveBeenCalled();
    });
  });

  describe('updateCinemaWithSync', () => {
    it('should update cinema in DB and JSON file', async () => {
      const updates = { name: 'Updated Cinema', url: 'https://example.com/updated' };
      const updatedCinema = { id: 'C0001', ...updates };
      const allCinemas = [
        updatedCinema,
        { id: 'C0002', name: 'Cinema 2', url: 'https://example.com/2' },
      ];

      // Reset writeFile mock to resolve (previous tests may have set it to reject)
      vi.mocked(writeFile).mockResolvedValue(undefined);

      // Mock DB operations
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);
      vi.mocked(queries.updateCinemaConfig).mockResolvedValue(updatedCinema);
      vi.mocked(queries.getCinemaConfigs).mockResolvedValue(allCinemas);

      const result = await updateCinemaWithSync(mockDb, 'C0001', updates);

      // Verify transaction
      expect(mockDb.query).toHaveBeenCalledWith('BEGIN');
      expect(mockDb.query).toHaveBeenCalledWith('COMMIT');

      // Verify DB update
      expect(queries.updateCinemaConfig).toHaveBeenCalledWith(mockDb, 'C0001', updates);

      // Verify JSON write
      expect(writeFile).toHaveBeenCalled();
      expect(result).toEqual(updatedCinema);
    });

    it('should return undefined if cinema not found', async () => {
      const updates = { name: 'Updated Cinema' };

      // Mock DB operations
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);
      vi.mocked(queries.updateCinemaConfig).mockResolvedValue(undefined);

      const result = await updateCinemaWithSync(mockDb, 'UNKNOWN', updates);

      // Transaction should still commit (no error case)
      expect(mockDb.query).toHaveBeenCalledWith('BEGIN');
      expect(mockDb.query).toHaveBeenCalledWith('COMMIT');

      // No JSON write should happen
      expect(writeFile).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should rollback transaction if JSON write fails', async () => {
      const updates = { name: 'Updated Cinema' };
      const updatedCinema = { id: 'C0001', name: 'Updated Cinema', url: 'https://example.com/1' };

      // Mock DB operations
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);
      vi.mocked(queries.updateCinemaConfig).mockResolvedValue(updatedCinema);
      vi.mocked(queries.getCinemaConfigs).mockResolvedValue([updatedCinema]);

      // Mock JSON write failure
      vi.mocked(writeFile).mockRejectedValue(new Error('Disk full'));

      await expect(updateCinemaWithSync(mockDb, 'C0001', updates)).rejects.toThrow('Disk full');

      // Verify rollback was called
      expect(mockDb.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockDb.query).not.toHaveBeenCalledWith('COMMIT');
    });
  });

  describe('deleteCinemaWithSync', () => {
    it('should delete cinema from DB and JSON file', async () => {
      const remainingCinemas = [
        { id: 'C0002', name: 'Cinema 2', url: 'https://example.com/2' },
      ];

      // Reset writeFile mock to resolve (previous tests may have set it to reject)
      vi.mocked(writeFile).mockResolvedValue(undefined);

      // Mock DB operations
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 1 } as any);
      vi.mocked(queries.deleteCinema).mockResolvedValue(true);
      vi.mocked(queries.getCinemaConfigs).mockResolvedValue(remainingCinemas);

      const result = await deleteCinemaWithSync(mockDb, 'C0001');

      // Verify transaction
      expect(mockDb.query).toHaveBeenCalledWith('BEGIN');
      expect(mockDb.query).toHaveBeenCalledWith('COMMIT');

      // Verify DB delete
      expect(queries.deleteCinema).toHaveBeenCalledWith(mockDb, 'C0001');

      // Verify JSON write
      expect(writeFile).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false if cinema not found', async () => {
      // Mock DB operations
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);
      vi.mocked(queries.deleteCinema).mockResolvedValue(false);

      const result = await deleteCinemaWithSync(mockDb, 'UNKNOWN');

      // Transaction should still commit (no error case)
      expect(mockDb.query).toHaveBeenCalledWith('BEGIN');
      expect(mockDb.query).toHaveBeenCalledWith('COMMIT');

      // No JSON write should happen
      expect(writeFile).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should rollback transaction if JSON write fails', async () => {
      // Mock DB operations
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 1 } as any);
      vi.mocked(queries.deleteCinema).mockResolvedValue(true);
      vi.mocked(queries.getCinemaConfigs).mockResolvedValue([]);

      // Mock JSON write failure
      vi.mocked(writeFile).mockRejectedValue(new Error('Write error'));

      await expect(deleteCinemaWithSync(mockDb, 'C0001')).rejects.toThrow('Write error');

      // Verify rollback was called
      expect(mockDb.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockDb.query).not.toHaveBeenCalledWith('COMMIT');
    });
  });

  describe('syncCinemasFromDatabase', () => {
    it('should read all cinemas from DB and write to JSON', async () => {
      const dbCinemas = [
        { id: 'C0001', name: 'Cinema 1', url: 'https://example.com/1' },
        { id: 'C0002', name: 'Cinema 2', url: 'https://example.com/2' },
        { id: 'C0003', name: 'Cinema 3', url: 'https://example.com/3' },
      ];

      // Reset writeFile mock to resolve (previous tests may have set it to reject)
      vi.mocked(writeFile).mockResolvedValue(undefined);

      vi.mocked(queries.getCinemaConfigs).mockResolvedValue(dbCinemas);

      const count = await syncCinemasFromDatabase(mockDb);

      // Verify DB read
      expect(queries.getCinemaConfigs).toHaveBeenCalledWith(mockDb);

      // Verify JSON write
      expect(writeFile).toHaveBeenCalled();
      const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
      const parsed = JSON.parse(writtenContent);
      expect(parsed).toHaveLength(3);
      expect(parsed[0].id).toBe('C0001');

      expect(count).toBe(3);
    });

    it('should handle empty database', async () => {
      // Reset writeFile mock to resolve (previous tests may have set it to reject)
      vi.mocked(writeFile).mockResolvedValue(undefined);

      vi.mocked(queries.getCinemaConfigs).mockResolvedValue([]);

      const count = await syncCinemasFromDatabase(mockDb);

      expect(writeFile).toHaveBeenCalled();
      const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
      expect(JSON.parse(writtenContent)).toEqual([]);
      expect(count).toBe(0);
    });

    it('should throw error if JSON write fails', async () => {
      const dbCinemas = [
        { id: 'C0001', name: 'Cinema 1', url: 'https://example.com/1' },
      ];

      vi.mocked(queries.getCinemaConfigs).mockResolvedValue(dbCinemas);
      vi.mocked(writeFile).mockRejectedValue(new Error('No space left'));

      await expect(syncCinemasFromDatabase(mockDb)).rejects.toThrow('No space left');
    });
  });
});
