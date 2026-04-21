import { beforeEach, describe, expect, it, vi } from 'vitest';

const redisInstances: Array<{
  subscribe: typeof subscribeMock;
  on: typeof onMock;
  quit: typeof quitMock;
  blpop: typeof blpopMock;
  lpop: typeof lpopMock;
  rpush: typeof rpushMock;
  publish: typeof publishMock;
  zadd: typeof zaddMock;
}> = [];

const subscribeMock = vi.fn();
const onMock = vi.fn();
const quitMock = vi.fn();
const blpopMock = vi.fn();
const publishMock = vi.fn();
const lpopMock = vi.fn();
const zaddMock = vi.fn();
const rpushMock = vi.fn();
const loggerWarnMock = vi.fn();
const loggerErrorMock = vi.fn();

vi.mock('ioredis', () => {
  class MockRedis {
    subscribe = subscribeMock;
    on = onMock;
    quit = quitMock;
    blpop = blpopMock;
    lpop = lpopMock;
    rpush = rpushMock;
    publish = publishMock;
    zadd = zaddMock;

    constructor() {
      redisInstances.push(this);
    }
  }

  return {
    default: MockRedis,
  };
});

const loggerInfoMock = vi.fn();

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: (...args: unknown[]) => loggerInfoMock(...args),
    warn: (...args: unknown[]) => loggerWarnMock(...args),
    error: (...args: unknown[]) => loggerErrorMock(...args),
    debug: vi.fn(),
  },
}));

describe('scraper redis client trace context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    redisInstances.length = 0;
    loggerInfoMock.mockReset();
    loggerWarnMock.mockReset();
    loggerErrorMock.mockReset();
    blpopMock.mockReset();
    lpopMock.mockReset();
    publishMock.mockReset();
    zaddMock.mockReset();
    rpushMock.mockReset();
  });

  it('keeps traceContext metadata when parsing queued jobs', async () => {
    const { RedisJobConsumer } = await import('./client.js');

    const traceJob = {
      type: 'scrape',
      triggerType: 'manual',
      reportId: 91,
      traceContext: {
        org_id: '42',
        org_slug: 'acme',
        user_id: '7',
        endpoint: '/api/org/acme/scraper/trigger',
        method: 'POST',
      },
    };

    blpopMock
      .mockResolvedValueOnce(['scrape:jobs', JSON.stringify(traceJob)])
      .mockResolvedValueOnce(null);

    const consumer = new RedisJobConsumer('redis://localhost:6379');
    const handler = vi.fn(async () => {
      consumer.stop();
    });

    await consumer.start(handler);

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      reportId: 91,
      traceContext: expect.objectContaining({
        org_id: '42',
        org_slug: 'acme',
        user_id: '7',
      }),
    }));

    expect(loggerInfoMock).toHaveBeenCalledWith(
      '[RedisJobConsumer] Job trace context',
      expect.objectContaining({
        org_id: '42',
        org_slug: 'acme',
        user_id: '7',
        endpoint: '/api/org/acme/scraper/trigger',
      })
    );
  });

  it('keeps traceparent metadata when parsing queued jobs', async () => {
    const { RedisJobConsumer } = await import('./client.js');

    const traceJob = {
      type: 'scrape',
      triggerType: 'manual',
      reportId: 92,
      traceContext: {
        org_id: '42',
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      },
    };

    blpopMock
      .mockResolvedValueOnce(['scrape:jobs', JSON.stringify(traceJob)])
      .mockResolvedValueOnce(null);

    const consumer = new RedisJobConsumer('redis://localhost:6379');
    const handler = vi.fn(async () => {
      consumer.stop();
    });

    await consumer.start(handler);

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      reportId: 92,
      traceContext: expect.objectContaining({
        org_id: '42',
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      }),
    }));
  });

  it('moves jobs to the scraper DLQ after terminal failures', async () => {
    const { RedisJobConsumer } = await import('./client.js');

    const dlqCandidate = {
      type: 'scrape',
      triggerType: 'manual',
      reportId: 93,
      retryCount: 2,
      options: { cinemaId: 'C0042' },
      traceContext: {
        org_id: '42',
        org_slug: 'acme',
      },
    };

    blpopMock
      .mockResolvedValueOnce(['scrape:jobs', JSON.stringify(dlqCandidate)])
      .mockResolvedValueOnce(null);

    const consumer = new RedisJobConsumer('redis://localhost:6379');

    await consumer.start(async () => {
      consumer.stop();
      throw new Error('terminal failure');
    });

    expect(zaddMock).toHaveBeenCalledWith(
      'scrape:jobs:dlq',
      expect.any(Number),
      expect.stringContaining('"retry_count":3')
    );
    expect(zaddMock).toHaveBeenCalledWith(
      'scrape:jobs:dlq',
      expect.any(Number),
      expect.stringContaining('"failure_reason":"terminal failure"')
    );
    expect(zaddMock).toHaveBeenCalledWith(
      'scrape:jobs:dlq',
      expect.any(Number),
      expect.stringContaining('"org_id":"42"')
    );
  });

  it('requeues failed jobs only after exponential backoff', async () => {
    vi.useFakeTimers();

    const { RedisJobConsumer } = await import('./client.js');

    const retryCandidate = {
      type: 'scrape',
      triggerType: 'manual',
      reportId: 94,
      retryCount: 0,
      traceContext: {
        org_id: '42',
      },
    };

    blpopMock
      .mockResolvedValueOnce(['scrape:jobs', JSON.stringify(retryCandidate)])
      .mockResolvedValueOnce(null);

    const consumer = new RedisJobConsumer('redis://localhost:6379');

    const startPromise = consumer.start(async () => {
      consumer.stop();
      throw new Error('retryable failure');
    });

    await Promise.resolve();
    expect(rpushMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(999);
    expect(rpushMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await Promise.resolve();
    await startPromise;

    expect(rpushMock).toHaveBeenCalledWith(
      'scrape:jobs',
      expect.stringContaining('"retryCount":1')
    );
  });

  it('uses a non-blocking Redis connection for delayed retries', async () => {
    vi.useFakeTimers();

    const { RedisJobConsumer } = await import('./client.js');

    const retryCandidate = {
      type: 'scrape',
      triggerType: 'manual',
      reportId: 98,
      retryCount: 0,
    };

    let releaseBlockingPop: (() => void) | null = null;

    blpopMock
      .mockResolvedValueOnce(['scrape:jobs', JSON.stringify(retryCandidate)])
      .mockImplementationOnce(() => new Promise((resolve) => {
        releaseBlockingPop = () => resolve(null);
      }))
      .mockResolvedValueOnce(null);

    const consumer = new RedisJobConsumer('redis://localhost:6379');

    const startPromise = consumer.start(async () => {
      throw new Error('retryable failure');
    });

    await Promise.resolve();
    expect(redisInstances).toHaveLength(2);
    expect(rpushMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    await Promise.resolve();

    expect(rpushMock).toHaveBeenCalledTimes(1);
    expect(redisInstances[0].blpop).toBe(blpopMock);
    expect(redisInstances[1].rpush).toBe(rpushMock);

    consumer.stop();
    releaseBlockingPop?.();
    await consumer.disconnect();
    await startPromise;
  });

  it('uses the shared retry schedule when requeue persistence fails', async () => {
    vi.useFakeTimers();

    const { RedisJobConsumer } = await import('./client.js');

    const retryCandidate = {
      type: 'scrape',
      triggerType: 'manual',
      reportId: 96,
      retryCount: 0,
      traceContext: {
        org_id: '42',
      },
    };

    blpopMock
      .mockResolvedValueOnce(['scrape:jobs', JSON.stringify(retryCandidate)])
      .mockResolvedValueOnce(null);
    rpushMock
      .mockRejectedValueOnce(new Error('redis write failed'))
      .mockResolvedValueOnce(1);

    const consumer = new RedisJobConsumer('redis://localhost:6379');

    const startPromise = consumer.start(async () => {
      consumer.stop();
      throw new Error('retryable failure');
    });

    await Promise.resolve();
    expect(rpushMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    await Promise.resolve();
    expect(rpushMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(rpushMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await Promise.resolve();
    await startPromise;

    expect(rpushMock).toHaveBeenCalledTimes(2);
    expect(loggerErrorMock).toHaveBeenCalledWith(
      '[RedisJobConsumer] Failed to requeue job after handler failure',
      expect.objectContaining({
        job_id: 'report-96',
        retry_count: 1,
        persistence_attempt: 1,
      })
    );
  });

  it('does not requeue jobs after terminal retry threshold', async () => {
    vi.useFakeTimers();

    const { RedisJobConsumer } = await import('./client.js');

    const dlqCandidate = {
      type: 'scrape',
      triggerType: 'manual',
      reportId: 95,
      retryCount: 2,
      traceContext: {
        org_id: '42',
      },
    };

    blpopMock
      .mockResolvedValueOnce(['scrape:jobs', JSON.stringify(dlqCandidate)])
      .mockResolvedValueOnce(null);

    const consumer = new RedisJobConsumer('redis://localhost:6379');

    await consumer.start(async () => {
      consumer.stop();
      throw new Error('terminal failure');
    });

    expect(rpushMock).not.toHaveBeenCalled();
    expect(zaddMock).toHaveBeenCalledWith(
      'scrape:jobs:dlq',
      expect.any(Number),
      expect.stringContaining('"retry_count":3')
    );
  });

  it('keeps retrying DLQ persistence when terminal failure recording hits Redis errors', async () => {
    vi.useFakeTimers();

    const { RedisJobConsumer } = await import('./client.js');

    const dlqCandidate = {
      type: 'scrape',
      triggerType: 'manual',
      reportId: 97,
      retryCount: 2,
      traceContext: {
        org_id: '42',
      },
    };

    blpopMock
      .mockResolvedValueOnce(['scrape:jobs', JSON.stringify(dlqCandidate)])
      .mockResolvedValueOnce(null);
    zaddMock
      .mockRejectedValueOnce(new Error('redis dlq write failed'))
      .mockResolvedValueOnce(1);

    const consumer = new RedisJobConsumer('redis://localhost:6379');

    const startPromise = consumer.start(async () => {
      consumer.stop();
      throw new Error('terminal failure');
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(zaddMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(zaddMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await Promise.resolve();
    await startPromise;

    expect(zaddMock).toHaveBeenCalledTimes(2);
    expect(loggerErrorMock).toHaveBeenCalledWith(
      '[RedisJobConsumer] Failed to persist terminal job to DLQ',
      expect.objectContaining({
        job_id: 'report-97',
        retry_count: 3,
        persistence_attempt: 1,
      })
    );
  });

  it('cancels pending retry waits during disconnect', async () => {
    vi.useFakeTimers();

    const { RedisJobConsumer } = await import('./client.js');

    const retryCandidate = {
      type: 'scrape',
      triggerType: 'manual',
      reportId: 99,
      retryCount: 0,
    };

    blpopMock
      .mockResolvedValueOnce(['scrape:jobs', JSON.stringify(retryCandidate)])
      .mockResolvedValueOnce(null);

    const consumer = new RedisJobConsumer('redis://localhost:6379');

    const startPromise = consumer.start(async () => {
      consumer.stop();
      throw new Error('retryable failure');
    });

    await Promise.resolve();
    await Promise.resolve();
    await consumer.disconnect();
    await startPromise;

    expect(rpushMock).not.toHaveBeenCalled();
    expect(quitMock).toHaveBeenCalledTimes(2);
  });
});
