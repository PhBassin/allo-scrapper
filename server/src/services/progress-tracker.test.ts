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

    tracker.emit({ type: 'started', total_cinemas: 1, total_dates: 2 });

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
});
