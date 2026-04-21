import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisClient, getRedisClient, resetRedisClient } from './redis-client.js';
import Redis from 'ioredis';
import { logger } from '../utils/logger.js';

const mockRedisInstance = {
  rpush: vi.fn().mockResolvedValue(1),
  llen: vi.fn().mockResolvedValue(0),
  zadd: vi.fn().mockResolvedValue(1),
  zrevrange: vi.fn().mockResolvedValue([]),
  zcard: vi.fn().mockResolvedValue(0),
  zrem: vi.fn().mockResolvedValue(1),
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
    vi.useRealTimers();
    mockRedisInstance.rpush.mockReset().mockResolvedValue(1);
    mockRedisInstance.llen.mockReset().mockResolvedValue(0);
    mockRedisInstance.zadd.mockReset().mockResolvedValue(1);
    mockRedisInstance.zrevrange.mockReset().mockResolvedValue([]);
    mockRedisInstance.zcard.mockReset().mockResolvedValue(0);
    mockRedisInstance.zrem.mockReset().mockResolvedValue(1);
    mockRedisInstance.publish.mockReset().mockResolvedValue(1);
    mockRedisInstance.subscribe.mockReset().mockResolvedValue(undefined);
    mockRedisInstance.on.mockReset();
    mockRedisInstance.quit.mockReset().mockResolvedValue('OK');
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

  it('should retry publishJob with exponential backoff before succeeding', async () => {
    vi.useFakeTimers();
    mockRedisInstance.rpush
      .mockRejectedValueOnce(new Error('redis timeout 1'))
      .mockRejectedValueOnce(new Error('redis timeout 2'))
      .mockResolvedValueOnce(1);

    const publishPromise = client.publishJob({
      type: 'scrape',
      reportId: 11,
      triggerType: 'manual',
      traceContext: { org_id: '7' },
    }).catch((error) => {
      throw error;
    });

    await Promise.resolve();
    expect(mockRedisInstance.rpush).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(mockRedisInstance.rpush).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await Promise.resolve();
    expect(mockRedisInstance.rpush).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1999);
    expect(mockRedisInstance.rpush).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1);
    await Promise.resolve();

    await expect(publishPromise).resolves.toBe(1);
    expect(mockRedisInstance.rpush).toHaveBeenCalledTimes(3);
  });

  it('should move publishJob payload to DLQ after terminal enqueue failures', async () => {
    vi.useFakeTimers();
    mockRedisInstance.rpush.mockRejectedValue(new Error('redis hard failure'));

    const publishPromise = client.publishJob({
      type: 'scrape',
      reportId: 12,
      triggerType: 'manual',
      options: { cinemaId: 'C1234' },
      traceContext: { org_id: '7', org_slug: 'acme' },
    });
    const rejectionExpectation = expect(publishPromise).rejects.toThrow('redis hard failure');

    await Promise.resolve();
    expect(mockRedisInstance.rpush).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    await Promise.resolve();
    expect(mockRedisInstance.rpush).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(2000);
    await Promise.resolve();

    await rejectionExpectation;
    expect(mockRedisInstance.rpush).toHaveBeenCalledTimes(3);
    expect(mockRedisInstance.zadd).toHaveBeenCalledWith(
      'scrape:jobs:dlq',
      expect.any(Number),
      expect.stringContaining('"reportId":12')
    );
    expect(mockRedisInstance.zadd).toHaveBeenCalledWith(
      'scrape:jobs:dlq',
      expect.any(Number),
      expect.stringContaining('"retry_count":3')
    );
  });

  it('should retry publishAddCinemaJob with the same backoff contract', async () => {
    vi.useFakeTimers();
    mockRedisInstance.rpush
      .mockRejectedValueOnce(new Error('redis timeout 1'))
      .mockRejectedValueOnce(new Error('redis timeout 2'))
      .mockResolvedValueOnce(1);

    const publishPromise = client.publishAddCinemaJob(42, 'http://test', { org_id: '5' }).catch((error) => {
      throw error;
    });

    await Promise.resolve();
    expect(mockRedisInstance.rpush).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    await Promise.resolve();
    expect(mockRedisInstance.rpush).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(2000);
    await Promise.resolve();

    await expect(publishPromise).resolves.toBe(1);
    expect(mockRedisInstance.rpush).toHaveBeenCalledTimes(3);
  });

  it('should get queue depth', async () => {
    await client.getQueueDepth();
    expect(mockRedisInstance.llen).toHaveBeenCalledWith('scrape:jobs');
  });

  it('should persist terminally failed jobs in the scraper DLQ', async () => {
    const timestamp = '2026-04-21T18:00:00.000Z';

    await client.moveJobToDlq({
      job: {
        type: 'scrape',
        triggerType: 'manual',
        reportId: 1,
        options: { cinemaId: 'C1234' },
        traceContext: { org_id: '77', org_slug: 'acme' },
      },
      failureReason: 'boom',
      retryCount: 3,
      timestamp,
    });

    expect(mockRedisInstance.zadd).toHaveBeenCalledWith(
      'scrape:jobs:dlq',
      expect.any(Number),
      expect.stringContaining('"job_id":"report-1"')
    );
    expect(mockRedisInstance.zadd).toHaveBeenCalledWith(
      'scrape:jobs:dlq',
      expect.any(Number),
      expect.stringContaining('"failure_reason":"boom"')
    );
    expect(mockRedisInstance.zadd).toHaveBeenCalledWith(
      'scrape:jobs:dlq',
      expect.any(Number),
      expect.stringContaining('"cinema_id":"C1234"')
    );
    expect(mockRedisInstance.zadd).toHaveBeenCalledWith(
      'scrape:jobs:dlq',
      expect.any(Number),
      expect.stringContaining('"org_id":"77"')
    );
  });

  it('should list DLQ jobs newest first with pagination metadata', async () => {
    mockRedisInstance.zrevrange.mockResolvedValueOnce([
      JSON.stringify({ job_id: 'job-2', timestamp: '2026-04-21T19:00:00.000Z' }),
      JSON.stringify({ job_id: 'job-1', timestamp: '2026-04-21T18:00:00.000Z' }),
    ]);
    mockRedisInstance.zcard.mockResolvedValueOnce(2);

    const result = await client.listDlqJobs(2, 1);

    expect(mockRedisInstance.zrevrange).toHaveBeenCalledWith('scrape:jobs:dlq', 0, -1);
    expect(result).toEqual({
      jobs: [
        { job_id: 'job-2', timestamp: '2026-04-21T19:00:00.000Z' },
        { job_id: 'job-1', timestamp: '2026-04-21T18:00:00.000Z' },
      ],
      total: 2,
      page: 1,
      pageSize: 2,
    });
  });

  it('should requeue a DLQ job and remove it from DLQ', async () => {
    const dlqEntry = {
      job_id: 'report-2',
      retry_count: 3,
      job: {
        type: 'scrape',
        triggerType: 'manual',
        reportId: 2,
      },
    };

    mockRedisInstance.zrevrange.mockResolvedValueOnce([JSON.stringify(dlqEntry)]);

    await client.retryDlqJob('report-2');

    expect(mockRedisInstance.rpush).toHaveBeenCalledWith(
      'scrape:jobs',
      expect.stringContaining('"retryCount":0')
    );
    expect(mockRedisInstance.zrem).toHaveBeenCalledWith('scrape:jobs:dlq', JSON.stringify(dlqEntry));
    expect(mockRedisInstance.rpush).toHaveBeenCalledWith(
      'scrape:jobs',
      expect.stringContaining('"retryCount":0')
    );
  });

  it('should return null when retrying a missing DLQ job', async () => {
    mockRedisInstance.zrevrange.mockResolvedValueOnce([]);

    const result = await client.retryDlqJob('missing-job');

    expect(result).toBeNull();
    expect(mockRedisInstance.rpush).not.toHaveBeenCalledWith('scrape:jobs', expect.any(String));
  });

  it('should filter DLQ jobs by org for tenant-scoped callers', async () => {
    mockRedisInstance.zrevrange.mockResolvedValueOnce([
      JSON.stringify({ job_id: 'job-2', org_id: '8', timestamp: '2026-04-21T19:00:00.000Z' }),
      JSON.stringify({ job_id: 'job-1', org_id: '7', timestamp: '2026-04-21T18:00:00.000Z' }),
    ]);
    mockRedisInstance.zcard.mockResolvedValueOnce(2);

    const result = await client.listDlqJobs(50, 1, 7);

    expect(result).toEqual({
      jobs: [
        { job_id: 'job-1', org_id: '7', timestamp: '2026-04-21T18:00:00.000Z' },
      ],
      total: 1,
      page: 1,
      pageSize: 50,
    });
  });

  it('should refuse to retry a DLQ job from another org', async () => {
    mockRedisInstance.zrevrange.mockResolvedValueOnce([
      JSON.stringify({
        job_id: 'report-2',
        org_id: '8',
        retry_count: 3,
        job: {
          type: 'scrape',
          triggerType: 'manual',
          reportId: 2,
        },
      }),
    ]);

    const result = await client.retryDlqJob('report-2', 7);

    expect(result).toBeNull();
    expect(mockRedisInstance.rpush).not.toHaveBeenCalled();
    expect(mockRedisInstance.zrem).not.toHaveBeenCalled();
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
