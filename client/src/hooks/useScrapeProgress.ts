import { useEffect, useState, useRef } from 'react';
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
    isConnected: false,
  });

  // Use ref to keep stable callback reference and avoid re-subscribing
  const onCompleteRef = useRef(onComplete);
  
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    // Subscribe to progress events
    const unsubscribe = subscribeToProgress(
      (event: ProgressEvent) => {
        setState((prev) => ({
          ...prev,
          events: [...prev.events, event],
          latestEvent: event,
          isConnected: true,
          error: undefined,
        }));

        if (event.type === 'completed') {
          onCompleteRef.current?.(true);
        } else if (event.type === 'failed') {
          onCompleteRef.current?.(false);
        }
      },
      (error: Error) => {
        setState((prev) => ({
          ...prev,
          isConnected: false,
          error: error.message,
        }));
      }
    );

    // Mark as connected
    setState((prev) => ({ ...prev, isConnected: true }));

    // Cleanup on unmount
    return () => {
      unsubscribe();
      setState((prev) => ({ ...prev, isConnected: false }));
    };
  }, []);

  const reset = () => {
    setState({
      events: [],
      isConnected: state.isConnected,
    });
  };

  return {
    ...state,
    reset,
  };
}
