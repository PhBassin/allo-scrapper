import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startQuotaResetScheduler } from './quota-reset-scheduler.js';
import { logger } from './utils/logger.js';
import type { DB } from './db/types.js';

vi.mock('./utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock QuotaService at top level to avoid hoisting warnings and ensure it's mocked
vi.mock('./services/quota-service.js', () => {
  return {
    QuotaService: vi.fn().mockImplementation(() => ({
      resetMonthlyUsage: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('QuotaResetScheduler', () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };
    
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should log scheduler start using the structured logger', () => {
    vi.setSystemTime(new Date('2026-04-02T12:00:00Z'));
    startQuotaResetScheduler(mockDb as unknown as DB);
    
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('[quota-reset] Scheduler started')
    );
  });

  it('should run monthly reset immediately if today is the 1st', async () => {
    vi.setSystemTime(new Date('2026-04-01T12:00:00Z'));
    mockDb.query.mockResolvedValue({ rows: [{ id: 1, slug: 'test-org' }] });
    
    startQuotaResetScheduler(mockDb as unknown as DB);

    await vi.runOnlyPendingTimersAsync();

    expect(mockDb.query).toHaveBeenCalledWith(
      `SELECT id, slug FROM organizations WHERE status IN ('trial', 'active')`
    );
  });

  it('should not run monthly reset immediately if today is not the 1st', async () => {
    vi.setSystemTime(new Date('2026-04-02T12:00:00Z'));
    
    startQuotaResetScheduler(mockDb as unknown as DB);
    await vi.runOnlyPendingTimersAsync();

    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('should trigger monthly reset at midnight UTC', async () => {
    // Start on 31st at 23:00
    vi.setSystemTime(new Date('2026-03-31T23:00:00Z'));
    
    startQuotaResetScheduler(mockDb as unknown as DB);
    
    // Advance to midnight (1st of April)
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    
    expect(mockDb.query).toHaveBeenCalled();
  });
});
