import { useEffect, useState } from 'react';
import { subscribeToProgress } from '../api/client';
import type { ProgressEvent } from '../types';

export interface ProgressState {
  events: ProgressEvent[];
  latestEvent?: ProgressEvent;
  isConnected: boolean;
  error?: string;
}

export function useScrapeProgress() {
  const [state, setState] = useState<ProgressState>({
    events: [],
    isConnected: false,
  });

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
