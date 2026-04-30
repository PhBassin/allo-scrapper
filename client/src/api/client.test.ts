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

  it('reconnects after a clean EOF without surfacing an error', async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    let fetchCallCount = 0;

    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      lastFetchCall = { input, init };

      fetchCallCount++;

      if (fetchCallCount === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          body: {
            getReader: () => ({
              read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
            }),
          },
        } as unknown as Response);
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        body: {
          getReader: () => ({
            read: vi.fn(() => new Promise(() => {
              // Keep the reconnected stream open.
            })),
          }),
        },
      } as unknown as Response);
    });

    subscribeToProgress(() => {}, onError);
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(10);

    expect(onError).not.toHaveBeenCalled();
    expect(fetchCallCount).toBeGreaterThan(1);

    vi.useRealTimers();
  });

  it('flushes the final buffered SSE message before reconnecting on EOF', async () => {
    vi.useFakeTimers();
    const onEvent = vi.fn();
    const onError = vi.fn();
    let fetchCallCount = 0;

    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      lastFetchCall = { input, init };

      fetchCallCount++;

      if (fetchCallCount === 1) {
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
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        body: {
          getReader: () => ({
            read: vi.fn(() => new Promise(() => {
              // Keep the reconnected stream open.
            })),
          }),
        },
      } as unknown as Response);
    });

    subscribeToProgress(onEvent, onError);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(10);

    expect(onEvent).toHaveBeenCalledWith({
      type: 'ping',
      timestamp: '2026-04-28T16:10:00.000Z',
    });
    expect(onError).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('flushes the final buffered SSE message when UTF-8 data spans chunks before EOF', async () => {
    vi.useFakeTimers();
    const onEvent = vi.fn();
    const onError = vi.fn();
    const bytes = new TextEncoder().encode('data: {"type":"ping","timestamp":"2026-04-28T16:10:00.000Z","label":"Cinema Étoile"}');
    const splitAt = bytes.length - 2;
    let fetchCallCount = 0;

    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      lastFetchCall = { input, init };

      fetchCallCount++;

      if (fetchCallCount === 1) {
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
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        body: {
          getReader: () => ({
            read: vi.fn(() => new Promise(() => {
              // Keep the reconnected stream open.
            })),
          }),
        },
      } as unknown as Response);
    });

    subscribeToProgress(onEvent, onError);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(10);

    expect(onEvent).toHaveBeenCalledWith({
      type: 'ping',
      timestamp: '2026-04-28T16:10:00.000Z',
      label: 'Cinema Étoile',
    });
    expect(onError).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('parses SSE id fields with multi-line data blocks', async () => {
    const onEvent = vi.fn();

    globalThis.fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      lastFetchCall = { input: _input, init };

      return Promise.resolve({
        ok: true,
        status: 200,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('id: 42\ndata: {"type":"started",\ndata: "report_id":42,"total_cinemas":1,"total_dates":1}\n\n'),
              })
              .mockImplementation(() => new Promise(() => {
                // Keep the stream open after the parsed event.
              })),
          }),
        },
      } as unknown as Response);
    });

    subscribeToProgress(onEvent);
    await Promise.resolve();
    await Promise.resolve();

    expect(onEvent).toHaveBeenCalledWith({
      type: 'started',
      report_id: 42,
      total_cinemas: 1,
      total_dates: 1,
    });
  });

  it('preserves id parsing when UTF-8 data spans chunks before EOF', async () => {
    vi.useFakeTimers();
    const onEvent = vi.fn();
    const onError = vi.fn();
    const bytes = new TextEncoder().encode('id: 7\ndata: {"type":"ping","timestamp":"2026-04-28T16:10:00.000Z","label":"Cinema Étoile"}');
    const splitAt = bytes.length - 2;
    let fetchCallCount = 0;

    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      lastFetchCall = { input, init };
      fetchCallCount++;

      if (fetchCallCount === 1) {
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
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        body: {
          getReader: () => ({
            read: vi.fn(() => new Promise(() => {
              // Keep the reconnected stream open.
            })),
          }),
        },
      } as unknown as Response);
    });

    subscribeToProgress(onEvent, onError);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(10);

    expect(onEvent).toHaveBeenCalledWith({
      type: 'ping',
      timestamp: '2026-04-28T16:10:00.000Z',
      label: 'Cinema Étoile',
    });
    expect(onError).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  describe('SSE reconnection', () => {

    beforeEach(() => {
      vi.useFakeTimers();
      vi.clearAllMocks();
      mockAbort = vi.fn();
      lastFetchCall = undefined;
    });

    afterEach(() => {
      vi.useRealTimers();
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      });
      window.localStorage.clear();
    });

    it('triggers reconnection after 60s without a ping event', async () => {
      const onEvent = vi.fn();
      const onStatusChange = vi.fn();

      let resolveFirstRead: ((v: { done: boolean; value?: Uint8Array }) => void) | undefined;
      let callCount = 0;
      globalThis.fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        lastFetchCall = { input: _input, init };
        callCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          body: {
            getReader: () => ({
              read: vi.fn()
                .mockImplementationOnce(() => new Promise((resolve) => {
                  resolveFirstRead = resolve;
                }))
                .mockImplementation(() => new Promise(() => {
                  // Never resolves — keeps the stream open for heartbeat testing
                })),
            }),
          },
        } as unknown as Response);
      });

      subscribeToProgress(onEvent, undefined, onStatusChange);
      await Promise.resolve();
      await Promise.resolve();

      // Send initial ping
      resolveFirstRead?.({
        done: false,
        value: new TextEncoder().encode('data: {"type":"ping","timestamp":"2026-04-28T15:00:00.000Z"}\n\n'),
      });
      await Promise.resolve();
      await Promise.resolve();

      expect(onEvent).toHaveBeenCalledWith({ type: 'ping', timestamp: '2026-04-28T15:00:00.000Z' });
      expect(callCount).toBe(1);

      // Advance 60s — should trigger reconnection
      await vi.advanceTimersByTimeAsync(60000);

      // Should have called onStatusChange with 'reconnecting'
      expect(onStatusChange).toHaveBeenCalledWith('reconnecting');

      // Advance past the 1ms reconnect delay
      await vi.advanceTimersByTimeAsync(100);

      // Should have initiated a reconnection (new fetch call)
      expect(callCount).toBeGreaterThan(1);
    });

    it('resets the heartbeat watchdog on each received ping', async () => {
      const onEvent = vi.fn();
      const onStatusChange = vi.fn();

      let resolveFirstRead: ((v: { done: boolean; value?: Uint8Array }) => void) | undefined;
      let resolveSecondRead: ((v: { done: boolean; value?: Uint8Array }) => void) | undefined;

      globalThis.fetch = vi.fn(() => Promise.resolve({
        ok: true,
        status: 200,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockImplementationOnce(() => new Promise((resolve) => {
                resolveFirstRead = resolve;
              }))
              .mockImplementationOnce(() => new Promise((resolve) => {
                resolveSecondRead = resolve;
              }))
              .mockImplementation(() => new Promise(() => {
                // Never resolves — keeps the stream open
              })),
          }),
        },
      } as unknown as Response));

      subscribeToProgress(onEvent, undefined, onStatusChange);
      await Promise.resolve();
await Promise.resolve();

      // First ping at t=0
      resolveFirstRead?.({
        done: false,
        value: new TextEncoder().encode('data: {"type":"ping","timestamp":"2026-04-28T15:00:00.000Z"}\n\n'),
      });
      await Promise.resolve();
await Promise.resolve();

      // Advance 30s — still within window
      await vi.advanceTimersByTimeAsync(30000);

      // Second ping at t=30 — should reset watchdog
      resolveSecondRead?.({
        done: false,
        value: new TextEncoder().encode('data: {"type":"ping","timestamp":"2026-04-28T15:00:30.000Z"}\n\n'),
      });
      await Promise.resolve();
await Promise.resolve();

      // Advance 30s from second ping — still within reset window
      await vi.advanceTimersByTimeAsync(30000);

      // Should NOT have triggered reconnection yet
      expect(onStatusChange).not.toHaveBeenCalledWith('reconnecting');

      // Advance another 30s — now 60s from last ping
      await vi.advanceTimersByTimeAsync(30000);

      // Now it should trigger
      expect(onStatusChange).toHaveBeenCalledWith('reconnecting');
    });

    it('stops reconnection loop when unsubscribe is called', async () => {
      const onEvent = vi.fn();
      const onStatusChange = vi.fn();

      let resolveFirstRead: ((v: { done: boolean; value?: Uint8Array }) => void) | undefined;

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
                  resolveFirstRead = resolve;
                }))
                .mockImplementation(() => new Promise(() => {
                  // Never resolves — keeps stream open
                })),
            }),
          },
        } as unknown as Response);
      });

      const unsubscribe = subscribeToProgress(onEvent, undefined, onStatusChange);
      await Promise.resolve();
await Promise.resolve();

      // Send initial ping
      resolveFirstRead?.({
        done: false,
        value: new TextEncoder().encode('data: {"type":"ping","timestamp":"2026-04-28T15:00:00.000Z"}\n\n'),
      });
      await Promise.resolve();
await Promise.resolve();

      // Advance 60s to trigger heartbeat timeout
      await vi.advanceTimersByTimeAsync(60000);

      expect(onStatusChange).toHaveBeenCalledWith('reconnecting');

      // Unsubscribe during reconnection (before reconnect timer fires)
      unsubscribe();
      expect(mockAbort).toHaveBeenCalled();

      // Advance more time — should NOT trigger another reconnection
      mockAbort.mockClear();
      await vi.advanceTimersByTimeAsync(100000);
      expect(mockAbort).not.toHaveBeenCalled();
    });

    it('reconnects after clean stream EOF', async () => {
      const onEvent = vi.fn();
      const onError = vi.fn();
      const onStatusChange = vi.fn();

      let fetchCallCount = 0;

      globalThis.fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        fetchCallCount++;
        const signal = init?.signal as AbortSignal | undefined;
        signal?.addEventListener('abort', () => {
          mockAbort();
        });

        // First connection: immediate EOF (closed stream)
        if (fetchCallCount === 1) {
          return Promise.resolve({
            ok: true,
            status: 200,
            body: {
              getReader: () => ({
                read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
              }),
            },
          } as unknown as Response);
        }

        // Second connection (reconnect): stays open
        return Promise.resolve({
          ok: true,
          status: 200,
          body: {
            getReader: () => ({
              read: vi.fn(() => new Promise(() => {
                // Never resolves — keeps stream open
              })),
            }),
          },
        } as unknown as Response);
      });

      subscribeToProgress(onEvent, onError, onStatusChange);
      await Promise.resolve();
await Promise.resolve();

      // First connection closed immediately (EOF)
      // The EOF path schedules a reconnect with 1ms delay
      // Advance past the reconnect delay
      await vi.advanceTimersByTimeAsync(10);

      // Should have attempted reconnection
      expect(fetchCallCount).toBeGreaterThan(1);
    });

    it('calls onStatusChange with connected when reconnection succeeds', async () => {
      const onEvent = vi.fn();
      const onStatusChange = vi.fn();

      let resolvePing: ((v: { done: boolean; value?: Uint8Array }) => void) | undefined;

      globalThis.fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        const signal = init?.signal as AbortSignal | undefined;
        signal?.addEventListener('abort', () => {
          mockAbort();
        });

        // Reconnection: send a ping, then keep open
        return Promise.resolve({
          ok: true,
          status: 200,
          body: {
            getReader: () => ({
              read: vi.fn()
                .mockImplementationOnce(() => new Promise((resolve) => {
                  resolvePing = resolve;
                }))
                .mockImplementation(() => new Promise(() => {
                  // Never resolves — keeps stream open
                })),
            }),
          },
        } as unknown as Response);
      });

      subscribeToProgress(onEvent, undefined, onStatusChange);
      await Promise.resolve();
await Promise.resolve();

      // Advance 60s to trigger reconnection (no ping received during this time)
      await vi.advanceTimersByTimeAsync(60000);

      expect(onStatusChange).toHaveBeenCalledWith('reconnecting');

      // Advance past reconnect delay
      await vi.advanceTimersByTimeAsync(10);

      // Reconnect succeeds — receive ping
      resolvePing?.({
        done: false,
        value: new TextEncoder().encode('data: {"type":"ping","timestamp":"2026-04-28T15:01:00.000Z"}\n\n'),
      });
      await Promise.resolve();
await Promise.resolve();

      expect(onStatusChange).toHaveBeenCalledWith('connected');
    });

    it('surfaces terminal HTTP failures without retrying 50 times', async () => {
      const onError = vi.fn();
      const onStatusChange = vi.fn();
      let fetchCallCount = 0;

      globalThis.fetch = vi.fn(() => {
        fetchCallCount++;

        return Promise.resolve({
          ok: false,
          status: 401,
          body: null,
        } as unknown as Response);
      });

      subscribeToProgress(() => {}, onError, onStatusChange);
      await Promise.resolve();
      await Promise.resolve();

      expect(fetchCallCount).toBe(1);
      expect(onStatusChange).toHaveBeenCalledWith('disconnected');
      expect(onError).toHaveBeenCalledWith(new Error('Progress stream request failed (401)'));
      expect(onStatusChange).not.toHaveBeenCalledWith('reconnecting');
    });

    it('marks the stream connected when the first successful retry opens before any ping arrives', async () => {
      const onStatusChange = vi.fn();
      let fetchCallCount = 0;

      globalThis.fetch = vi.fn(() => {
        fetchCallCount++;

        if (fetchCallCount === 1) {
          return Promise.reject(new Error('Connection lost'));
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          body: {
            getReader: () => ({
              read: vi.fn(() => new Promise(() => {
                // Keep the recovered stream open before the next heartbeat arrives.
              })),
            }),
          },
        } as unknown as Response);
      });

      subscribeToProgress(() => {}, undefined, onStatusChange);
      await Promise.resolve();
      await Promise.resolve();

      expect(onStatusChange).toHaveBeenCalledWith('reconnecting');

      await vi.advanceTimersByTimeAsync(10);

      expect(fetchCallCount).toBeGreaterThan(1);
      expect(onStatusChange).toHaveBeenCalledWith('connected');
    });

    it('resets the reconnect delay budget after a retry successfully reopens the stream', async () => {
      let fetchCallCount = 0;

      globalThis.fetch = vi.fn(() => {
        fetchCallCount++;

        if (fetchCallCount === 1) {
          return Promise.reject(new Error('Connection lost'));
        }

        if (fetchCallCount === 2) {
          return Promise.resolve({
            ok: true,
            status: 200,
            body: {
              getReader: () => ({
                read: vi.fn().mockResolvedValueOnce({ done: true, value: undefined }),
              }),
            },
          } as unknown as Response);
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          body: {
            getReader: () => ({
              read: vi.fn(() => new Promise(() => {
                // Keep the retried stream open.
              })),
            }),
          },
        } as unknown as Response);
      });

      subscribeToProgress(() => {});
      await Promise.resolve();
      await Promise.resolve();

      expect(fetchCallCount).toBe(1);

      await vi.advanceTimersByTimeAsync(1);
      await Promise.resolve();
      await Promise.resolve();

      expect(fetchCallCount).toBe(2);

      await vi.advanceTimersByTimeAsync(10);

      expect(fetchCallCount).toBeGreaterThanOrEqual(3);
    });

    it('sends Last-Event-ID on reconnect after receiving an SSE id', async () => {
      const onEvent = vi.fn();
      let fetchCallCount = 0;

      globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        lastFetchCall = { input, init };
        fetchCallCount++;

        if (fetchCallCount === 1) {
          return Promise.resolve({
            ok: true,
            status: 200,
            body: {
              getReader: () => ({
                read: vi.fn()
                  .mockResolvedValueOnce({
                    done: false,
                    value: new TextEncoder().encode('id: 19\ndata: {"type":"started","report_id":19,"total_cinemas":1,"total_dates":1}\n\n'),
                  })
                  .mockResolvedValueOnce({ done: true, value: undefined }),
              }),
            },
          } as unknown as Response);
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          body: {
            getReader: () => ({
              read: vi.fn(() => new Promise(() => {
                // Keep the reconnected stream open.
              })),
            }),
          },
        } as unknown as Response);
      });

      subscribeToProgress(onEvent);
      await Promise.resolve();
      await Promise.resolve();

      const firstHeaders = lastFetchCall?.init?.headers as Record<string, string>;
      expect(firstHeaders).not.toHaveProperty('Last-Event-ID');

      await vi.advanceTimersByTimeAsync(10);

      expect(fetchCallCount).toBeGreaterThan(1);
      expect(onEvent).toHaveBeenCalledWith({
        type: 'started',
        report_id: 19,
        total_cinemas: 1,
        total_dates: 1,
      });
      expect(lastFetchCall?.init?.headers).toEqual(expect.objectContaining({
        'Last-Event-ID': '19',
      }));
    });
  });
});
