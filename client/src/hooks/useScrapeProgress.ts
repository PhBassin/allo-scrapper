import { useEffect, useState, useRef, useCallback } from 'react';
import { subscribeToProgress } from '../api/client';
import type { ProgressEvent } from '../types';

export interface ProgressState {
  events: ProgressEvent[];
  latestEvent?: ProgressEvent;
  isConnected: boolean;
  error?: string;
}

export function useScrapeProgress(onComplete?: (success: boolean) => void) {
  const [state, setState] = useState<ProgressState>({
    events: [],
    isConnected: false, // Start as false until connection is confirmed
  });

  // Use ref to keep stable callback reference and avoid re-subscribing
  const onCompleteRef = useRef(onComplete);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Memoize event handler to prevent recreation on every render
  const handleEvent = useCallback((event: ProgressEvent) => {
    setState((prev) => ({
      ...prev,
      events: [...prev.events, event],
      latestEvent: event,
      isConnected: true,
      error: undefined,
    }));

    // Handle completion/failure - call onComplete immediately
    // but defer cleanup to avoid cascading state updates
    if (event.type === 'completed') {
      onCompleteRef.current?.(true);
      
      // Clear any existing timer to prevent duplicates
      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
      }
      
      // Schedule cleanup after UI has time to display completed state
      cleanupTimerRef.current = setTimeout(() => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
        cleanupTimerRef.current = null;
      }, 1500);
    } else if (event.type === 'failed') {
      onCompleteRef.current?.(false);
      
      // Clear any existing timer
      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
      }
      
      // Schedule cleanup after UI has time to display failed state
      cleanupTimerRef.current = setTimeout(() => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
        cleanupTimerRef.current = null;
      }, 1500);
    }
  }, []);

  // Memoize error handler
  const handleError = useCallback((error: Error) => {
    setState((prev) => ({
      ...prev,
      isConnected: false,
      error: error.message,
    }));
  }, []);

  // Memoize connected handler
  const handleConnected = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isConnected: true,
      error: undefined,
    }));
  }, []);

  useEffect(() => {
    // Subscribe to progress events with reconnection support
    const unsubscribe = subscribeToProgress({
      onEvent: handleEvent,
      onError: handleError,
      onConnected: handleConnected,
    });

    // Store unsubscribe function in ref for early cleanup
    unsubscribeRef.current = unsubscribe;

    // Cleanup on unmount
    return () => {
      // Clear cleanup timer
      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
        cleanupTimerRef.current = null;
      }
      
      // Unsubscribe from SSE
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [handleEvent, handleError, handleConnected]);

  const reset = useCallback(() => {
    setState((prev) => ({
      events: [],
      isConnected: prev.isConnected,
    }));
  }, []);

  return {
    ...state,
    reset,
  };
}
