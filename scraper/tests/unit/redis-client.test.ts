import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock ioredis using vi.hoisted() to ensure variables are available before
// module hoisting resolves imports.
// ---------------------------------------------------------------------------

const { mockPublish, mockQuit, mockBlpop, mockLpop, MockRedis } = vi.hoisted(() => {
  const mockPublish = vi.fn().mockResolvedValue(1);
  const mockQuit = vi.fn().mockResolvedValue('OK');
  const mockBlpop = vi.fn().mockResolvedValue(null);
  const mockLpop = vi.fn().mockResolvedValue(null);

  class MockRedis {
    publish = mockPublish;
    quit = mockQuit;
    blpop = mockBlpop;
    lpop = mockLpop;
    on = vi.fn();
  }

  return { mockPublish, mockQuit, mockBlpop, mockLpop, MockRedis };
});

vi.mock('ioredis', () => ({
  default: MockRedis,
}));

import { RedisProgressPublisher, RedisJobConsumer, type ScrapeJob } from '../../../src/redis/client.js';

describe('RedisProgressPublisher', () => {
  let publisher: RedisProgressPublisher;

  beforeEach(() => {
    vi.clearAllMocks();
    publisher = new RedisProgressPublisher('redis://localhost:6379');
  });

  it('publishes progress events to scrape:progress channel', async () => {
    const event = { type: 'started' as const, total_cinemas: 3, total_dates: 7 };
    await publisher.emit(event);

    expect(mockPublish).toHaveBeenCalledWith('scrape:progress', JSON.stringify(event));
  });

  it('publishes completed event with summary', async () => {
    const event = {
      type: 'completed' as const,
      summary: {
        total_cinemas: 2,
        successful_cinemas: 2,
        failed_cinemas: 0,
        total_films: 10,
        total_showtimes: 50,
        total_dates: 7,
        duration_ms: 5000,
        errors: [],
      },
    };
    await publisher.emit(event);

    expect(mockPublish).toHaveBeenCalledWith('scrape:progress', JSON.stringify(event));
  });

  it('disconnects cleanly', async () => {
    await publisher.disconnect();
    expect(mockQuit).toHaveBeenCalledOnce();
  });
});

describe('RedisJobConsumer', () => {
  let consumer: RedisJobConsumer;

  beforeEach(() => {
    vi.clearAllMocks();
    consumer = new RedisJobConsumer('redis://localhost:6379');
  });

  it('stops cleanly', async () => {
    consumer.stop();
    await consumer.disconnect();
    expect(mockQuit).toHaveBeenCalled();
  });

  it('does not call handler when queue is empty (BLPOP timeout)', async () => {
    const handler = vi.fn();

    // Make blpop return null once, then consumer.stop() is called to break the loop
    mockBlpop.mockImplementation(async () => {
      consumer.stop();
      return null;
    });

    await consumer.start(handler);

    expect(handler).not.toHaveBeenCalled();
  });

  it('passes org_slug to handler when present in job', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const job: ScrapeJob = {
      type: 'scrape',
      reportId: 42,
      triggerType: 'manual',
      org_slug: 'cinema-test',
    };

    mockBlpop.mockImplementationOnce(async () => ['scrape:jobs', JSON.stringify(job)]);
    mockBlpop.mockImplementationOnce(async () => { consumer.stop(); return null; });

    await consumer.start(handler);

    expect(handler).toHaveBeenCalledOnce();
    const receivedJob = handler.mock.calls[0][0] as ScrapeJob;
    expect(receivedJob.org_slug).toBe('cinema-test');
  });

  it('handles job without org_slug (standalone mode, backward compat)', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const job: ScrapeJob = {
      type: 'scrape',
      reportId: 1,
      triggerType: 'cron',
      // org_slug intentionally absent
    };

    mockBlpop.mockImplementationOnce(async () => ['scrape:jobs', JSON.stringify(job)]);
    mockBlpop.mockImplementationOnce(async () => { consumer.stop(); return null; });

    await consumer.start(handler);

    expect(handler).toHaveBeenCalledOnce();
    const receivedJob = handler.mock.calls[0][0] as ScrapeJob;
    expect(receivedJob.org_slug).toBeUndefined();
  });
});
