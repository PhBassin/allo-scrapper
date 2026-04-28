import axios from 'axios';
import type {
  ApiResponse,
  FilmWithShowtimes,
  Film,
  Cinema,
  ShowtimeWithFilm,
  ScrapeReport,
  PaginatedResponse,
  ScrapeStatus,
  ProgressEvent,
  ScrapeSchedule,
} from '../types';

// Create axios instance
// Use relative path by default to work with proxy in dev and same-origin in prod
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

function getCinemasBasePath(): string {
  return getTenantScopedPath('/cinemas');
}

function getScraperBasePath(): string {
  return getTenantScopedPath('/scraper');
}

function getReportsBasePath(): string {
  return getTenantScopedPath('/reports');
}

function getOrgSlug(): string | undefined {
  const match = window.location.pathname.match(/^\/org\/([^/]+)/);
  return match?.[1];
}

export function getTenantScopedPath(path: string): string {
  const slug = getOrgSlug();
  if (!slug) {
    return path;
  }

  return `/org/${encodeURIComponent(slug)}${path}`;
}

// Add a request interceptor to include the JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle 401 errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Emit custom event for App.tsx to handle logout + redirect
      // This allows proper React Router navigation instead of window.location
      const event = new CustomEvent('auth:unauthorized', {
        detail: { 
          originalPath: window.location.pathname,
          reason: 'session_expired' as const,
        }
      });
      window.dispatchEvent(event);
    }
    return Promise.reject(error);
  }
);

// ============================================================================
// FILMS API
// ============================================================================

export async function getWeeklyFilms(): Promise<{ films: FilmWithShowtimes[]; weekStart: string }> {
  const response = await apiClient.get<ApiResponse<{ films: FilmWithShowtimes[]; weekStart: string }>>('/films');
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch films');
  }
  return response.data.data;
}

export async function getFilmsByDate(date: string): Promise<{ films: FilmWithShowtimes[]; weekStart: string; date: string }> {
  const response = await apiClient.get<ApiResponse<{ films: FilmWithShowtimes[]; weekStart: string; date: string }>>('/films', {
    params: { date }
  });
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch films');
  }
  return response.data.data;
}

export async function getFilmById(id: number): Promise<FilmWithShowtimes> {
  const response = await apiClient.get<ApiResponse<FilmWithShowtimes>>(`/films/${id}`);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch film');
  }
  return response.data.data;
}

/**
 * Search films using fuzzy matching
 * @param query Search query (minimum 2 characters)
 * @returns Array of films matching the search query
 */
export async function searchFilms(query: string): Promise<Film[]> {
  // Validate query locally to avoid unnecessary API calls
  if (!query || query.trim().length < 2) {
    return [];
  }

  const response = await apiClient.get<ApiResponse<{ films: Film[]; query: string }>>('/films/search', {
    params: { q: query.trim() }
  });

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to search films');
  }

  return response.data.data.films;
}

// ============================================================================
// CINEMAS API
// ============================================================================

export async function getCinemas(): Promise<Cinema[]> {
  const response = await apiClient.get<ApiResponse<Cinema[]>>(getCinemasBasePath());
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch cinemas');
  }
  return response.data.data;
}

export async function getCinemaSchedule(
  cinemaId: string
): Promise<{ showtimes: ShowtimeWithFilm[]; weekStart: string }> {
  const response = await apiClient.get<ApiResponse<{ showtimes: ShowtimeWithFilm[]; weekStart: string }>>(
    `${getCinemasBasePath()}/${cinemaId}`
  );
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch cinema schedule');
  }
  return response.data.data;
}

export async function addCinema(url: string): Promise<Cinema> {
  const response = await apiClient.post<ApiResponse<Cinema>>('/cinemas', { url });
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to add cinema');
  }
  return response.data.data;
}

// ============================================================================
// SCRAPER API
// ============================================================================

export async function triggerScrape(): Promise<{ reportId: number; message: string }> {
  const response = await apiClient.post<ApiResponse<{ reportId: number; message: string }>>(`${getScraperBasePath()}/trigger`);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to trigger scrape');
  }
  return response.data.data;
}

export async function triggerCinemaScrape(cinemaId: string): Promise<{ reportId: number; message: string }> {
  const response = await apiClient.post<ApiResponse<{ reportId: number; message: string }>>(`${getScraperBasePath()}/trigger`, {
    cinemaId,
  });
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to trigger cinema scrape');
  }
  return response.data.data;
}

export async function triggerFilmScrape(filmId: number): Promise<{ reportId: number; message: string }> {
  const response = await apiClient.post<ApiResponse<{ reportId: number; message: string }>>(`${getScraperBasePath()}/trigger`, {
    filmId,
  });
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to trigger film scrape');
  }
  return response.data.data;
}

export async function getScrapeStatus(): Promise<ScrapeStatus> {
  const response = await apiClient.get<ApiResponse<ScrapeStatus>>(`${getScraperBasePath()}/status`);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch scrape status');
  }
  return response.data.data;
}

export function subscribeToProgress(onEvent: (event: ProgressEvent) => void, onError?: (error: Error) => void): () => void {
  const controller = new AbortController();
  const token = localStorage.getItem('token');
  const url = `${API_BASE_URL}${getScraperBasePath()}/progress`;

  const processMessage = (message: string) => {
    const lines = message
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'));

    if (lines.length === 0) {
      return;
    }

    const raw = lines
      .map((line) => line.slice(5).trimStart())
      .join('\n');

    try {
      const data = JSON.parse(raw);
      onEvent(data);
    } catch (error) {
      console.error('Failed to parse SSE event:', error);
    }
  };

  void (async () => {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: controller.signal,
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Progress stream request failed (${response.status})`);
      }

      if (!response.body) {
        throw new Error('Progress stream is unavailable');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          buffer += decoder.decode();

          if (buffer.trim()) {
            processMessage(buffer);
            buffer = '';
          }

          if (!controller.signal.aborted) {
            onError?.(new Error('Progress stream closed'));
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const messages = buffer.split(/\r?\n\r?\n/);
        buffer = messages.pop() ?? '';

        for (const message of messages) {
          processMessage(message);
        }
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      console.error('SSE connection error:', error);
      onError?.(error instanceof Error ? error : new Error('Connection lost'));
    }
  })();

  return () => {
    controller.abort();
  };
}

// ============================================================================
// SCHEDULES API
// ============================================================================

export async function getSchedules(): Promise<ScrapeSchedule[]> {
  const response = await apiClient.get<ApiResponse<ScrapeSchedule[]>>(`${getScraperBasePath()}/schedules`);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch schedules');
  }
  return response.data.data;
}

export async function getSchedule(id: number): Promise<ScrapeSchedule> {
  const response = await apiClient.get<ApiResponse<ScrapeSchedule>>(`${getScraperBasePath()}/schedules/${id}`);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch schedule');
  }
  return response.data.data;
}

export interface CreateSchedulePayload {
  name: string;
  description?: string | null;
  cron_expression: string;
  enabled?: boolean;
  target_cinemas?: string[] | null;
}

export async function createSchedule(payload: CreateSchedulePayload): Promise<ScrapeSchedule> {
  const response = await apiClient.post<ApiResponse<ScrapeSchedule>>(`${getScraperBasePath()}/schedules`, payload);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to create schedule');
  }
  return response.data.data;
}

export interface UpdateSchedulePayload {
  name?: string;
  description?: string | null;
  cron_expression?: string;
  enabled?: boolean;
  target_cinemas?: string[] | null;
}

export async function updateSchedule(id: number, payload: UpdateSchedulePayload): Promise<ScrapeSchedule> {
  const response = await apiClient.put<ApiResponse<ScrapeSchedule>>(`${getScraperBasePath()}/schedules/${id}`, payload);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to update schedule');
  }
  return response.data.data;
}

export async function deleteSchedule(id: number): Promise<void> {
  await apiClient.delete(`${getScraperBasePath()}/schedules/${id}`);
}

// ============================================================================
// REPORTS API
// ============================================================================

export async function getScrapeReports(params?: {
  page?: number;
  pageSize?: number;
  status?: 'running' | 'success' | 'partial_success' | 'failed';
  triggerType?: 'manual' | 'cron';
}): Promise<PaginatedResponse<ScrapeReport>> {
  const response = await apiClient.get<ApiResponse<PaginatedResponse<ScrapeReport>>>(getReportsBasePath(), { params });
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch reports');
  }
  return response.data.data;
}

export async function getScrapeReportById(id: number): Promise<ScrapeReport> {
  const response = await apiClient.get<ApiResponse<ScrapeReport>>(`${getReportsBasePath()}/${id}`);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch report');
  }
  return response.data.data;
}

export interface ScrapeAttempt {
  id: number;
  report_id: number;
  cinema_id: string;
  date: string;
  status: 'pending' | 'success' | 'failed' | 'rate_limited' | 'not_attempted';
  error_type?: string | null;
  error_message?: string | null;
  http_status_code?: number | null;
  films_scraped: number;
  showtimes_scraped: number;
  attempted_at: string;
}

export interface ReportDetails {
  report: ScrapeReport;
  attempts: Record<string, ScrapeAttempt[]>;
  summary: {
    total_attempts: number;
    successful: number;
    failed: number;
    rate_limited: number;
    not_attempted: number;
    pending: number;
  };
}

export async function getReportDetails(id: number): Promise<ReportDetails> {
  const response = await apiClient.get<ApiResponse<ReportDetails>>(`${getReportsBasePath()}/${id}/details`);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch report details');
  }
  return response.data.data;
}

export async function resumeScrape(reportId: number): Promise<{ reportId: number; parentReportId: number; pendingAttempts: number; message: string }> {
  const response = await apiClient.post<ApiResponse<{ reportId: number; parentReportId: number; pendingAttempts: number; message: string }>>(`${getScraperBasePath()}/resume/${reportId}`);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to resume scrape');
  }
  return response.data.data;
}

// Export api instance for custom requests
export default apiClient;
