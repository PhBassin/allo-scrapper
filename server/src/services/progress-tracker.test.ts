import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProgressTracker } from './progress-tracker.js';

describe('ProgressTracker', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('enriches SSE payloads with listener trace context', () => {
    const tracker = new ProgressTracker();
    const writes: string[] = [];

    const listener = {
      write: (chunk: string) => {
        writes.push(chunk);
      },
      end: () => {},
    } as any;

    tracker.addListener(listener, {
      org_id: '9',
      org_slug: 'acme',
      user_id: '55',
      endpoint: '/api/scraper/progress',
      method: 'GET',
    });

    tracker.emit({
      type: 'started',
      report_id: 1,
      total_cinemas: 1,
      total_dates: 2,
      traceContext: { org_slug: 'acme' },
    });

    expect(writes.length).toBe(1);
    const payload = writes[0].replace(/^data:\s*/, '').trim();
    const parsed = JSON.parse(payload);

    expect(parsed.type).toBe('started');
    expect(parsed.traceContext).toEqual(expect.objectContaining({
      org_id: '9',
      org_slug: 'acme',
      user_id: '55',
      endpoint: '/api/scraper/progress',
      method: 'GET',
    }));
  });

  it('replays only matching tenant events to a tenant listener', () => {
    const tracker = new ProgressTracker();

    tracker.emit({
      type: 'started',
      report_id: 10,
      total_cinemas: 1,
      total_dates: 1,
      traceContext: { org_slug: 'acme' },
    });
    tracker.emit({
      type: 'started',
      report_id: 11,
      total_cinemas: 1,
      total_dates: 1,
      traceContext: { org_slug: 'other' },
    });

    const writes: string[] = [];
    const listener = {
      write: (chunk: string) => {
        writes.push(chunk);
      },
      end: () => {},
    } as any;

    tracker.addListener(listener, { org_slug: 'acme' });

    expect(writes).toHaveLength(1);
    const payload = JSON.parse(writes[0].replace(/^data:\s*/, '').trim());
    expect(payload.report_id).toBe(10);
  });

  it('forwards only matching tenant events to connected listeners', () => {
    const tracker = new ProgressTracker();
    const writes: string[] = [];

    const listener = {
      write: (chunk: string) => {
        writes.push(chunk);
      },
      end: () => {},
    } as any;

    tracker.addListener(listener, { org_slug: 'acme' });
    tracker.emit({
      type: 'started',
      report_id: 10,
      total_cinemas: 1,
      total_dates: 1,
      traceContext: { org_slug: 'other' },
    });
    tracker.emit({
      type: 'started',
      report_id: 11,
      total_cinemas: 2,
      total_dates: 3,
      traceContext: { org_slug: 'acme' },
    });

    expect(writes).toHaveLength(1);
    const payload = JSON.parse(writes[0].replace(/^data:\s*/, '').trim());
    expect(payload.report_id).toBe(11);
  });

  it('emits JSON ping heartbeats every 30 seconds without polluting replay history', () => {
    vi.useFakeTimers();

    const tracker = new ProgressTracker();
    const writes: string[] = [];
    const listener = {
      write: (chunk: string) => {
        writes.push(chunk);
      },
      end: () => {},
    } as any;

    tracker.addListener(listener);

    vi.advanceTimersByTime(30000);

    expect(writes).toHaveLength(1);
    const ping = JSON.parse(writes[0].replace(/^data:\s*/, '').trim());
    expect(ping).toEqual({
      type: 'ping',
      timestamp: expect.any(String),
    });
    expect(tracker.getEvents()).toEqual([]);
  });

  it('sends heartbeat pings to tenant-scoped listeners', () => {
    vi.useFakeTimers();

    const tracker = new ProgressTracker();
    const writes: string[] = [];
    const listener = {
      write: (chunk: string) => {
        writes.push(chunk);
      },
      end: () => {},
    } as any;

    tracker.addListener(listener, { org_slug: 'acme' });

    vi.advanceTimersByTime(30000);

    expect(writes).toHaveLength(1);
    const ping = JSON.parse(writes[0].replace(/^data:\s*/, '').trim());
    expect(ping.type).toBe('ping');
  });

  it('does not replay past heartbeat pings to a new listener', () => {
    vi.useFakeTimers();

    const tracker = new ProgressTracker();
    const firstWrites: string[] = [];
    const firstListener = {
      write: (chunk: string) => {
        firstWrites.push(chunk);
      },
      end: () => {},
    } as any;

    tracker.addListener(firstListener);
    vi.advanceTimersByTime(30000);

    const replayWrites: string[] = [];
    const replayListener = {
      write: (chunk: string) => {
        replayWrites.push(chunk);
      },
      end: () => {},
    } as any;

    tracker.addListener(replayListener);

    expect(firstWrites).toHaveLength(1);
    expect(replayWrites).toHaveLength(0);
  });

  it('closes an idle listener after 15 minutes without business activity', () => {
    vi.useFakeTimers();

    const tracker = new ProgressTracker();
    const end = vi.fn();
    const listener = {
      write: vi.fn(),
      end,
    } as any;

    tracker.addListener(listener);

    vi.advanceTimersByTime(15 * 60 * 1000);

    expect(end).toHaveBeenCalledTimes(1);
    expect(tracker.getListenerCount()).toBe(0);
  });

  it('keeps a listener open while any scrape job is still active', () => {
    vi.useFakeTimers();

    const tracker = new ProgressTracker();
    const end = vi.fn();
    const listener = {
      write: vi.fn(),
      end,
    } as any;

    tracker.addListener(listener);
    tracker.emit({
      type: 'started',
      report_id: 1,
      total_cinemas: 1,
      total_dates: 1,
    });

    vi.advanceTimersByTime(20 * 60 * 1000);

    expect(end).not.toHaveBeenCalled();
    expect(tracker.getListenerCount()).toBe(1);
  });

  it('still closes an idle tenant listener when only another tenant has active jobs', () => {
    vi.useFakeTimers();

    const tracker = new ProgressTracker();
    const end = vi.fn();
    const listener = {
      write: vi.fn(),
      end,
    } as any;

    tracker.addListener(listener, { org_slug: 'acme' });
    tracker.emit({
      type: 'started',
      report_id: 1,
      total_cinemas: 1,
      total_dates: 1,
      traceContext: { org_slug: 'other' },
    });

    vi.advanceTimersByTime(15 * 60 * 1000);

    expect(end).toHaveBeenCalledTimes(1);
    expect(tracker.getListenerCount()).toBe(0);
  });

  it('keeps an active listener open when business events continue within the idle window', () => {
    vi.useFakeTimers();

    const tracker = new ProgressTracker();
    const end = vi.fn();
    const listener = {
      write: vi.fn(),
      end,
    } as any;

    tracker.addListener(listener);

    vi.advanceTimersByTime(14 * 60 * 1000);
    tracker.emit({
      type: 'started',
      report_id: 1,
      total_cinemas: 1,
      total_dates: 1,
    });
    vi.advanceTimersByTime(2 * 60 * 1000);

    expect(end).not.toHaveBeenCalled();
    expect(tracker.getListenerCount()).toBe(1);
  });
});
