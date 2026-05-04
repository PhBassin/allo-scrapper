import { Response } from 'express';

const HEARTBEAT_INTERVAL_MS = 30_000;
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

declare global {
  var __alloScrapperProgressTracker__: ProgressTracker | undefined;
}

export interface ProgressTraceContext {
  org_id?: string;
  org_slug?: string;
  user_id?: string;
  endpoint?: string;
  method?: string;
  traceparent?: string;
}

// Progress event types
type ProgressEventPayload =
  | { type: 'started'; total_cinemas: number; total_dates: number }
  | { type: 'cinema_started'; cinema_name: string; cinema_id: string; index: number }
  | { type: 'date_started'; date: string; cinema_name: string }
  | { type: 'date_stale'; date: string; cinema_name: string; actual_date: string }
  | { type: 'date_failed'; date: string; cinema_name: string; error: string }
  | { type: 'film_started'; film_title: string; film_id: number }
  | { type: 'film_completed'; film_title: string; showtimes_count: number }
  | { type: 'film_failed'; film_title: string; error: string }
  | { type: 'date_completed'; date: string; films_count: number }
  | { type: 'cinema_completed'; cinema_name: string; total_films: number }
  | { type: 'cinema_failed'; cinema_name: string; error: string }
  | { type: 'completed'; summary: ScrapeSummary }
  | { type: 'failed'; error: string };

export type ProgressEvent = ProgressEventPayload & {
  report_id?: number;
  traceContext?: ProgressTraceContext;
};

export interface ScrapeSummary {
  total_cinemas: number;
  successful_cinemas: number;
  failed_cinemas: number;
  total_films: number;
  total_showtimes: number;
  total_dates: number;
  duration_ms: number;
  errors: Array<{ 
    cinema_name: string;
    cinema_id: string;
    date?: string;
    error: string;
    error_type?: 'http_429' | 'http_5xx' | 'http_4xx' | 'network' | 'parse' | 'timeout';
    http_status_code?: number;
  }>;
  status?: 'success' | 'partial_success' | 'failed' | 'rate_limited';
}

interface ReplayableProgressEvent {
  id: number;
  event: ProgressEvent;
}

// Progress tracker class
export class ProgressTracker {
  private listeners: Set<Response> = new Set();
  private events: ProgressEvent[] = [];
  private replayableEvents: ReplayableProgressEvent[] = [];
  private nextEventId = 1;
  private heartbeatInterval?: NodeJS.Timeout;
  private traceContextByListener: Map<Response, ProgressTraceContext | undefined> = new Map();
  private lastBusinessActivityByListener: Map<Response, number> = new Map();

  private matchesListener(event: ProgressEvent, listenerTrace?: ProgressTraceContext): boolean {
    if (!listenerTrace?.org_slug) {
      return true;
    }

    return event.traceContext?.org_slug === listenerTrace.org_slug;
  }

  // Add a new SSE listener
  addListener(res: Response, traceContext?: ProgressTraceContext, lastEventId?: string): void {
    this.listeners.add(res);
    this.traceContextByListener.set(res, traceContext);
    this.lastBusinessActivityByListener.set(res, Date.now());

    const latestReplayableEventId = this.replayableEvents.at(-1)?.id;
    const normalizedLastEventId = this.normalizeLastEventId(lastEventId);
    const resumeAfterId = latestReplayableEventId !== undefined
      && normalizedLastEventId !== undefined
      && normalizedLastEventId > latestReplayableEventId
      ? undefined
      : normalizedLastEventId;

    // Send existing events to new listener
    for (const replayableEvent of this.replayableEvents) {
      if (resumeAfterId !== undefined && replayableEvent.id <= resumeAfterId) {
        continue;
      }

      if (!this.matchesListener(replayableEvent.event, traceContext)) {
        continue;
      }
      this.sendToListener(res, replayableEvent.event, replayableEvent.id);
    }

    // Start heartbeat if this is the first listener
    if (this.listeners.size === 1) {
      this.startHeartbeat();
    }
  }

  // Remove a listener
  removeListener(res: Response): void {
    this.listeners.delete(res);
    this.traceContextByListener.delete(res);
    this.lastBusinessActivityByListener.delete(res);

    // Stop heartbeat if no more listeners
    if (this.listeners.size === 0) {
      this.stopHeartbeat();
    }
  }

  hasListener(res: Response): boolean {
    return this.listeners.has(res);
  }

  // Emit a progress event to all listeners
  emit(event: ProgressEvent): void {
    if (event.type === 'started' && !this.hasActiveJobs()) {
      this.events = [];
      this.replayableEvents = [];
    }

    const eventId = this.nextEventId++;
    this.events.push(event);
    this.replayableEvents.push({ id: eventId, event });

    // Send to all connected listeners
    for (const listener of this.listeners) {
      if (!this.matchesListener(event, this.traceContextByListener.get(listener))) {
        continue;
      }
      this.sendToListener(listener, event, eventId);
    }
  }

  private normalizeLastEventId(lastEventId?: string): number | undefined {
    if (lastEventId === undefined) {
      return undefined;
    }

    const normalized = lastEventId.trim();
    if (!/^\d+$/.test(normalized)) {
      return undefined;
    }

    const parsed = Number(normalized);
    return Number.isSafeInteger(parsed) ? parsed : undefined;
  }

  private getLatestEventsByJob(listenerTrace?: ProgressTraceContext): Map<string, ProgressEvent> {
    const latestEventsByJob = new Map<string, ProgressEvent>();

    for (const event of this.events) {
      if (listenerTrace && !this.matchesListener(event, listenerTrace)) {
        continue;
      }

      latestEventsByJob.set(this.getJobKey(event), event);
    }

    return latestEventsByJob;
  }

  private hasActiveJobs(listenerTrace?: ProgressTraceContext): boolean {
    const latestEventsByJob = this.getLatestEventsByJob(listenerTrace);

    for (const event of latestEventsByJob.values()) {
      if (event.type !== 'completed' && event.type !== 'failed') {
        return true;
      }
    }

    return false;
  }

  private getJobKey(event: ProgressEvent): string {
    return event.report_id != null ? `report:${event.report_id}` : 'legacy';
  }

  // Send an event to a specific listener
  private sendToListener(res: Response, event: ProgressEvent, eventId: number): void {
    try {
      const listenerTrace = this.traceContextByListener.get(res);
      const payload: ProgressEvent = listenerTrace
        ? { ...event, traceContext: listenerTrace }
        : event;

      this.lastBusinessActivityByListener.set(res, Date.now());
      res.write(`id: ${eventId}\ndata: ${JSON.stringify(payload)}\n\n`);
    } catch (error) {
      this.removeListener(res);
    }
  }

  private sendHeartbeatToListener(res: Response, now: number): void {
    try {
      res.write(`data: ${JSON.stringify({ type: 'ping', timestamp: new Date(now).toISOString() })}\n\n`);
    } catch (error) {
      this.removeListener(res);
    }
  }

  private closeIdleListener(res: Response): void {
    this.removeListener(res);

    try {
      res.end();
    } catch (error) {
      // Ignore errors when closing an already disconnected listener.
    }
  }

  // Send heartbeat to keep connections alive
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();

      for (const listener of [...this.listeners]) {
        const listenerTrace = this.traceContextByListener.get(listener);

        if (this.hasActiveJobs(listenerTrace)) {
          this.sendHeartbeatToListener(listener, now);
          continue;
        }

        const lastBusinessActivity = this.lastBusinessActivityByListener.get(listener) ?? now;

        if (now - lastBusinessActivity >= IDLE_TIMEOUT_MS) {
          this.closeIdleListener(listener);
          continue;
        }

        this.sendHeartbeatToListener(listener, now);
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  // Stop heartbeat
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  // Clear all events and listeners
  reset(): void {
    this.events = [];
    this.replayableEvents = [];
    this.nextEventId = 1;
    this.stopHeartbeat();
    
    // Close all active connections
    for (const listener of this.listeners) {
      try {
        listener.end();
      } catch (error) {
        // Ignore errors when closing
      }
    }
    this.listeners.clear();
    this.traceContextByListener.clear();
    this.lastBusinessActivityByListener.clear();
  }

  // Get all events (for debugging or storing in database)
  getEvents(): ProgressEvent[] {
    return [...this.events];
  }

  // Get number of active listeners
  getListenerCount(): number {
    return this.listeners.size;
  }
}

// Use a process-global singleton so src/ and dist/ imports share listeners/events in dev.
export const progressTracker = globalThis.__alloScrapperProgressTracker__ ??= new ProgressTracker();
