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
    mockSubscribe.mockImplementation((options: any) => {
      // Extract onEvent callback from options object
      eventCallback = typeof options === 'function' ? options : options.onEvent;
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
  });

  it('should call onComplete(true) when completed event is received', () => {
    const onComplete = vi.fn();
    let eventCallback: (event: any) => void = () => {};
    
    mockSubscribe.mockImplementation((options: any) => {
      // Extract onEvent callback from options object
      eventCallback = typeof options === 'function' ? options : options.onEvent;
      return mockUnsubscribe;
    });

    renderHook(() => useScrapeProgress(onComplete));

    act(() => {
      eventCallback({ type: 'completed', summary: {} });
    });

    expect(onComplete).toHaveBeenCalledWith(true);
  });

  it('should call onComplete(false) when failed event is received', () => {
    const onComplete = vi.fn();
    let eventCallback: (event: any) => void = () => {};
    
    mockSubscribe.mockImplementation((options: any) => {
      // Extract onEvent callback from options object
      eventCallback = typeof options === 'function' ? options : options.onEvent;
      return mockUnsubscribe;
    });

    renderHook(() => useScrapeProgress(onComplete));

    act(() => {
      eventCallback({ type: 'failed', error: 'test error' });
    });

    expect(onComplete).toHaveBeenCalledWith(false);
  });

  it('should not re-subscribe when onComplete callback changes', () => {
    const onComplete1 = vi.fn();
    const onComplete2 = vi.fn();
    let eventCallback: (event: any) => void = () => {};
    
    mockSubscribe.mockImplementation((options: any) => {
      eventCallback = typeof options === 'function' ? options : options.onEvent;
      return mockUnsubscribe;
    });

    // Initial render with first callback
    const { rerender } = renderHook(
      ({ callback }) => useScrapeProgress(callback),
      { initialProps: { callback: onComplete1 } }
    );

    // Should subscribe once on mount
    expect(mockSubscribe).toHaveBeenCalledTimes(1);

    // Rerender with different callback
    rerender({ callback: onComplete2 });

    // Should NOT re-subscribe (empty dependency array in useEffect)
    expect(mockSubscribe).toHaveBeenCalledTimes(1);

    // But the new callback should still work (via ref)
    act(() => {
      eventCallback({ type: 'completed', summary: {} });
    });

    expect(onComplete1).not.toHaveBeenCalled();
    expect(onComplete2).toHaveBeenCalledWith(true);
  });

  it('should handle rapid event updates without infinite loops', () => {
    let eventCallback: (event: any) => void = () => {};
    
    mockSubscribe.mockImplementation((options: any) => {
      eventCallback = typeof options === 'function' ? options : options.onEvent;
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => useScrapeProgress());

    // Simulate rapid event stream
    const events = [
      { type: 'started', total_cinemas: 3, total_dates: 7 },
      { type: 'cinema_started', cinema_id: 'C1', cinema_name: 'Cinema 1', index: 0 },
      { type: 'film_started', film_id: 1, film_title: 'Film 1' },
      { type: 'film_completed', film_title: 'Film 1', showtimes_count: 5 },
      { type: 'cinema_completed', cinema_name: 'Cinema 1', total_films: 1 },
    ];

    act(() => {
      events.forEach(event => eventCallback(event));
    });

    // Should have all events without crashing
    expect(result.current.events.length).toBe(5);
    expect(result.current.latestEvent).toEqual(events[events.length - 1]);
  });
});
