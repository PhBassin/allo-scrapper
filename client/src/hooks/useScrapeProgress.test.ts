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

    const testEvent = { type: 'started', total_cinemas: 1, total_dates: 1 };
    
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
      { reportId: 21, cinemaName: 'Cinema Pending' },
    ]));

    expect(result.current.jobs).toHaveLength(1);
    expect(result.current.jobs[0]).toMatchObject({
      reportId: 21,
      cinemaName: 'Cinema Pending',
      status: 'pending',
    });
  });

  it('does not resubscribe when tracked jobs change', () => {
    const { rerender } = renderHook(
      ({ trackedJobs }: { trackedJobs: Array<{ reportId: number; cinemaName?: string }> }) =>
        useScrapeProgress(undefined, trackedJobs),
      {
        initialProps: {
          trackedJobs: [{ reportId: 21, cinemaName: 'Cinema Pending' }],
        },
      }
    );

    expect(mockSubscribe).toHaveBeenCalledTimes(1);

    rerender({
      trackedJobs: [
        { reportId: 21, cinemaName: 'Cinema Pending' },
        { reportId: 22, cinemaName: 'Cinema Next' },
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
      eventCallback({ type: 'started', report_id: 10, total_cinemas: 1, total_dates: 1 });
      eventCallback({ type: 'started', report_id: 11, total_cinemas: 1, total_dates: 1 });
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
      eventCallback({ type: 'started', report_id: 12, total_cinemas: 1, total_dates: 1 });
      eventCallback({ type: 'started', report_id: 13, total_cinemas: 1, total_dates: 1 });
      eventCallback({ type: 'completed', report_id: 12, summary: { errors: [] } });
      eventCallback({ type: 'failed', report_id: 13, error: 'test error' });
    });

    expect(onComplete).toHaveBeenCalledWith(false);
  });

  it('treats completed events with failed cinemas as failed jobs', () => {
    let eventCallback: (event: any) => void = () => {};

    mockSubscribe.mockImplementation((cb) => {
      eventCallback = cb;
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => useScrapeProgress());

    act(() => {
      eventCallback({ type: 'started', report_id: 99, total_cinemas: 1, total_dates: 1 });
      eventCallback({
        type: 'completed',
        report_id: 99,
        summary: {
          total_cinemas: 1,
          successful_cinemas: 0,
          failed_cinemas: 1,
          total_films: 0,
          total_showtimes: 0,
          total_dates: 1,
          duration_ms: 100,
          errors: [{
            cinema_name: 'Cinema Failure',
            cinema_id: 'FAIL1',
            error: 'No scraper strategy found for https://example.test/cinema',
          }],
          status: 'failed',
        },
      });
    });

    expect(result.current.jobs).toHaveLength(1);
    expect(result.current.jobs[0]).toMatchObject({
      reportId: 99,
      cinemaName: 'Cinema Failure',
      status: 'failed',
      error: 'No scraper strategy found for https://example.test/cinema',
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
      eventCallback({ type: 'started', report_id: 10, total_cinemas: 1, total_dates: 1 });
      eventCallback({ type: 'cinema_started', report_id: 10, cinema_id: 'C1', cinema_name: 'Cinema One', index: 1 });
      eventCallback({ type: 'started', report_id: 11, total_cinemas: 1, total_dates: 1 });
      eventCallback({ type: 'cinema_started', report_id: 11, cinema_id: 'C2', cinema_name: 'Cinema Two', index: 1 });
    });

    expect(result.current.jobs).toHaveLength(2);
    expect(result.current.jobs.map((job) => job.cinemaName)).toEqual(['Cinema Two', 'Cinema One']);
  });
});
