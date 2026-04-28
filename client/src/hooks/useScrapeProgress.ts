import { useEffect, useRef, useState } from 'react';
import { subscribeToProgress } from '../api/client';
import type { ProgressEvent } from '../types';

export interface ScrapeJobState {
  id: string;
  reportId?: number;
  events: ProgressEvent[];
  latestEvent?: ProgressEvent;
  cinemaName?: string;
  currentFilm?: string;
  totalCinemas: number;
  processedCinemas: number;
  totalFilms: number;
  processedFilms: number;
  cinemaProgress: number;
  filmProgress: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
}

export interface TrackedScrapeJob {
  reportId: number;
  cinemaName?: string;
}

const EMPTY_TRACKED_JOBS: TrackedScrapeJob[] = [];

export interface ProgressState {
  events: ProgressEvent[];
  latestEvent?: ProgressEvent;
  jobs: ScrapeJobState[];
  isConnected: boolean;
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
      || leftJob.cinemaName !== rightJob.cinemaName
      || leftJob.currentFilm !== rightJob.currentFilm
      || leftJob.totalCinemas !== rightJob.totalCinemas
      || leftJob.processedCinemas !== rightJob.processedCinemas
      || leftJob.totalFilms !== rightJob.totalFilms
      || leftJob.processedFilms !== rightJob.processedFilms
      || leftJob.cinemaProgress !== rightJob.cinemaProgress
      || leftJob.filmProgress !== rightJob.filmProgress
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

  let totalCinemas = 0;
  let processedCinemas = 0;
  let totalFilms = 0;
  let processedFilms = 0;
  let cinemaName: string | undefined;
  let currentFilm: string | undefined;
  let error: string | undefined;

  for (const event of events) {
    switch (event.type) {
      case 'started':
        totalCinemas = event.total_cinemas;
        break;
      case 'cinema_started':
        cinemaName = event.cinema_name;
        break;
      case 'date_started':
        cinemaName = event.cinema_name;
        break;
      case 'film_started':
        currentFilm = event.film_title;
        totalFilms++;
        break;
      case 'film_completed':
        processedFilms++;
        break;
      case 'film_failed':
        error = event.error;
        break;
      case 'cinema_completed':
        cinemaName = event.cinema_name;
        processedCinemas++;
        break;
      case 'cinema_failed':
        cinemaName = event.cinema_name;
        error = event.error;
        break;
      case 'date_failed':
        cinemaName = event.cinema_name;
        error = event.error;
        break;
      case 'failed':
        error = event.error;
        break;
      case 'completed':
        if (!cinemaName && event.summary.errors.length === 1) {
          cinemaName = event.summary.errors[0]?.cinema_name;
        }
        if (!error && event.summary.errors.length > 0) {
          error = event.summary.errors[0]?.error;
        }
        break;
    }
  }

  const status = latestEvent.type === 'completed'
    ? latestEvent.summary.failed_cinemas > 0
      ? 'failed'
      : 'completed'
    : latestEvent.type === 'failed'
      ? 'failed'
      : 'running';

  const cinemaProgress = totalCinemas > 0 ? (processedCinemas / totalCinemas) * 100 : 0;
  const filmProgress = totalFilms > 0 ? (processedFilms / totalFilms) * 100 : 0;

  return {
    id,
    reportId: latestEvent.report_id,
    events,
    latestEvent,
    cinemaName,
    currentFilm,
    totalCinemas,
    processedCinemas,
    totalFilms,
    processedFilms,
    cinemaProgress,
    filmProgress,
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
      if (!existing.cinemaName && trackedJob.cinemaName) {
        existing.cinemaName = trackedJob.cinemaName;
      }
      continue;
    }

    jobs.push({
      id,
      reportId: trackedJob.reportId,
      events: [],
      cinemaName: trackedJob.cinemaName,
      totalCinemas: 0,
      processedCinemas: 0,
      totalFilms: 0,
      processedFilms: 0,
      cinemaProgress: 0,
      filmProgress: 0,
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
    .map((job) => `${job.reportId}:${job.cinemaName ?? ''}`)
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
            error: undefined,
          };
        });
      },
      (error: Error) => {
        setState((prev) => ({
          ...prev,
          isConnected: false,
          error: error.message === 'Progress stream closed' ? undefined : error.message,
          jobs: mergeTrackedJobs(prev.events, trackedJobsRef.current),
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
    setState({
      events: [],
      jobs: mergeTrackedJobs([], trackedJobsRef.current),
      isConnected: state.isConnected,
    });
  };

  return {
    ...state,
    reset,
  };
}
