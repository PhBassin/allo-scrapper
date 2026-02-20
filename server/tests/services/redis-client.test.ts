import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Tests for RedisClient service.
 * Uses vi.mock + vi.hoisted to avoid a real Redis connection.
 */

// ---------------------------------------------------------------------------
// Hoisted mock state (vi.hoisted runs before vi.mock)
// ---------------------------------------------------------------------------
const mockMethods = vi.hoisted(() => ({
  publish: vi.fn().mockResolvedValue(1),
  subscribe: vi.fn().mockResolvedValue('OK'),
  on: vi.fn(),
  rpush: vi.fn().mockResolvedValue(1),
  llen: vi.fn().mockResolvedValue(0),
  quit: vi.fn().mockResolvedValue('OK'),
}));

vi.mock('ioredis', () => ({
  default: function MockRedis() {
    return mockMethods;
  },
}));

// ---------------------------------------------------------------------------
// Import AFTER mock is declared
// ---------------------------------------------------------------------------
import { RedisClient } from '../../src/services/redis-client.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('RedisClient', () => {
  let client: RedisClient;

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-attach default resolved values after clearAllMocks
    mockMethods.publish.mockResolvedValue(1);
    mockMethods.subscribe.mockResolvedValue('OK');
    mockMethods.rpush.mockResolvedValue(1);
    mockMethods.llen.mockResolvedValue(0);
    mockMethods.quit.mockResolvedValue('OK');

    client = new RedisClient('redis://localhost:6379');
  });

  afterEach(async () => {
    await client.disconnect();
  });

  // ---- publishJob -----------------------------------------------------------

  describe('publishJob', () => {
    test('should push job to scrape:jobs queue', async () => {
      const job = { reportId: 42, triggerType: 'manual' as const, options: {} };

      await client.publishJob(job);

      expect(mockMethods.rpush).toHaveBeenCalledWith(
        'scrape:jobs',
        JSON.stringify(job)
      );
    });

    test('should return the queue length after push', async () => {
      mockMethods.rpush.mockResolvedValue(3);
      const job = { reportId: 1, triggerType: 'manual' as const, options: {} };

      const len = await client.publishJob(job);

      expect(len).toBe(3);
    });
  });

  // ---- getQueueDepth -------------------------------------------------------

  describe('getQueueDepth', () => {
    test('should return current queue depth', async () => {
      mockMethods.llen.mockResolvedValue(5);

      const depth = await client.getQueueDepth();

      expect(mockMethods.llen).toHaveBeenCalledWith('scrape:jobs');
      expect(depth).toBe(5);
    });

    test('should return 0 for empty queue', async () => {
      mockMethods.llen.mockResolvedValue(0);

      const depth = await client.getQueueDepth();

      expect(depth).toBe(0);
    });
  });

  // ---- publishProgress -----------------------------------------------------

  describe('publishProgress', () => {
    test('should publish event to scrape:progress channel', async () => {
      const event = { type: 'started' as const, total_cinemas: 3, total_dates: 7 };

      await client.publishProgress(event);

      expect(mockMethods.publish).toHaveBeenCalledWith(
        'scrape:progress',
        JSON.stringify(event)
      );
    });
  });

  // ---- subscribeToProgress -------------------------------------------------

  describe('subscribeToProgress', () => {
    test('should subscribe to scrape:progress channel', async () => {
      const handler = vi.fn();

      await client.subscribeToProgress(handler);

      expect(mockMethods.subscribe).toHaveBeenCalledWith('scrape:progress');
    });

    test('should call handler when message is received on scrape:progress', async () => {
      const handler = vi.fn();
      await client.subscribeToProgress(handler);

      // Find the 'message' callback registered via .on()
      const onCall = mockMethods.on.mock.calls.find(([event]: [string]) => event === 'message');
      expect(onCall).toBeDefined();

      const messageCallback = onCall![1] as (channel: string, msg: string) => void;
      const event = { type: 'cinema_started', cinema_name: 'Test', cinema_id: 'C001', index: 0 };
      messageCallback('scrape:progress', JSON.stringify(event));

      expect(handler).toHaveBeenCalledWith(event);
    });

    test('should NOT call handler for messages on other channels', async () => {
      const handler = vi.fn();
      await client.subscribeToProgress(handler);

      const onCall = mockMethods.on.mock.calls.find(([event]: [string]) => event === 'message');
      const messageCallback = onCall![1] as (channel: string, msg: string) => void;
      messageCallback('other:channel', JSON.stringify({ type: 'started' }));

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ---- disconnect ----------------------------------------------------------

  describe('disconnect', () => {
    test('should call quit on both publisher and subscriber', async () => {
      mockMethods.quit.mockClear();

      await client.disconnect();

      // Both publisher and subscriber share the same mock instance
      // so quit is called twice (once per connection)
      expect(mockMethods.quit).toHaveBeenCalledTimes(2);
    });
  });
});
