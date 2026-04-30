import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProgressTracker } from './progress-tracker.js';

interface ParsedSseFrame {
  id?: string;
  data: Record<string, unknown>;
}

function parseSseFrame(chunk: string): ParsedSseFrame {
  let id: string | undefined;
  const dataLines: string[] = [];

  for (const line of chunk.trimEnd().split(/\r?\n/)) {
    if (line.startsWith('id:')) {
      id = line.slice(3).trimStart();
      continue;
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  return {
    id,
    data: JSON.parse(dataLines.join('\n')) as Record<string, unknown>,
  };
}

function addListenerWithLastEventId(
  tracker: ProgressTracker,
  listener: unknown,
  traceContext: { org_slug?: string } | undefined,
  lastEventId: string,
): void {
  const addListener = tracker.addListener as unknown as (
    res: unknown,
    listenerTrace?: { org_slug?: string },
    resumeAfterEventId?: string,
  ) => void;

  addListener.call(tracker, listener, traceContext, lastEventId);
}

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
    const parsed = parseSseFrame(writes[0]).data;

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
    const payload = parseSseFrame(writes[0]).data;
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
    const payload = parseSseFrame(writes[0]).data;
    expect(payload.report_id).toBe(11);
  });

  it('writes replayable business events with unique monotonically increasing SSE ids', () => {
    const tracker = new ProgressTracker();
    const writes: string[] = [];
    const listener = {
      write: (chunk: string) => {
        writes.push(chunk);
      },
      end: () => {},
    } as any;

    tracker.addListener(listener);
    tracker.emit({
      type: 'started',
      report_id: 1,
      total_cinemas: 1,
      total_dates: 1,
    });
    tracker.emit({
      type: 'cinema_started',
      report_id: 1,
      cinema_name: 'Cinema One',
      cinema_id: 'C1',
      index: 0,
    });

    const frames = writes.map(parseSseFrame);

    expect(frames).toEqual([
      expect.objectContaining({ id: '1', data: expect.objectContaining({ type: 'started' }) }),
      expect.objectContaining({ id: '2', data: expect.objectContaining({ type: 'cinema_started' }) }),
    ]);
    expect(Number(frames[1].id)).toBeGreaterThan(Number(frames[0].id));
    expect(new Set(frames.map((frame) => frame.id)).size).toBe(frames.length);
  });

  it('replays only matching tenant events after the provided Last-Event-ID', () => {
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
    tracker.emit({
      type: 'cinema_started',
      report_id: 10,
      cinema_name: 'Cinema Acme',
      cinema_id: 'C10',
      index: 0,
      traceContext: { org_slug: 'acme' },
    });

    const writes: string[] = [];
    const listener = {
      write: (chunk: string) => {
        writes.push(chunk);
      },
      end: () => {},
    } as any;

    addListenerWithLastEventId(tracker, listener, { org_slug: 'acme' }, '1');

    expect(writes).toHaveLength(1);
    expect(parseSseFrame(writes[0])).toEqual({
      id: '3',
      data: expect.objectContaining({
        type: 'cinema_started',
        report_id: 10,
        traceContext: expect.objectContaining({ org_slug: 'acme' }),
      }),
    });
  });

  it('normalizes invalid and negative Last-Event-ID values to a full tenant-scoped replay', () => {
    const tracker = new ProgressTracker();

    tracker.emit({
      type: 'started',
      report_id: 20,
      total_cinemas: 1,
      total_dates: 1,
      traceContext: { org_slug: 'acme' },
    });

    const writes: string[] = [];
    const listener = {
      write: (chunk: string) => {
        writes.push(chunk);
      },
      end: () => {},
    } as any;

    addListenerWithLastEventId(tracker, listener, { org_slug: 'acme' }, 'not-a-number');
    addListenerWithLastEventId(tracker, listener, { org_slug: 'acme' }, '-7');

    expect(writes).toHaveLength(2);
    expect(parseSseFrame(writes[0])).toEqual({
      id: '1',
      data: expect.objectContaining({ type: 'started', report_id: 20 }),
    });
    expect(parseSseFrame(writes[1])).toEqual({
      id: '1',
      data: expect.objectContaining({ type: 'started', report_id: 20 }),
    });
  });

  it('falls back to a full tenant-scoped replay when Last-Event-ID is ahead of the retained buffer', () => {
    const tracker = new ProgressTracker();

    tracker.emit({
      type: 'started',
      report_id: 21,
      total_cinemas: 1,
      total_dates: 1,
      traceContext: { org_slug: 'acme' },
    });

    const writes: string[] = [];
    const listener = {
      write: (chunk: string) => {
        writes.push(chunk);
      },
      end: () => {},
    } as any;

    addListenerWithLastEventId(tracker, listener, { org_slug: 'acme' }, '999');

    expect(writes).toHaveLength(1);
    expect(parseSseFrame(writes[0])).toEqual({
      id: '1',
      data: expect.objectContaining({ type: 'started', report_id: 21 }),
    });
  });

  it('does not reset the SSE id sequence when a new started event clears replay history', () => {
    const tracker = new ProgressTracker();

    tracker.emit({
      type: 'started',
      report_id: 1,
      total_cinemas: 1,
      total_dates: 1,
    });
    tracker.emit({
      type: 'completed',
      report_id: 1,
      summary: {
        total_cinemas: 1,
        successful_cinemas: 1,
        failed_cinemas: 0,
        total_films: 1,
        total_showtimes: 1,
        total_dates: 1,
        duration_ms: 1,
        errors: [],
      },
    });
    tracker.emit({
      type: 'started',
      report_id: 2,
      total_cinemas: 1,
      total_dates: 1,
    });

    const writes: string[] = [];
    const listener = {
      write: (chunk: string) => {
        writes.push(chunk);
      },
      end: () => {},
    } as any;

    tracker.addListener(listener);

    expect(writes).toHaveLength(1);
    expect(parseSseFrame(writes[0])).toEqual({
      id: '3',
      data: expect.objectContaining({ type: 'started', report_id: 2 }),
    });
    expect(tracker.getEvents()).toEqual([
      expect.objectContaining({ type: 'started', report_id: 2 }),
    ]);
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
    expect(writes[0]).not.toMatch(/^id:/m);
    expect(tracker.getEvents()).toEqual([]);
  });

  it('does not assign heartbeat pings replay ids or consume the next business event id', () => {
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
    tracker.emit({
      type: 'started',
      report_id: 30,
      total_cinemas: 1,
      total_dates: 1,
    });

    expect(writes).toHaveLength(2);
    expect(writes[0]).not.toMatch(/^id:/m);
    expect(parseSseFrame(writes[1])).toEqual({
      id: '1',
      data: expect.objectContaining({ type: 'started', report_id: 30 }),
    });
    expect(tracker.getEvents()).toEqual([
      expect.objectContaining({ type: 'started', report_id: 30 }),
    ]);
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
