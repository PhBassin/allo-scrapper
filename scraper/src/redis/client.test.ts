import { beforeEach, describe, expect, it, vi } from 'vitest';

const subscribeMock = vi.fn();
const onMock = vi.fn();
const quitMock = vi.fn();
const blpopMock = vi.fn();
const publishMock = vi.fn();
const lpopMock = vi.fn();
const zaddMock = vi.fn();

vi.mock('ioredis', () => {
  class MockRedis {
    subscribe = subscribeMock;
    on = onMock;
    quit = quitMock;
    blpop = blpopMock;
    lpop = lpopMock;
    publish = publishMock;
    zadd = zaddMock;
  }

  return {
    default: MockRedis,
  };
});

const loggerInfoMock = vi.fn();

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: (...args: unknown[]) => loggerInfoMock(...args),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('scraper redis client trace context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loggerInfoMock.mockReset();
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
});
