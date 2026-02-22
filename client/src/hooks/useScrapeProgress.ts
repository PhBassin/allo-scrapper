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
  const unsubscribeRef = useRef<(() => void) | null>(null);
  
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
          // Reset events array to avoid accumulation
          setTimeout(() => {
            setState((prev) => ({
              ...prev,
              events: [event],
            }));
          }, 100);
          
          onCompleteRef.current?.(true);
          
          // Close SSE connection after completion to avoid flickering
          setTimeout(() => {
            if (unsubscribeRef.current) {
              unsubscribeRef.current();
              unsubscribeRef.current = null;
              setState((prev) => ({ ...prev, isConnected: false }));
            }
          }, 1500);
        } else if (event.type === 'failed') {
          onCompleteRef.current?.(false);
          
          // Close SSE connection after failure
          setTimeout(() => {
            if (unsubscribeRef.current) {
              unsubscribeRef.current();
              unsubscribeRef.current = null;
              setState((prev) => ({ ...prev, isConnected: false }));
            }
          }, 1500);
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

    // Store unsubscribe function in ref for early cleanup
    unsubscribeRef.current = unsubscribe;

    // Mark as connected
    setState((prev) => ({ ...prev, isConnected: true }));

    // Cleanup on unmount
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
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
