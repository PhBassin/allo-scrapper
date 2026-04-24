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
const connectMock = vi.fn();
const loggerWarnMock = vi.fn();
const loggerErrorMock = vi.fn();
const redisEventHandlers: Record<string, Array<(...args: any[]) => void>> = {};

function emitRedisEvent(event: string, ...args: any[]): void {
  for (const redisInstance of redisInstances as Array<{ status?: string }>) {
    if (event === 'close') redisInstance.status = 'close';
    if (event === 'reconnecting') redisInstance.status = 'reconnecting';
    if (event === 'ready') redisInstance.status = 'ready';
    if (event === 'end') redisInstance.status = 'end';
  }

  for (const handler of redisEventHandlers[event] ?? []) {
    handler(...args);
  }
}

async function waitForExpectation(assertion: () => void, attempts: number = 20): Promise<void> {
  let lastError: unknown;

  for (let index = 0; index < attempts; index += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await Promise.resolve();
    }
  }

  throw lastError;
}

vi.mock('ioredis', () => {
  class MockRedis {
    subscribe = subscribeMock;
    quit = quitMock;
    blpop = blpopMock;
    lpop = lpopMock;
    rpush = rpushMock;
    publish = publishMock;
    zadd = zaddMock;
    connect = connectMock;
    status = 'ready';

    constructor() {
      redisInstances.push(this);
    }

    on(event: string, handler: (...args: any[]) => void) {
      onMock(event, handler);
      redisEventHandlers[event] ??= [];
      redisEventHandlers[event].push(handler);
      return this;
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
    connectMock.mockReset().mockResolvedValue(undefined);
    for (const key of Object.keys(redisEventHandlers)) {
      delete redisEventHandlers[key];
    }
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
    const onTerminalFailure = vi.fn().mockResolvedValue(undefined);

    await consumer.start(async () => {
      consumer.stop();
      throw new Error('terminal failure');
    }, {
      onTerminalFailure,
    });

    expect(onTerminalFailure).toHaveBeenCalledWith(
      expect.objectContaining({ reportId: 93, retryCount: 3 }),
      'terminal failure'
    );

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

    await waitForExpectation(() => {
      expect(zaddMock).toHaveBeenCalledTimes(1);
    });

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

  it('requeues a staged in-flight job after Redis reconnect using the recovery job builder', async () => {
    const { RedisJobConsumer } = await import('./client.js');

    const activeJob = {
      type: 'scrape',
      triggerType: 'manual',
      reportId: 120,
      traceContext: {
        org_id: '42',
      },
    };

    const consumer = new RedisJobConsumer('redis://localhost:6379');
    const buildRecoveryJob = vi.fn(async (job) => ({
      ...job,
      options: {
        resumeMode: true,
        pendingAttempts: [{ cinema_id: 'C0001', date: '2026-04-23' }],
      },
    }));

    expect(rpushMock).not.toHaveBeenCalled();

    consumer['buildRecoveryJobCallback'] = buildRecoveryJob;
    consumer['pendingRecoveredJobs'].set('report-120', activeJob);
    consumer['reconnecting'] = true;
    consumer['clientReady'].blocking = false;
    consumer['clientReady'].command = false;

    emitRedisEvent('ready');
    emitRedisEvent('ready');

    await waitForExpectation(() => {
      expect(rpushMock).toHaveBeenCalledWith(
        'scrape:jobs',
        expect.stringContaining('"resumeMode":true')
      );
      expect(rpushMock).toHaveBeenCalledWith(
        'scrape:jobs',
        expect.stringContaining('"pendingAttempts":[{"cinema_id":"C0001","date":"2026-04-23"}]')
      );
    });
  });

  it('does not mark an in-flight job as failed during reconnect before recovery completes', async () => {
    const { RedisJobConsumer } = await import('./client.js');

    const activeJob = {
      type: 'scrape',
      triggerType: 'manual',
      reportId: 121,
    };

    blpopMock
      .mockResolvedValueOnce(['scrape:jobs', JSON.stringify(activeJob)])
      .mockImplementationOnce(() => new Promise(() => {}));

    const consumer = new RedisJobConsumer('redis://localhost:6379');

    const startPromise = consumer.start(async () => {
      emitRedisEvent('close');
      emitRedisEvent('reconnecting', 1000);
      throw new Error('redis connection dropped');
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(zaddMock).not.toHaveBeenCalled();
    expect(loggerErrorMock).not.toHaveBeenCalledWith(
      '[RedisJobConsumer] Job handler failed',
      expect.anything()
    );

    consumer.stop();
    await consumer.disconnect();
    await startPromise;
  });

  it('moves tracked in-flight jobs to DLQ when reconnect attempts are exhausted', async () => {
    const { RedisJobConsumer } = await import('./client.js');

    const activeJob = {
      type: 'scrape',
      triggerType: 'manual',
      reportId: 122,
      traceContext: {
        org_id: '42',
      },
    };

    blpopMock
      .mockResolvedValueOnce(['scrape:jobs', JSON.stringify(activeJob)])
      .mockImplementationOnce(() => new Promise(() => {}));

    const consumer = new RedisJobConsumer('redis://localhost:6379');
    const onTerminalFailure = vi.fn().mockResolvedValue(undefined);

    const startPromise = consumer.start(async () => {
      emitRedisEvent('close');
      emitRedisEvent('reconnecting', 1000);
      emitRedisEvent('end');
      throw new Error('redis connection dropped permanently');
    }, {
      onTerminalFailure,
    });

    await waitForExpectation(() => {
      expect(zaddMock).toHaveBeenCalledWith(
        'scrape:jobs:dlq',
        expect.any(Number),
        expect.stringContaining('Redis reconnect exhausted after 3 attempts')
      );
    });

    consumer.stop();
    await startPromise;

    expect(zaddMock).toHaveBeenCalledWith(
      'scrape:jobs:dlq',
      expect.any(Number),
      expect.stringContaining('"reportId":122')
    );
    expect(onTerminalFailure).toHaveBeenCalledWith(
      expect.objectContaining({ reportId: 122 }),
      'Redis reconnect exhausted after 3 attempts'
    );
  });
});
