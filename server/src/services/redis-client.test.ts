import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisClient, getRedisClient, resetRedisClient } from './redis-client.js';
import Redis from 'ioredis';
import { logger } from '../utils/logger.js';

const mockRedisInstance = {
  rpush: vi.fn().mockResolvedValue(1),
  llen: vi.fn().mockResolvedValue(0),
  publish: vi.fn().mockResolvedValue(1),
  subscribe: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  quit: vi.fn().mockResolvedValue('OK'),
};

vi.mock('ioredis', () => {
  return {
    default: function() { return mockRedisInstance; },
  };
});

vi.mock('../utils/logger.js', () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

describe('RedisClient', () => {
  let client: RedisClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new RedisClient('redis://test');
  });

  it('should publish a job', async () => {
    await client.publishJob({ type: 'scrape', reportId: 1, triggerType: 'manual' });
    expect(mockRedisInstance.rpush).toHaveBeenCalledWith('scrape:jobs', expect.any(String));
  });

  it('should publish add_cinema job', async () => {
    await client.publishAddCinemaJob(42, 'http://test');
    expect(mockRedisInstance.rpush).toHaveBeenCalledWith('scrape:jobs', expect.any(String));
  });

  it('should get queue depth', async () => {
    await client.getQueueDepth();
    expect(mockRedisInstance.llen).toHaveBeenCalledWith('scrape:jobs');
  });

  it('should publish progress', async () => {
    await client.publishProgress({ type: 'start', total: 1 });
    expect(mockRedisInstance.publish).toHaveBeenCalledWith('scrape:progress', expect.any(String));
  });

  it('should subscribe to progress and handle messages', async () => {
    const handler = vi.fn();
    
    await client.subscribeToProgress(handler);
    
    // Simulate message
    const messageCallback = mockRedisInstance.on.mock.calls.find((call: any) => call[0] === 'message')[1];
    
    // Correct channel
    messageCallback('scrape:progress', JSON.stringify({ type: 'done' }));
    expect(handler).toHaveBeenCalledWith({ type: 'done' });
    
    // Wrong channel
    messageCallback('other:channel', '{}');
    expect(handler).toHaveBeenCalledTimes(1);
    
    // Invalid JSON
    messageCallback('scrape:progress', 'invalid');
    expect(logger.error).toHaveBeenCalled();
  });

  it('should disconnect', async () => {
    await client.disconnect();
    expect(mockRedisInstance.quit).toHaveBeenCalledTimes(2);
  });

  describe('getRedisClient singleton', () => {
    beforeEach(() => {
      resetRedisClient();
      delete process.env.REDIS_URL;
    });

    it('should create instance with default URL if env var missing', () => {
      const instance = getRedisClient();
      expect(instance).toBeInstanceOf(RedisClient);
    });

    it('should create instance with REDIS_URL if present', () => {
      process.env.REDIS_URL = 'redis://custom:6379';
      const instance = getRedisClient();
      expect(instance).toBeInstanceOf(RedisClient);
    });
  });
});
