import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../config/rate-limits.js');
vi.mock('../middleware/rate-limit.js');
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { getRateLimitConfig } from '../config/rate-limits.js';
import { refreshRateLimits } from '../middleware/rate-limit.js';
import { logger } from '../utils/logger.js';
import { startConfigRefresher, stopConfigRefresher } from './rate-limit-refresher.js';
import type { DB } from '../db/client.js';

const mockConfig = {
  windowMs: 60000, generalMax: 100, authMax: 5, registerMax: 3,
  registerWindowMs: 3600000, protectedMax: 60, scraperMax: 10,
  publicMax: 100, healthMax: 10, healthWindowMs: 60000,
};

describe('Rate Limit Refresher Service', () => {
  const mockDb = {} as DB;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.mocked(getRateLimitConfig).mockResolvedValue(mockConfig);
  });

  afterEach(() => {
    stopConfigRefresher();
    vi.useRealTimers();
  });

  it('should poll immediately on start', async () => {
    startConfigRefresher(mockDb);
    await vi.waitFor(() => {
      expect(getRateLimitConfig).toHaveBeenCalledTimes(1);
      expect(refreshRateLimits).toHaveBeenCalledWith(expect.objectContaining({ generalMax: 100 }));
    });
  });

  it('should log debug on successful refresh', async () => {
    startConfigRefresher(mockDb);
    await vi.waitFor(() => {
      expect(logger.debug).toHaveBeenCalledWith('Rate limit config refreshed from database');
    });
  });

  it('should poll again after POLL_INTERVAL', async () => {
    startConfigRefresher(mockDb);
    await vi.waitFor(() => expect(getRateLimitConfig).toHaveBeenCalledTimes(1));

    vi.mocked(getRateLimitConfig).mockClear();
    vi.advanceTimersByTime(60000);

    await vi.waitFor(() => expect(getRateLimitConfig).toHaveBeenCalledTimes(1));
  });

  it('should log warning when getRateLimitConfig fails', async () => {
    vi.mocked(getRateLimitConfig).mockRejectedValue(new Error('DB connection failed'));

    startConfigRefresher(mockDb);

    await vi.waitFor(() => {
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to refresh rate limits from DB, using cached config',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
    expect(refreshRateLimits).not.toHaveBeenCalled();
  });

  it('should clear interval on stopConfigRefresher', async () => {
    startConfigRefresher(mockDb);
    await vi.waitFor(() => expect(getRateLimitConfig).toHaveBeenCalledTimes(1));

    stopConfigRefresher();
    vi.mocked(getRateLimitConfig).mockClear();

    vi.advanceTimersByTime(120000);
    expect(getRateLimitConfig).not.toHaveBeenCalled();
  });

  it('should restart interval if startConfigRefresher called twice', async () => {
    startConfigRefresher(mockDb);
    await vi.waitFor(() => expect(getRateLimitConfig).toHaveBeenCalledTimes(1));

    vi.mocked(getRateLimitConfig).mockClear();
    startConfigRefresher(mockDb);

    await vi.waitFor(() => expect(getRateLimitConfig).toHaveBeenCalledTimes(1));
  });
});
