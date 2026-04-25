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
});
