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
  });

  it('should call onComplete(true) when completed event is received', () => {
    const onComplete = vi.fn();
    let eventCallback: (event: any) => void = () => {};
    
    mockSubscribe.mockImplementation((cb) => {
      eventCallback = cb;
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
    
    mockSubscribe.mockImplementation((cb) => {
      eventCallback = cb;
      return mockUnsubscribe;
    });

    renderHook(() => useScrapeProgress(onComplete));

    act(() => {
      eventCallback({ type: 'failed', error: 'test error' });
    });

    expect(onComplete).toHaveBeenCalledWith(false);
  });
});
