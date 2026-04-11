import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('QuotaResetScheduler', () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };
    
    // Mock Date to be the 2nd of the month to avoid immediate runMonthlyReset execution in tests
    // unless we specifically want to test it.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-02T12:00:00Z'));
  });

  it('should log scheduler start using the structured logger', () => {
    startQuotaResetScheduler(mockDb as unknown as DB);
    
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('[quota-reset] Scheduler started')
    );
  });
});
