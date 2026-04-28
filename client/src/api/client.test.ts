import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet, mockPost, mockPut, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: mockGet,
      post: mockPost,
      put: mockPut,
      delete: mockDelete,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
  },
}));

import {
  getCinemaSchedule,
  getCinemas,
  getReportDetails,
  getScrapeReportById,
  getScrapeReports,
  getScrapeStatus,
  subscribeToProgress,
  triggerCinemaScrape,
  triggerScrape,
} from './client';

describe('Cinema API Client', () => {
  const originalLocation = window.location;
  const originalFetch = globalThis.fetch;
  let mockAbort: ReturnType<typeof vi.fn<() => void>>;
  let lastFetchCall: { input: RequestInfo | URL; init?: RequestInit } | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAbort = vi.fn();
    lastFetchCall = undefined;
    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      lastFetchCall = { input, init };
      const signal = init?.signal as AbortSignal | undefined;
      signal?.addEventListener('abort', () => {
        mockAbort();
      });

      return Promise.resolve({
        ok: true,
        status: 200,
        body: {
          getReader: () => ({
            read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
          }),
        },
      } as unknown as Response);
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    globalThis.fetch = originalFetch;
    window.localStorage.clear();
  });

  it('uses the shared cinemas endpoint outside tenant routes', async () => {
    mockGet.mockResolvedValueOnce({
      data: { success: true, data: [] },
    });

    await getCinemas();

    expect(mockGet).toHaveBeenCalledWith('/cinemas');
  });

  it('uses the tenant-scoped cinemas endpoint on org routes', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/org/acme/cinema/C1234',
      },
    });

    mockGet.mockResolvedValueOnce({
      data: { success: true, data: [] },
    });

    await getCinemas();

    expect(mockGet).toHaveBeenCalledWith('/org/acme/cinemas');
  });

  it('uses the tenant-scoped cinema detail endpoint on org routes', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/org/acme/cinema/C1234',
      },
    });

    mockGet.mockResolvedValueOnce({
      data: { success: true, data: { showtimes: [], weekStart: '2026-04-15' } },
    });

    await getCinemaSchedule('C1234');

    expect(mockGet).toHaveBeenCalledWith('/org/acme/cinemas/C1234');
  });

  it('uses the tenant-scoped scraper trigger endpoint on org routes', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/org/acme/admin',
      },
    });

    mockPost.mockResolvedValueOnce({
      data: { success: true, data: { reportId: 9, message: 'queued' } },
    });

    await triggerScrape();

    expect(mockPost).toHaveBeenCalledWith('/org/acme/scraper/trigger');
  });

  it('uses the tenant-scoped cinema scrape trigger endpoint on org routes', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/org/acme/admin',
      },
    });

    mockPost.mockResolvedValueOnce({
      data: { success: true, data: { reportId: 10, message: 'queued' } },
    });

    await triggerCinemaScrape('C1234');

    expect(mockPost).toHaveBeenCalledWith('/org/acme/scraper/trigger', { cinemaId: 'C1234' });
  });

  it('uses the tenant-scoped scraper status endpoint on org routes', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/org/acme/admin',
      },
    });

    mockGet.mockResolvedValueOnce({
      data: { success: true, data: { isRunning: false } },
    });

    await getScrapeStatus();

    expect(mockGet).toHaveBeenCalledWith('/org/acme/scraper/status');
  });

  it('uses the tenant-scoped reports endpoint on org routes', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/org/acme/admin',
      },
    });

    mockGet.mockResolvedValueOnce({
      data: { success: true, data: { items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 } },
    });

    await getScrapeReports({ page: 1, pageSize: 10 });

    expect(mockGet).toHaveBeenCalledWith('/org/acme/reports', {
      params: { page: 1, pageSize: 10 },
    });
  });

  it('uses the tenant-scoped report detail endpoint on org routes', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/org/acme/admin',
      },
    });

    mockGet.mockResolvedValueOnce({
      data: { success: true, data: { id: 42 } },
    });

    await getScrapeReportById(42);

    expect(mockGet).toHaveBeenCalledWith('/org/acme/reports/42');
  });

  it('uses the tenant-scoped report details endpoint on org routes', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/org/acme/admin',
      },
    });

    mockGet.mockResolvedValueOnce({
      data: { success: true, data: { report: { id: 42 }, attempts: {}, summary: { total_attempts: 0, successful: 0, failed: 0, rate_limited: 0, not_attempted: 0, pending: 0 } } },
    });

    await getReportDetails(42);

    expect(mockGet).toHaveBeenCalledWith('/org/acme/reports/42/details');
  });

  it('uses the tenant-scoped scraper progress SSE endpoint on org routes', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/org/acme/admin',
      },
    });

    window.localStorage.setItem('token', 'jwt-token');

    const unsubscribe = subscribeToProgress(() => {});

    expect(lastFetchCall?.input).toBe('/api/org/acme/scraper/progress');
    expect(lastFetchCall?.init?.headers).toEqual({
      Accept: 'text/event-stream',
      Authorization: 'Bearer jwt-token',
    });

    unsubscribe();
    expect(mockAbort).toHaveBeenCalled();
  });

  it('forwards JSON ping events from the SSE stream', async () => {
    let resolveRead: ((value: { done: boolean; value?: Uint8Array }) => void) | undefined;
    const onEvent = vi.fn();

    globalThis.fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      lastFetchCall = { input: _input, init };
      const signal = init?.signal as AbortSignal | undefined;
      signal?.addEventListener('abort', () => {
        mockAbort();
      });

      return Promise.resolve({
        ok: true,
        status: 200,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockImplementationOnce(() => new Promise((resolve) => {
                resolveRead = resolve;
              }))
              .mockResolvedValueOnce({ done: true, value: undefined }),
          }),
        },
      } as unknown as Response);
    });

    subscribeToProgress(onEvent);
    await Promise.resolve();

    resolveRead?.({
      done: false,
      value: new TextEncoder().encode('data: {"type":"ping","timestamp":"2026-04-28T15:18:00.000Z"}\n\n'),
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(onEvent).toHaveBeenCalledWith({
      type: 'ping',
      timestamp: '2026-04-28T15:18:00.000Z',
    });
  });

  it('reports a clean EOF from the SSE stream as a disconnect error', async () => {
    const onError = vi.fn();

    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      lastFetchCall = { input, init };

      return Promise.resolve({
        ok: true,
        status: 200,
        body: {
          getReader: () => ({
            read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
          }),
        },
      } as unknown as Response);
    });

    subscribeToProgress(() => {}, onError);
    await Promise.resolve();
    await Promise.resolve();

    expect(onError).toHaveBeenCalledWith(new Error('Progress stream closed'));
  });

  it('flushes the final buffered SSE message before reporting EOF', async () => {
    const onEvent = vi.fn();
    const onError = vi.fn();

    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      lastFetchCall = { input, init };

      return Promise.resolve({
        ok: true,
        status: 200,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"type":"ping","timestamp":"2026-04-28T16:10:00.000Z"}'),
              })
              .mockResolvedValueOnce({ done: true, value: undefined }),
          }),
        },
      } as unknown as Response);
    });

    subscribeToProgress(onEvent, onError);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(onEvent).toHaveBeenCalledWith({
      type: 'ping',
      timestamp: '2026-04-28T16:10:00.000Z',
    });
    expect(onError).toHaveBeenCalledWith(new Error('Progress stream closed'));
  });

  it('flushes the final buffered SSE message when UTF-8 data spans chunks before EOF', async () => {
    const onEvent = vi.fn();
    const onError = vi.fn();
    const bytes = new TextEncoder().encode('data: {"type":"ping","timestamp":"2026-04-28T16:10:00.000Z","label":"Cinema Étoile"}');
    const splitAt = bytes.length - 2;

    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      lastFetchCall = { input, init };

      return Promise.resolve({
        ok: true,
        status: 200,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({ done: false, value: bytes.slice(0, splitAt) })
              .mockResolvedValueOnce({ done: false, value: bytes.slice(splitAt) })
              .mockResolvedValueOnce({ done: true, value: undefined }),
          }),
        },
      } as unknown as Response);
    });

    subscribeToProgress(onEvent, onError);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(onEvent).toHaveBeenCalledWith({
      type: 'ping',
      timestamp: '2026-04-28T16:10:00.000Z',
      label: 'Cinema Étoile',
    });
    expect(onError).toHaveBeenCalledWith(new Error('Progress stream closed'));
  });
});
