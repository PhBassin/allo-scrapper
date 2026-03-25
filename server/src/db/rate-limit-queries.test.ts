import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { QueryResult } from 'pg';
import {
  getRateLimits,
  updateRateLimits,
  resetRateLimits,
  getRateLimitAuditLog,
  getValidationConstraints,
  type RateLimitConfigRow,
} from './rate-limit-queries.js';
import type { DB } from './client.js';

// Helper to create mock QueryResult
function mockQueryResult<T = any>(rows: T[]): QueryResult<T> {
  return {
    rows,
    command: 'SELECT',
    rowCount: rows.length,
    oid: 0,
    fields: [],
  };
}

describe('rate-limit-queries', () => {
  const mockConfigRow: RateLimitConfigRow = {
    id: 1,
    window_ms: 900000,
    general_max: 100,
    auth_max: 5,
    register_max: 3,
    register_window_ms: 3600000,
    protected_max: 60,
    scraper_max: 10,
    public_max: 100,
    health_max: 10,
    health_window_ms: 60000,
    updated_at: '2026-03-25T10:00:00.000Z',
    updated_by: 1,
    environment: 'production',
  };

  describe('getRateLimits', () => {
    it('should fetch rate limit config from database', async () => {
      const mockDb = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [mockConfigRow] })
          .mockResolvedValueOnce({ rows: [{ username: 'admin' }] }),
        end: vi.fn(),
      } as any as DB;

      const config = await getRateLimits(mockDb);

      expect(config.config).toEqual({
        windowMs: 900000,
        generalMax: 100,
        authMax: 5,
        registerMax: 3,
        registerWindowMs: 3600000,
        protectedMax: 60,
        scraperMax: 10,
        publicMax: 100,
        healthMax: 10,
        healthWindowMs: 60000,
      });
      expect(config.source).toBe('database');
      expect(config.updatedBy).toEqual({ id: 1, username: 'admin' });
      expect(config.environment).toBe('production');
    });

    it('should throw error if config not found', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        end: vi.fn(),
      } as any as DB;

      await expect(getRateLimits(mockDb)).rejects.toThrow('Rate limit configuration not found');
    });

    it('should handle null updated_by', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({
          rows: [{ ...mockConfigRow, updated_by: null }]
        }),
        end: vi.fn(),
      } as any as DB;

      const config = await getRateLimits(mockDb);

      expect(config.updatedBy).toBeNull();
    });
  });

  describe('updateRateLimits', () => {
    it('should update rate limits and create audit log', async () => {
      const queries: any[] = [];
      const mockDb = {
        query: vi.fn((sql: string, params?: any[]) => {
          queries.push({ sql, params });
          
          if (sql === 'BEGIN') return Promise.resolve({ rows: [] });
          if (sql === 'COMMIT') return Promise.resolve({ rows: [] });
          if (sql.includes('FOR UPDATE')) {
            return Promise.resolve({ rows: [mockConfigRow] });
          }
          if (sql.includes('UPDATE rate_limit_configs')) {
            return Promise.resolve({
              rows: [{ ...mockConfigRow, general_max: 150, updated_by: 1 }]
            });
          }
          if (sql.includes('INSERT INTO rate_limit_audit_log')) {
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        }),
        end: vi.fn(),
      } as any as DB;

      const config = await updateRateLimits(
        mockDb,
        { generalMax: 150 },
        1,
        'admin',
        'admin',
        '127.0.0.1',
        'Test Agent'
      );

      expect(config.config.generalMax).toBe(150);
      
      // Verify transaction was used
      expect(queries[0].sql).toBe('BEGIN');
      expect(queries[queries.length - 1].sql).toBe('COMMIT');
      
      // Verify audit log was created
      const auditInsert = queries.find((q: any) => q.sql.includes('rate_limit_audit_log'));
      expect(auditInsert).toBeDefined();
      expect(auditInsert.params).toContain('admin');
      expect(auditInsert.params).toContain('general_max');
      expect(auditInsert.params).toContain('100'); // old value
      expect(auditInsert.params).toContain('150'); // new value
    });

    it('should not update if no changes', async () => {
      const queries: any[] = [];
      const mockDb = {
        query: vi.fn((sql: string) => {
          queries.push(sql);
          
          if (sql === 'BEGIN') return Promise.resolve({ rows: [] });
          if (sql === 'ROLLBACK') return Promise.resolve({ rows: [] });
          if (sql.includes('FOR UPDATE')) {
            return Promise.resolve({ rows: [mockConfigRow] });
          }
          return Promise.resolve({ rows: [] });
        }),
        end: vi.fn(),
      } as any as DB;

      const config = await updateRateLimits(
        mockDb,
        { generalMax: 100 }, // Same as current
        1,
        'admin',
        'admin',
        '127.0.0.1',
        'Test Agent'
      );

      expect(config.config.generalMax).toBe(100);
      
      // Should rollback, not commit
      expect(queries).toContain('ROLLBACK');
      expect(queries).not.toContain('COMMIT');
    });

    it('should rollback on error', async () => {
      const queries: any[] = [];
      const mockDb = {
        query: vi.fn((sql: string) => {
          queries.push(sql);
          
          if (sql === 'BEGIN') return Promise.resolve({ rows: [] });
          if (sql === 'ROLLBACK') return Promise.resolve({ rows: [] });
          if (sql.includes('FOR UPDATE')) {
            return Promise.resolve({ rows: [mockConfigRow] });
          }
          if (sql.includes('UPDATE rate_limit_configs')) {
            throw new Error('Update failed');
          }
          return Promise.resolve({ rows: [] });
        }),
        end: vi.fn(),
      } as any as DB;

      await expect(
        updateRateLimits(mockDb, { generalMax: 150 }, 1, 'admin', 'admin', '127.0.0.1', 'Test')
      ).rejects.toThrow('Update failed');
      
      expect(queries).toContain('ROLLBACK');
    });

    it('should handle multiple field updates', async () => {
      const queries: any[] = [];
      const mockDb = {
        query: vi.fn((sql: string, params?: any[]) => {
          queries.push({ sql, params });
          
          if (sql === 'BEGIN') return Promise.resolve({ rows: [] });
          if (sql === 'COMMIT') return Promise.resolve({ rows: [] });
          if (sql.includes('FOR UPDATE')) {
            return Promise.resolve({ rows: [mockConfigRow] });
          }
          if (sql.includes('UPDATE rate_limit_configs')) {
            return Promise.resolve({
              rows: [{
                ...mockConfigRow,
                general_max: 150,
                auth_max: 10,
                scraper_max: 20,
              }]
            });
          }
          if (sql.includes('INSERT INTO rate_limit_audit_log')) {
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        }),
        end: vi.fn(),
      } as any as DB;

      await updateRateLimits(
        mockDb,
        { generalMax: 150, authMax: 10, scraperMax: 20 },
        1,
        'admin',
        'admin',
        '127.0.0.1',
        'Test'
      );

      // Should create 3 audit log entries
      const auditInserts = queries.filter((q: any) => q.sql.includes('rate_limit_audit_log'));
      expect(auditInserts).toHaveLength(3);
    });
  });

  describe('resetRateLimits', () => {
    it('should reset all values to defaults', async () => {
      const mockDb = {
        query: vi.fn((sql: string) => {
          if (sql === 'BEGIN') return Promise.resolve({ rows: [] });
          if (sql === 'COMMIT') return Promise.resolve({ rows: [] });
          if (sql.includes('FOR UPDATE')) {
            return Promise.resolve({
              rows: [{
                ...mockConfigRow,
                general_max: 500, // Non-default
                auth_max: 20,
              }]
            });
          }
          if (sql.includes('UPDATE rate_limit_configs')) {
            return Promise.resolve({
              rows: [{
                ...mockConfigRow,
                general_max: 100, // Reset to default
                auth_max: 5,
              }]
            });
          }
          if (sql.includes('INSERT INTO rate_limit_audit_log')) {
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        }),
        end: vi.fn(),
      } as any as DB;

      const config = await resetRateLimits(mockDb, 1, 'admin', 'admin', '127.0.0.1', 'Test');

      expect(config.config.generalMax).toBe(100);
      expect(config.config.authMax).toBe(5);
    });
  });

  describe('getRateLimitAuditLog', () => {
    it('should fetch audit log with pagination', async () => {
      const mockLogs = [
        {
          id: 1,
          changed_at: '2026-03-25T10:00:00Z',
          changed_by: 1,
          changed_by_username: 'admin',
          changed_by_role: 'admin',
          field_name: 'general_max',
          old_value: '100',
          new_value: '150',
          user_ip: '127.0.0.1',
          user_agent: 'Test Agent',
        },
      ];

      const mockDb = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: mockLogs })
          .mockResolvedValueOnce({ rows: [{ total: '1' }] }),
        end: vi.fn(),
      } as any as DB;

      const result = await getRateLimitAuditLog(mockDb, {
        limit: 50,
        offset: 0,
      });

      expect(result.logs).toEqual(mockLogs);
      expect(result.total).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });

    it('should filter by userId', async () => {
      const mockDb = {
        query: vi.fn((sql: string, params?: any[]) => {
          if (sql.includes('WHERE changed_by')) {
            expect(params).toContain(1);
          }
          return Promise.resolve({ rows: [] });
        }).mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ total: '0' }] }),
        end: vi.fn(),
      } as any as DB;

      await getRateLimitAuditLog(mockDb, {
        limit: 50,
        offset: 0,
        userId: 1,
      });

      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('getValidationConstraints', () => {
    it('should return validation constraints for all fields', () => {
      const constraints = getValidationConstraints();

      expect(constraints.windowMs).toEqual({ min: 60000, max: 3600000, unit: 'milliseconds' });
      expect(constraints.generalMax).toEqual({ min: 10, max: 1000, unit: 'requests' });
      expect(constraints.authMax).toEqual({ min: 3, max: 50, unit: 'requests' });
      expect(constraints.registerMax).toEqual({ min: 1, max: 20, unit: 'requests' });
      expect(constraints.healthWindowMs).toEqual({ min: 60000, max: 60000, unit: 'milliseconds' });
    });

    it('should have constraints for all config fields', () => {
      const constraints = getValidationConstraints();
      const expectedFields = [
        'windowMs',
        'generalMax',
        'authMax',
        'registerMax',
        'registerWindowMs',
        'protectedMax',
        'scraperMax',
        'publicMax',
        'healthMax',
        'healthWindowMs',
      ];

      for (const field of expectedFields) {
        expect(constraints[field]).toBeDefined();
        expect(constraints[field].min).toBeGreaterThan(0);
        expect(constraints[field].max).toBeGreaterThanOrEqual(constraints[field].min);
        expect(constraints[field].unit).toBeTruthy();
      }
    });
  });
});
