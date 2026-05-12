/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderHook, act } from '@testing-library/react';
import { useScrapeProgress } from './useScrapeProgress';
import * as clientApi from '../api/client';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock the API client
vi.mock('../api/client', () => ({
  subscribeToProgress: vi.fn(),
}));

describe('useScrapeProgress', () => {
  let mockUnsubscribe: ReturnType<typeof vi.fn>;
  let mockSubscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUnsubscribe = vi.fn();
    mockSubscribe = vi.mocked(clientApi.subscribeToProgress);
    mockSubscribe.mockReturnValue(mockUnsubscribe);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should subscribe on mount', () => {
    renderHook(() => useScrapeProgress());
    expect(mockSubscribe).toHaveBeenCalled();
  });

  it('should unsubscribe on unmount', () => {
    const { unmount } = renderHook(() => useScrapeProgress());
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('should update state on events', () => {
    let eventCallback: (event: any) => void = () => {};
    mockSubscribe.mockImplementation((cb) => {
      eventCallback = cb;
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => useScrapeProgress());

    const testEvent = { type: 'started', total_theaters: 1, total_dates: 1 };
    
    act(() => {
      eventCallback(testEvent);
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.latestEvent).toEqual(testEvent);
    expect(result.current.events).toContain(testEvent);
    expect(result.current.jobs).toHaveLength(1);
    expect(result.current.jobs[0]?.status).toBe('running');
  });

  it('surfaces tracked jobs before first SSE event', () => {
    const { result } = renderHook(() => useScrapeProgress(undefined, [
      { reportId: 21, theaterName: 'Theater Pending' },
    ]));

    expect(result.current.jobs).toHaveLength(1);
    expect(result.current.jobs[0]).toMatchObject({
      reportId: 21,
      theaterName: 'Theater Pending',
      status: 'pending',
    });
  });

  it('does not resubscribe when tracked jobs change', () => {
    const { rerender } = renderHook(
      ({ trackedJobs }: { trackedJobs: Array<{ reportId: number; theaterName?: string }> }) =>
        useScrapeProgress(undefined, trackedJobs),
      {
        initialProps: {
          trackedJobs: [{ reportId: 21, theaterName: 'Theater Pending' }],
        },
      }
    );

    expect(mockSubscribe).toHaveBeenCalledTimes(1);

    rerender({
      trackedJobs: [
        { reportId: 21, theaterName: 'Theater Pending' },
        { reportId: 22, theaterName: 'Theater Next' },
      ],
    });

    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockUnsubscribe).not.toHaveBeenCalled();
  });

  it('should call onComplete(true) when all tracked jobs complete', () => {
    const onComplete = vi.fn();
    let eventCallback: (event: any) => void = () => {};
    
    mockSubscribe.mockImplementation((cb) => {
      eventCallback = cb;
      return mockUnsubscribe;
    });

    renderHook(() => useScrapeProgress(onComplete));

    act(() => {
      eventCallback({ type: 'started', report_id: 10, total_theaters: 1, total_dates: 1 });
      eventCallback({ type: 'started', report_id: 11, total_theaters: 1, total_dates: 1 });
      eventCallback({ type: 'completed', report_id: 10, summary: { errors: [] } });
    });

    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      eventCallback({ type: 'completed', report_id: 11, summary: { errors: [] } });
    });

    expect(onComplete).toHaveBeenCalledWith(true);
  });

  it('should call onComplete(false) when all tracked jobs are terminal and one failed', () => {
    const onComplete = vi.fn();
    let eventCallback: (event: any) => void = () => {};
    
    mockSubscribe.mockImplementation((cb) => {
      eventCallback = cb;
      return mockUnsubscribe;
    });

    renderHook(() => useScrapeProgress(onComplete));

    act(() => {
      eventCallback({ type: 'started', report_id: 12, total_theaters: 1, total_dates: 1 });
      eventCallback({ type: 'started', report_id: 13, total_theaters: 1, total_dates: 1 });
      eventCallback({ type: 'completed', report_id: 12, summary: { errors: [] } });
      eventCallback({ type: 'failed', report_id: 13, error: 'test error' });
    });

    expect(onComplete).toHaveBeenCalledWith(false);
  });

  it('treats completed events with failed theaters as failed jobs', () => {
    let eventCallback: (event: any) => void = () => {};

    mockSubscribe.mockImplementation((cb) => {
      eventCallback = cb;
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => useScrapeProgress());

    act(() => {
      eventCallback({ type: 'started', report_id: 99, total_theaters: 1, total_dates: 1 });
      eventCallback({
        type: 'completed',
        report_id: 99,
        summary: {
          total_theaters: 1,
          successful_theaters: 0,
          failed_theaters: 1,
          total_movies: 0,
          total_showtimes: 0,
          total_dates: 1,
          duration_ms: 100,
          errors: [{
            theater_name: 'Theater Failure',
            theater_id: 'FAIL1',
            error: 'No scraper strategy found for https://example.test/theater',
          }],
          status: 'failed',
        },
      });
    });

    expect(result.current.jobs).toHaveLength(1);
    expect(result.current.jobs[0]).toMatchObject({
      reportId: 99,
      theaterName: 'Theater Failure',
      status: 'failed',
      error: 'No scraper strategy found for https://example.test/theater',
    });
  });

  it('derives separate jobs from report ids', () => {
    let eventCallback: (event: any) => void = () => {};

    mockSubscribe.mockImplementation((cb) => {
      eventCallback = cb;
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => useScrapeProgress());

    act(() => {
      eventCallback({ type: 'started', report_id: 10, total_theaters: 1, total_dates: 1 });
      eventCallback({ type: 'theater_started', report_id: 10, theater_id: 'C1', theater_name: 'Theater One', index: 1 });
      eventCallback({ type: 'started', report_id: 11, total_theaters: 1, total_dates: 1 });
      eventCallback({ type: 'theater_started', report_id: 11, theater_id: 'C2', theater_name: 'Theater Two', index: 1 });
    });

    expect(result.current.jobs).toHaveLength(2);
    expect(result.current.jobs.map((job) => job.theaterName)).toEqual(['Theater Two', 'Theater One']);
  });

  it('keeps the connection alive without polluting progress state on ping events', () => {
    let eventCallback: (event: any) => void = () => {};

    mockSubscribe.mockImplementation((cb) => {
      eventCallback = cb;
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => useScrapeProgress());

    act(() => {
      eventCallback({ type: 'ping', timestamp: '2026-04-28T15:18:00.000Z' });
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.error).toBeUndefined();
    expect(result.current.events).toEqual([]);
    expect(result.current.jobs).toEqual([]);
    expect(result.current.latestEvent).toBeUndefined();
  });

  it('treats a clean stream close as disconnected without surfacing an error', () => {
    let errorCallback: (error: Error) => void = () => {};

    mockSubscribe.mockImplementation((_cb, onError) => {
      errorCallback = onError ?? (() => {});
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => useScrapeProgress());

    act(() => {
      errorCallback(new Error('Progress stream closed'));
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  describe('reconnection', () => {
    it('transitions connectionStatus through reconnecting to connected', () => {
      let statusCallback: (status: string) => void = () => {};

      mockSubscribe.mockImplementation((_cb, _onError, onStatusChange) => {
        statusCallback = onStatusChange ?? (() => {});
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useScrapeProgress());

      act(() => {
        statusCallback('reconnecting');
      });

      expect(result.current.connectionStatus).toBe('reconnecting');
      expect(result.current.isConnected).toBe(false);

      act(() => {
        statusCallback('connected');
      });

      expect(result.current.connectionStatus).toBe('connected');
      expect(result.current.isConnected).toBe(true);
    });

    it('preserves accumulated progress events across reconnection', () => {
      let eventCallback: (event: any) => void = () => {};
      let statusCallback: (status: string) => void = () => {};

      mockSubscribe.mockImplementation((cb, _onError, onStatusChange) => {
        eventCallback = cb;
        statusCallback = onStatusChange ?? (() => {});
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useScrapeProgress());

      // First event arrives
      act(() => {
        eventCallback({ type: 'started', report_id: 10, total_theaters: 5, total_dates: 30 });
      });

      expect(result.current.events).toHaveLength(1);
      expect(result.current.jobs[0]?.totalTheaters).toBe(5);

      // Connection drops
      act(() => {
        statusCallback('reconnecting');
      });

      expect(result.current.connectionStatus).toBe('reconnecting');

      // Reconnect succeeds
      act(() => {
        statusCallback('connected');
      });

      expect(result.current.connectionStatus).toBe('connected');

      // Events should still be preserved
      expect(result.current.events).toHaveLength(1);
      expect(result.current.jobs[0]?.totalTheaters).toBe(5);

      // Second event arrives after reconnect
      act(() => {
        eventCallback({ type: 'theater_started', report_id: 10, theater_name: 'Theater One', theater_id: 'C1', index: 0 });
      });

      expect(result.current.events).toHaveLength(2);
      expect(result.current.jobs[0]?.theaterName).toBe('Theater One');
    });

    it('clears error on successful reconnect', () => {
      let errorCallback: (error: Error) => void = () => {};
      let statusCallback: (status: string) => void = () => {};

      mockSubscribe.mockImplementation((_cb, onError, onStatusChange) => {
        errorCallback = onError ?? (() => {});
        statusCallback = onStatusChange ?? (() => {});
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useScrapeProgress());

      // Connection fails with real error
      act(() => {
        errorCallback(new Error('Connection lost'));
      });

      expect(result.current.connectionStatus).toBe('disconnected');
      expect(result.current.error).toBe('Connection lost');

      // Reconnect succeeds
      act(() => {
        statusCallback('connected');
      });

      expect(result.current.connectionStatus).toBe('connected');
      expect(result.current.error).toBeUndefined();
    });
  });
});
