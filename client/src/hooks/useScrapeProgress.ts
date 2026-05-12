import { useEffect, useRef, useState } from 'react';
import { subscribeToProgress } from '../api/client';
import type { ConnectionStatus } from '../api/client';
import type { ProgressEvent } from '../types';

export interface ScrapeJobState {
  id: string;
  reportId?: number;
  events: ProgressEvent[];
  latestEvent?: ProgressEvent;
  theaterName?: string;
  currentMovie?: string;
  totalTheaters: number;
  processedTheaters: number;
  totalMovies: number;
  processedMovies: number;
  theaterProgress: number;
  movieProgress: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
}

export interface TrackedScrapeJob {
  reportId: number;
  theaterName?: string;
}

const EMPTY_TRACKED_JOBS: TrackedScrapeJob[] = [];

export interface ProgressState {
  events: ProgressEvent[];
  latestEvent?: ProgressEvent;
  jobs: ScrapeJobState[];
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  error?: string;
}

function areJobsEqual(left: ScrapeJobState[], right: ScrapeJobState[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftJob = left[index];
    const rightJob = right[index];

    if (
      leftJob.id !== rightJob.id
      || leftJob.reportId !== rightJob.reportId
      || leftJob.theaterName !== rightJob.theaterName
      || leftJob.currentMovie !== rightJob.currentMovie
      || leftJob.totalTheaters !== rightJob.totalTheaters
      || leftJob.processedTheaters !== rightJob.processedTheaters
      || leftJob.totalMovies !== rightJob.totalMovies
      || leftJob.processedMovies !== rightJob.processedMovies
      || leftJob.theaterProgress !== rightJob.theaterProgress
      || leftJob.movieProgress !== rightJob.movieProgress
      || leftJob.status !== rightJob.status
      || leftJob.error !== rightJob.error
      || leftJob.latestEvent?.type !== rightJob.latestEvent?.type
    ) {
      return false;
    }
  }

  return true;
}

function getJobKey(event: ProgressEvent): string {
  return event.report_id != null ? `report:${event.report_id}` : 'legacy';
}

function deriveJobState(id: string, events: ProgressEvent[]): ScrapeJobState {
  const latestEvent = events[events.length - 1];

  let totalTheaters = 0;
  let processedTheaters = 0;
  let totalMovies = 0;
  let processedMovies = 0;
  let theaterName: string | undefined;
  let currentMovie: string | undefined;
  let error: string | undefined;

  for (const event of events) {
    switch (event.type) {
      case 'started':
        totalTheaters = event.total_theaters;
        break;
      case 'theater_started':
        theaterName = event.theater_name;
        break;
      case 'date_started':
        theaterName = event.theater_name;
        break;
      case 'movie_started':
        currentMovie = event.movie_title;
        totalMovies++;
        break;
      case 'movie_completed':
        processedMovies++;
        break;
      case 'movie_failed':
        error = event.error;
        break;
      case 'theater_completed':
        theaterName = event.theater_name;
        processedTheaters++;
        break;
      case 'theater_failed':
        theaterName = event.theater_name;
        error = event.error;
        break;
      case 'date_failed':
        theaterName = event.theater_name;
        error = event.error;
        break;
      case 'failed':
        error = event.error;
        break;
      case 'completed':
        if (!theaterName && event.summary.errors.length === 1) {
          theaterName = event.summary.errors[0]?.theater_name;
        }
        if (!error && event.summary.errors.length > 0) {
          error = event.summary.errors[0]?.error;
        }
        break;
    }
  }

  const theaterProgress = totalTheaters > 0 ? (processedTheaters / totalTheaters) * 100 : 0;
  const movieProgress = totalMovies > 0 ? (processedMovies / totalMovies) * 100 : 0;

  const status: ScrapeJobState['status'] =
    latestEvent.type === 'completed' && latestEvent.summary && latestEvent.summary.failed_theaters > 0 ? 'failed'
    : latestEvent.type === 'completed' ? 'completed'
    : latestEvent.type === 'failed' ? 'failed'
    : latestEvent.type === 'started' || latestEvent.type === 'theater_started' || latestEvent.type === 'theater_completed' || latestEvent.type === 'theater_failed' || latestEvent.type === 'date_started' || latestEvent.type === 'date_stale' || latestEvent.type === 'date_completed' || latestEvent.type === 'date_failed' || latestEvent.type === 'movie_started' || latestEvent.type === 'movie_completed' || latestEvent.type === 'movie_failed' ? 'running'
    : 'pending';

  return {
    id,
    reportId: latestEvent.report_id,
    events,
    latestEvent,
    theaterName,
    currentMovie,
    totalTheaters,
    processedTheaters,
    totalMovies,
    processedMovies,
    theaterProgress,
    movieProgress,
    status,
    error,
  };
}

function mergeTrackedJobs(events: ProgressEvent[], trackedJobs: TrackedScrapeJob[]): ScrapeJobState[] {
  const jobEvents = new Map<string, ProgressEvent[]>();

  for (const event of events) {
    const key = getJobKey(event);
    const existing = jobEvents.get(key);
    if (existing) {
      existing.push(event);
    } else {
      jobEvents.set(key, [event]);
    }
  }

  const jobs = [...jobEvents.entries()].map(([id, jobEventList]) => deriveJobState(id, jobEventList));
  const byId = new Map(jobs.map((job) => [job.id, job]));

  for (const trackedJob of trackedJobs) {
    const id = `report:${trackedJob.reportId}`;
    const existing = byId.get(id);
    if (existing) {
      if (!existing.theaterName && trackedJob.theaterName) {
        existing.theaterName = trackedJob.theaterName;
      }
      continue;
    }

    jobs.push({
      id,
      reportId: trackedJob.reportId,
      events: [],
      theaterName: trackedJob.theaterName,
      totalTheaters: 0,
      processedTheaters: 0,
      totalMovies: 0,
      processedMovies: 0,
      theaterProgress: 0,
      movieProgress: 0,
      status: 'pending',
    });
  }

  const statusRank: Record<ScrapeJobState['status'], number> = {
    running: 0,
    pending: 1,
    failed: 2,
    completed: 3,
  };

  return jobs.sort((left, right) => {
    const rankDiff = statusRank[left.status] - statusRank[right.status];
    if (rankDiff !== 0) {
      return rankDiff;
    }

    return (right.reportId ?? 0) - (left.reportId ?? 0);
  });
}

export function useScrapeProgress(onComplete?: (success: boolean) => void, trackedJobs: TrackedScrapeJob[] = EMPTY_TRACKED_JOBS) {
  const trackedJobsKey = trackedJobs
    .map((job) => `${job.reportId}:${job.theaterName ?? ''}`)
    .join('|');
  const trackedJobsSnapshotRef = useRef({ key: trackedJobsKey, jobs: trackedJobs });
  if (trackedJobsSnapshotRef.current.key !== trackedJobsKey) {
    trackedJobsSnapshotRef.current = { key: trackedJobsKey, jobs: trackedJobs };
  }
  const trackedJobsSnapshot = trackedJobsSnapshotRef.current.jobs;
  const [state, setState] = useState<ProgressState>({
    events: [],
    jobs: mergeTrackedJobs([], trackedJobsSnapshot),
    isConnected: true,
    connectionStatus: 'connected',
  });

  // Use ref to keep stable callback reference and avoid re-subscribing
  const onCompleteRef = useRef(onComplete);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const completionNotifiedRef = useRef(false);
  const trackedJobsRef = useRef(trackedJobsSnapshot);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    trackedJobsRef.current = trackedJobsSnapshot;
  }, [trackedJobsSnapshot]);

  useEffect(() => {
    setState((prev) => ({
      ...((): ProgressState => {
        const jobs = mergeTrackedJobs(prev.events, trackedJobsSnapshot);
        if (areJobsEqual(prev.jobs, jobs)) {
          return prev;
        }

        return {
          ...prev,
          jobs,
        };
      })(),
    }));
  }, [trackedJobsKey, trackedJobsSnapshot]);

  useEffect(() => {
    // Keep one SSE subscription for the component lifetime. Tracked jobs update
    // local derived state through refs and the separate merge effect, so they
    // should not tear down and recreate the EventSource on every trigger.
    const unsubscribe = subscribeToProgress(
      (event: ProgressEvent) => {
        setState((prev) => {
          if (event.type === 'ping') {
            return {
              ...prev,
              isConnected: true,
              connectionStatus: 'connected',
              error: undefined,
            };
          }

          const events = [...prev.events, event];
          const jobs = mergeTrackedJobs(events, trackedJobsRef.current);
          const allTerminal = jobs.length > 0 && jobs.every((job) => job.status === 'completed' || job.status === 'failed');

          if (allTerminal && !completionNotifiedRef.current) {
            completionNotifiedRef.current = true;
            onCompleteRef.current?.(jobs.every((job) => job.status === 'completed'));
          } else if (!allTerminal) {
            completionNotifiedRef.current = false;
          }

          return {
            ...prev,
            events,
            latestEvent: event,
            jobs,
            isConnected: true,
            connectionStatus: 'connected',
            error: undefined,
          };
        });
      },
      (error: Error) => {
        setState((prev) => ({
          ...prev,
          isConnected: false,
          connectionStatus: 'disconnected',
          error: error.message === 'Progress stream closed' ? undefined : error.message,
          jobs: mergeTrackedJobs(prev.events, trackedJobsRef.current),
        }));
      },
      (status: ConnectionStatus) => {
        setState((prev) => ({
          ...prev,
          isConnected: status === 'connected',
          connectionStatus: status,
          ...(status === 'connected' ? { error: undefined } : {}),
        }));
      }
    );

    // Store unsubscribe function in ref for early cleanup
    unsubscribeRef.current = unsubscribe;

    // Cleanup on unmount
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  const reset = () => {
    completionNotifiedRef.current = false;
    setState((prev) => ({
      events: [],
      jobs: mergeTrackedJobs([], trackedJobsRef.current),
      isConnected: prev.isConnected,
      connectionStatus: prev.connectionStatus,
      latestEvent: undefined,
      error: undefined,
    }));
  };

  return {
    ...state,
    reset,
  };
}
