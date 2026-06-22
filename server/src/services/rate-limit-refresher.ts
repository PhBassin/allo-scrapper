import type { DB } from '../db/index.js';
import { getRateLimitConfig } from '../config/rate-limits.js';
import { refreshRateLimits } from '../middleware/rate-limit.js';
import { logger } from '../utils/logger.js';

const POLL_INTERVAL = 60_000;

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startConfigRefresher(db: DB): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
  }

  const poll = async () => {
    try {
      const config = await getRateLimitConfig(db);
      refreshRateLimits(config);
      logger.debug('Rate limit config refreshed from database');
    } catch (error) {
      logger.warn('Failed to refresh rate limits from DB, using cached config', { error });
    }
  };

  poll();
  intervalHandle = setInterval(poll, POLL_INTERVAL);

  if (intervalHandle.unref) {
    intervalHandle.unref();
  }
}

export function stopConfigRefresher(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
