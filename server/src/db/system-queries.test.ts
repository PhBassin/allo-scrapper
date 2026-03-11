import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { DB } from './client.js';
import {
  getAppliedMigrations,
  getPendingMigrations,
  getDatabaseStats,
  type AppliedMigration,
  type PendingMigration,
  type DatabaseStats,
} from './system-queries.js';

describe('System Queries', () => {
  describe('getAppliedMigrations', () => {
    it('should return list of applied migrations from schema_migrations table', async () => {
      const mockDb: DB = {
        query: vi.fn().mockResolvedValue({
          rows: [
            { version: '001_neutralize_references.sql', applied_at: new Date('2026-03-01T10:00:00Z') },
            { version: '002_add_pg_trgm_extension.sql', applied_at: new Date('2026-03-01T10:01:00Z') },
            { version: '003_add_users_table.sql', applied_at: new Date('2026-03-01T10:02:00Z') },
          ],
        }),
      } as unknown as DB;

      const result = await getAppliedMigrations(mockDb);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        version: '001_neutralize_references.sql',
        appliedAt: new Date('2026-03-01T10:00:00Z'),
        status: 'applied',
      });
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM schema_migrations'),
        []
      );
    });

    it('should return empty array when no migrations applied', async () => {
      const mockDb: DB = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      } as unknown as DB;

      const result = await getAppliedMigrations(mockDb);

      expect(result).toEqual([]);
    });

    it('should order migrations by version (query handles ORDER BY)', async () => {
      // Query already includes ORDER BY version ASC, so we expect results to be sorted
      const mockDb: DB = {
        query: vi.fn().mockResolvedValue({
          rows: [
            // Rows returned in sorted order from query
            { version: '001_neutralize_references.sql', applied_at: new Date('2026-03-01T10:00:00Z') },
            { version: '002_add_pg_trgm_extension.sql', applied_at: new Date('2026-03-01T10:01:00Z') },
            { version: '003_add_users_table.sql', applied_at: new Date('2026-03-01T10:02:00Z') },
          ],
        }),
      } as unknown as DB;

      const result = await getAppliedMigrations(mockDb);

      // Verify ORDER BY clause was used in query
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY version'),
        []
      );
      expect(result[0].version).toBe('001_neutralize_references.sql');
      expect(result[1].version).toBe('002_add_pg_trgm_extension.sql');
      expect(result[2].version).toBe('003_add_users_table.sql');
    });
  });

  describe('getPendingMigrations', () => {
    it('should return empty array when all migrations are applied', async () => {
      // Mock with all actual migration files in the migrations/ directory
      const mockDb: DB = {
        query: vi.fn().mockResolvedValue({
          rows: [
            { version: '001_neutralize_references.sql' },
            { version: '002_add_pg_trgm_extension.sql' },
            { version: '003_add_users_table.sql' },
            { version: '004_add_app_settings.sql' },
            { version: '005_add_user_roles.sql' },
            { version: '006_fix_app_settings_schema.sql' },
            { version: '007_seed_default_admin.sql' },
            { version: '008_permission_based_roles.sql' },
            { version: '009_add_roles_permission.sql' },
          ],
        }),
      } as unknown as DB;

      const result = await getPendingMigrations(mockDb);

      expect(result).toEqual([]);
    });

    it('should return pending migrations not in schema_migrations table', async () => {
      const mockDb: DB = {
        query: vi.fn().mockResolvedValue({
          rows: [
            { version: '001_neutralize_references.sql' },
            { version: '002_add_pg_trgm_extension.sql' },
            // 003, 004, 005, 006, 007 are missing
          ],
        }),
      } as unknown as DB;

      const result = await getPendingMigrations(mockDb);

      // Should find all missing migrations
      expect(result.length).toBeGreaterThan(0);
      expect(result.every(m => m.status === 'pending')).toBe(true);
    });

    it('should order pending migrations by version', async () => {
      const mockDb: DB = {
        query: vi.fn().mockResolvedValue({
          rows: [{ version: '001_neutralize_references.sql' }],
        }),
      } as unknown as DB;

      const result = await getPendingMigrations(mockDb);

      // Pending migrations should be in numerical order
      if (result.length > 1) {
        for (let i = 1; i < result.length; i++) {
          expect(result[i].version > result[i - 1].version).toBe(true);
        }
      }
    });

    it('should handle empty database (no migrations applied)', async () => {
      const mockDb: DB = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      } as unknown as DB;

      const result = await getPendingMigrations(mockDb);

      // Should find all migration files as pending
      expect(result.length).toBeGreaterThan(0);
      expect(result.every(m => m.status === 'pending')).toBe(true);
    });
  });

  describe('getDatabaseStats', () => {
    it('should return database statistics', async () => {
      const mockDb: DB = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [{ size: '15 MB' }] }) // Database size
          .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // Table count
          .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // Cinemas
          .mockResolvedValueOnce({ rows: [{ count: '100' }] }) // Films
          .mockResolvedValueOnce({ rows: [{ count: '500' }] }), // Seances
      } as unknown as DB;

      const result = await getDatabaseStats(mockDb);

      expect(result).toEqual({
        size: '15 MB',
        tables: 10,
        cinemas: 5,
        films: 100,
        showtimes: 500,
      });
    });

    it('should handle zero counts gracefully', async () => {
      const mockDb: DB = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [{ size: '8192 bytes' }] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] }),
      } as unknown as DB;

      const result = await getDatabaseStats(mockDb);

      expect(result).toEqual({
        size: '8192 bytes',
        tables: 0,
        cinemas: 0,
        films: 0,
        showtimes: 0,
      });
    });

    it('should format large numbers correctly', async () => {
      const mockDb: DB = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [{ size: '2500 MB' }] })
          .mockResolvedValueOnce({ rows: [{ count: '25' }] })
          .mockResolvedValueOnce({ rows: [{ count: '150' }] })
          .mockResolvedValueOnce({ rows: [{ count: '5000' }] })
          .mockResolvedValueOnce({ rows: [{ count: '50000' }] }),
      } as unknown as DB;

      const result = await getDatabaseStats(mockDb);

      expect(result.tables).toBe(25);
      expect(result.cinemas).toBe(150);
      expect(result.films).toBe(5000);
      expect(result.showtimes).toBe(50000);
    });

    it('should handle database query errors', async () => {
      const mockDb: DB = {
        query: vi.fn().mockRejectedValue(new Error('Connection failed')),
      } as unknown as DB;

      await expect(getDatabaseStats(mockDb)).rejects.toThrow('Connection failed');
    });
  });

  describe('Edge Cases', () => {
    it('getAppliedMigrations should handle database errors', async () => {
      const mockDb: DB = {
        query: vi.fn().mockRejectedValue(new Error('Database error')),
      } as unknown as DB;

      await expect(getAppliedMigrations(mockDb)).rejects.toThrow('Database error');
    });

    it('getPendingMigrations should handle database errors', async () => {
      const mockDb: DB = {
        query: vi.fn().mockRejectedValue(new Error('Database error')),
      } as unknown as DB;

      await expect(getPendingMigrations(mockDb)).rejects.toThrow('Database error');
    });
  });
});
