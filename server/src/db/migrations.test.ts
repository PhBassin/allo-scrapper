import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { DB } from './client.js';
import {
  calculateChecksum,
  createSchemaTable,
  getPendingMigrations,
  applyMigration,
  runMigrations,
  type Migration,
} from './migrations.js';
import fs from 'fs/promises';
import path from 'path';

// Mock database
function createMockDb(): DB {
  return {
    query: vi.fn(),
  } as unknown as DB;
}

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock fs/promises for file reading
vi.mock('fs/promises');

describe('Migration System', () => {
  let db: DB;

  beforeEach(() => {
    db = createMockDb();
    vi.clearAllMocks();
  });

  describe('calculateChecksum', () => {
    it('should calculate SHA-256 checksum for SQL content', () => {
      const sql = 'CREATE TABLE test (id SERIAL PRIMARY KEY);';
      const checksum = calculateChecksum(sql);
      
      // Just verify it's a valid SHA-256 hash (64 hex chars)
      expect(checksum).toHaveLength(64); // SHA-256 = 64 hex chars
      expect(checksum).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should return same checksum for identical SQL', () => {
      const sql = 'SELECT * FROM users;';
      const checksum1 = calculateChecksum(sql);
      const checksum2 = calculateChecksum(sql);
      
      expect(checksum1).toBe(checksum2);
    });

    it('should return different checksums for different SQL', () => {
      const sql1 = 'CREATE TABLE test1 (id INT);';
      const sql2 = 'CREATE TABLE test2 (id INT);';
      
      expect(calculateChecksum(sql1)).not.toBe(calculateChecksum(sql2));
    });

    it('should be sensitive to whitespace changes', () => {
      const sql1 = 'SELECT * FROM users;';
      const sql2 = 'SELECT  *  FROM  users;'; // Extra spaces
      
      expect(calculateChecksum(sql1)).not.toBe(calculateChecksum(sql2));
    });
  });

  describe('createSchemaTable', () => {
    it('should create schema_migrations table if not exists', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      db.query = mockQuery;

      await createSchemaTable(db);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS schema_migrations')
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('version TEXT PRIMARY KEY')
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('checksum TEXT NOT NULL')
      );
    });

    it('should create index on applied_at column', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      db.query = mockQuery;

      await createSchemaTable(db);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX IF NOT EXISTS')
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('idx_schema_migrations_applied_at')
      );
    });
  });

  describe('getPendingMigrations', () => {
    it('should return all migrations when none applied', async () => {
      // Mock empty schema_migrations table
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      db.query = mockQuery;

      // Mock migration files
      vi.mocked(fs.readdir).mockResolvedValue([
        '001_initial.sql',
        '002_add_users.sql',
        '003_add_settings.sql',
      ] as any);

      const pending = await getPendingMigrations(db);

      expect(pending).toEqual([
        '001_initial.sql',
        '002_add_users.sql',
        '003_add_settings.sql',
      ]);
    });

    it('should return only unapplied migrations', async () => {
      // Mock applied migrations
      const mockQuery = vi.fn().mockResolvedValue({
        rows: [
          { version: '001_initial.sql' },
          { version: '002_add_users.sql' },
        ],
      });
      db.query = mockQuery;

      // Mock migration files
      vi.mocked(fs.readdir).mockResolvedValue([
        '001_initial.sql',
        '002_add_users.sql',
        '003_add_settings.sql',
        '004_add_roles.sql',
      ] as any);

      const pending = await getPendingMigrations(db);

      expect(pending).toEqual([
        '003_add_settings.sql',
        '004_add_roles.sql',
      ]);
    });

    it('should sort migrations by version number', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      db.query = mockQuery;

      // Mock unsorted migration files
      vi.mocked(fs.readdir).mockResolvedValue([
        '003_add_settings.sql',
        '001_initial.sql',
        '002_add_users.sql',
      ] as any);

      const pending = await getPendingMigrations(db);

      expect(pending).toEqual([
        '001_initial.sql',
        '002_add_users.sql',
        '003_add_settings.sql',
      ]);
    });

    it('should ignore non-SQL files', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      db.query = mockQuery;

      vi.mocked(fs.readdir).mockResolvedValue([
        '001_initial.sql',
        'README.md',
        '.gitkeep',
        '002_add_users.sql',
      ] as any);

      const pending = await getPendingMigrations(db);

      expect(pending).toEqual([
        '001_initial.sql',
        '002_add_users.sql',
      ]);
      expect(pending).not.toContain('README.md');
      expect(pending).not.toContain('.gitkeep');
    });

    it('should warn if applied migration file is missing', async () => {
      const { logger } = await import('../utils/logger.js');

      // Mock applied migrations
      const mockQuery = vi.fn().mockResolvedValue({
        rows: [
          { version: '001_initial.sql' },
          { version: '999_missing.sql' }, // Applied but file missing
        ],
      });
      db.query = mockQuery;

      // Mock only some migration files
      vi.mocked(fs.readdir).mockResolvedValue([
        '001_initial.sql',
        '002_add_users.sql',
      ] as any);

      await getPendingMigrations(db);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('999_missing.sql')
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('applied but file not found')
      );
    });
  });

  describe('applyMigration', () => {
    it('should execute migration SQL and insert tracking record', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      db.query = mockQuery;

      const migrationSql = 'CREATE TABLE test (id SERIAL PRIMARY KEY);';
      vi.mocked(fs.readFile).mockResolvedValue(migrationSql);

      await applyMigration(db, '001_initial.sql');

      // Should execute migration SQL
      expect(mockQuery).toHaveBeenCalledWith(migrationSql);

      // Should insert tracking record
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO schema_migrations'),
        expect.arrayContaining([
          '001_initial.sql',
          expect.any(String), // checksum
        ])
      );
    });

    it('should calculate and store checksum', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      db.query = mockQuery;

      const migrationSql = 'CREATE TABLE test (id INT);';
      vi.mocked(fs.readFile).mockResolvedValue(migrationSql);

      await applyMigration(db, '002_test.sql');

      const expectedChecksum = calculateChecksum(migrationSql);
      
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO schema_migrations'),
        ['002_test.sql', expectedChecksum]
      );
    });

    it('should throw error if migration file not found', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT: file not found'));

      await expect(
        applyMigration(db, '999_missing.sql')
      ).rejects.toThrow('file not found');
    });

    it('should throw error if SQL execution fails', async () => {
      const mockQuery = vi.fn().mockRejectedValue(new Error('SQL syntax error'));
      db.query = mockQuery;

      vi.mocked(fs.readFile).mockResolvedValue('INVALID SQL;');

      await expect(
        applyMigration(db, '001_invalid.sql')
      ).rejects.toThrow('SQL syntax error');
    });
  });

  describe('runMigrations', () => {
    it('should create schema table if not exists', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      db.query = mockQuery;

      vi.mocked(fs.readdir).mockResolvedValue([] as any);

      await runMigrations(db);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS schema_migrations')
      );
    });

    it('should apply all pending migrations in order', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      db.query = mockQuery;

      vi.mocked(fs.readdir).mockResolvedValue([
        '001_initial.sql',
        '002_add_users.sql',
      ] as any);

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce('-- Migration 001')
        .mockResolvedValueOnce('-- Migration 002');

      await runMigrations(db);

      // Should apply migrations in order
      expect(mockQuery).toHaveBeenCalledWith('-- Migration 001');
      expect(mockQuery).toHaveBeenCalledWith('-- Migration 002');

      // Should insert tracking records
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO schema_migrations'),
        expect.arrayContaining(['001_initial.sql', expect.any(String)])
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO schema_migrations'),
        expect.arrayContaining(['002_add_users.sql', expect.any(String)])
      );
    });

    it('should skip already-applied migrations', async () => {
      // Mock applied migrations
      const mockQuery = vi.fn()
        .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE schema_migrations
        .mockResolvedValueOnce({ rows: [] }) // CREATE INDEX
        .mockResolvedValueOnce({ rows: [] }) // SELECT for verifyChecksums
        .mockResolvedValueOnce({ 
          rows: [{ version: '001_initial.sql' }] 
        }); // SELECT from schema_migrations for getPendingMigrations

      db.query = mockQuery;

      vi.mocked(fs.readdir).mockResolvedValue([
        '001_initial.sql',
        '002_add_users.sql',
      ] as any);

      vi.mocked(fs.readFile).mockResolvedValue('-- Migration 002');

      await runMigrations(db);

      // Should only apply migration 002
      expect(mockQuery).toHaveBeenCalledWith('-- Migration 002');
    });

    it('should log progress for each migration', async () => {
      const { logger } = await import('../utils/logger.js');
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      db.query = mockQuery;

      vi.mocked(fs.readdir).mockResolvedValue(['001_initial.sql'] as any);
      vi.mocked(fs.readFile).mockResolvedValue('-- Migration');

      await runMigrations(db);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Applying migration 001_initial.sql')
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('completed')
      );
    });

    it('should warn if migration checksum mismatch', async () => {
      const { logger } = await import('../utils/logger.js');

      // Mock applied migration with different checksum
      const mockQuery = vi.fn()
        .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
        .mockResolvedValueOnce({ rows: [] }) // CREATE INDEX
        .mockResolvedValueOnce({
          rows: [{
            version: '001_initial.sql',
            checksum: 'old-checksum-abc123',
          }],
        }) // SELECT for verifyChecksums
        .mockResolvedValueOnce({
          rows: [{
            version: '001_initial.sql',
          }],
        }); // SELECT for getPendingMigrations

      db.query = mockQuery;

      vi.mocked(fs.readdir).mockResolvedValue(['001_initial.sql'] as any);
      vi.mocked(fs.readFile).mockResolvedValue('-- Modified migration');

      await runMigrations(db);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('001_initial.sql')
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('checksum mismatch')
      );
    });

    it('should log completion message when all migrations applied', async () => {
      const { logger } = await import('../utils/logger.js');
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      db.query = mockQuery;

      vi.mocked(fs.readdir).mockResolvedValue([] as any);

      await runMigrations(db);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('All migrations up to date')
      );
    });

    it('should stop on migration failure', async () => {
      const mockQuery = vi.fn()
        .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
        .mockResolvedValueOnce({ rows: [] }) // SELECT applied migrations
        .mockRejectedValueOnce(new Error('SQL error')); // First migration fails

      db.query = mockQuery;

      vi.mocked(fs.readdir).mockResolvedValue([
        '001_failing.sql',
        '002_should_not_run.sql',
      ] as any);

      vi.mocked(fs.readFile).mockResolvedValue('INVALID SQL;');

      await expect(runMigrations(db)).rejects.toThrow('SQL error');

      // Should not apply second migration
      expect(mockQuery).not.toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO schema_migrations'),
        expect.arrayContaining(['002_should_not_run.sql', expect.any(String)])
      );
    });
  });

  describe('runMigrations with extraDirs', () => {
    it('should apply only core migrations when extraDirs is omitted', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      db.query = mockQuery;

      vi.mocked(fs.readdir).mockResolvedValue(['001_initial.sql'] as any);
      vi.mocked(fs.readFile).mockResolvedValue('SELECT 1;');

      await runMigrations(db);

      // Only one readdir call (core migrations dir)
      expect(vi.mocked(fs.readdir)).toHaveBeenCalledTimes(1);
    });

    it('should apply only core migrations when extraDirs is empty array', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      db.query = mockQuery;

      vi.mocked(fs.readdir).mockResolvedValue(['001_initial.sql'] as any);
      vi.mocked(fs.readFile).mockResolvedValue('SELECT 1;');

      await runMigrations(db, []);

      // Only one readdir call (core migrations dir)
      expect(vi.mocked(fs.readdir)).toHaveBeenCalledTimes(1);
    });

    it('should read files from extra directories when provided', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      db.query = mockQuery;

      // Core dir returns one file; extra dir returns one file
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(['001_initial.sql'] as any)      // core dir
        .mockResolvedValueOnce(['saas_001_orgs.sql'] as any);   // extra dir

      vi.mocked(fs.readFile).mockResolvedValue('SELECT 1;');

      await runMigrations(db, ['/extra/migrations']);

      expect(vi.mocked(fs.readdir)).toHaveBeenCalledTimes(2);
      expect(vi.mocked(fs.readdir)).toHaveBeenNthCalledWith(
        2,
        '/extra/migrations'
      );
    });

    it('should apply core migrations before extra dir migrations', async () => {
      const appliedVersions: string[] = [];

      const mockQuery = vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
        if (sql.includes('INSERT INTO schema_migrations') && params) {
          appliedVersions.push(params[0] as string);
        }
        return Promise.resolve({ rows: [] });
      });
      db.query = mockQuery;

      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(['001_initial.sql'] as any)       // core dir
        .mockResolvedValueOnce(['saas_001_orgs.sql'] as any);    // extra dir

      vi.mocked(fs.readFile).mockResolvedValue('SELECT 1;');

      await runMigrations(db, ['/extra/migrations']);

      // Core migration must be applied before saas migration
      const coreIdx = appliedVersions.indexOf('001_initial.sql');
      const saasIdx = appliedVersions.indexOf('saas_001_orgs.sql');
      expect(coreIdx).toBeGreaterThanOrEqual(0);
      expect(saasIdx).toBeGreaterThanOrEqual(0);
      expect(coreIdx).toBeLessThan(saasIdx);
    });

    it('should NOT warn when an applied migration comes from an extra dir (not core)', async () => {
      const { logger } = await import('../utils/logger.js');

      // saas migration already applied, not present in core dir
      const mockQuery = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT version FROM schema_migrations')) {
          return Promise.resolve({ rows: [{ version: 'saas_001_plans.sql' }] });
        }
        return Promise.resolve({ rows: [] });
      });
      db.query = mockQuery;

      // Core dir is empty; extra dir has the file
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce([] as any)                           // core dir
        .mockResolvedValueOnce(['saas_001_plans.sql'] as any);      // extra dir

      await runMigrations(db, ['/extra/migrations']);

      // Should NOT warn about this applied migration
      const warnCalls = vi.mocked(logger.warn).mock.calls.map(c => String(c[0]));
      const falsePositive = warnCalls.some(
        msg => msg.includes('saas_001_plans.sql') && msg.includes('applied but file not found')
      );
      expect(falsePositive).toBe(false);
    });

    it('should skip extra dir files that are already applied', async () => {
      // saas migration already applied
      const mockQuery = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT version FROM schema_migrations')) {
          return Promise.resolve({ rows: [{ version: 'saas_001_orgs.sql' }] });
        }
        return Promise.resolve({ rows: [] });
      });
      db.query = mockQuery;

      vi.mocked(fs.readdir)
        .mockResolvedValueOnce([] as any)                        // core dir (empty)
        .mockResolvedValueOnce(['saas_001_orgs.sql'] as any);    // extra dir

      vi.mocked(fs.readFile).mockResolvedValue('SELECT 1;');

      await runMigrations(db, ['/extra/migrations']);

      // INSERT into schema_migrations should NOT be called (already applied)
      expect(mockQuery).not.toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO schema_migrations'),
        expect.arrayContaining(['saas_001_orgs.sql', expect.any(String)])
      );
    });
  });
});
