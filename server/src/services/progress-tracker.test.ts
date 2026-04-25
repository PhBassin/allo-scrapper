import { describe, expect, it } from 'vitest';
import { ProgressTracker } from './progress-tracker.js';

describe('ProgressTracker', () => {
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
});
