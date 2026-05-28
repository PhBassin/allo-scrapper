import type {
  ApiResponse,
  MovieWithShowtimes,
  Movie,
  Cinema,
  ShowtimeWithMovie,
  ScrapeReport,
  PaginatedResponse,
  ScrapeStatus,
  ProgressEvent,
  ScrapeSchedule,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Track refresh promise to deduplicate concurrent refresh attempts
let refreshPromise: Promise<boolean> | null = null;

// Prevent duplicate auth:unauthorized events from concurrent 401s
let unauthorizedDispatched = false;

/**
 * Read CSRF token from cookie.
 */
function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? match[1] : null;
}

/**
 * Attempt to refresh the access token using the refresh token cookie.
 * Returns true if refresh succeeded, false otherwise.
 */
async function refreshAccessToken(): Promise<boolean> {
  try {
    const csrfToken = getCsrfToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return false;

    const data = await response.json();
    if (data.success) {
      if (data.data?.user) {
        localStorage.setItem('user', JSON.stringify(data.data.user));
      }
      unauthorizedDispatched = false;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  public status?: number;
  public data?: any;

  constructor(message: string, status?: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Fetch wrapper handling auth, JSON parsing, and common errors.
 * Supports automatic token refresh on 401 responses.
 */
async function fetchClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Setup headers
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Add CSRF token for mutation requests
  const method = (options.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
    }
  }

  const config: RequestInit = {
    ...options,
    credentials: 'include', // Send cookies (refresh_token, csrf_token)
    headers,
  };

  try {
    const response = await fetch(url, config);

    // Handle 401 Unauthorized — try token refresh once
    if (response.status === 401) {
      // Deduplicate concurrent refresh attempts
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }

      const refreshed = await refreshPromise;

      if (refreshed) {
        // Retry the original request — browser sends access_token cookie automatically
        // Re-read CSRF token (may have been rotated)
        const newCsrfToken = getCsrfToken();
        if (newCsrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
          headers.set('X-CSRF-Token', newCsrfToken);
        }

        const retryResponse = await fetch(url, { ...config, headers });
        
        if (retryResponse.ok) {
          let retryData;
          if (retryResponse.status !== 204 && retryResponse.headers.get('content-length') !== '0') {
            const contentType = retryResponse.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              retryData = await retryResponse.json();
            } else {
              retryData = await retryResponse.text();
            }
          }
          return retryData;
        }
      }

      // Refresh failed — dispatch unauthorized event (only once)
      if (!unauthorizedDispatched) {
        unauthorizedDispatched = true;
        const event = new CustomEvent('auth:unauthorized', {
          detail: { 
            originalPath: window.location.pathname,
            reason: 'session_expired' as const,
          }
        });
        window.dispatchEvent(event);
      }
      throw new ApiError('Unauthorized', 401);
    }

    let data;
    if (response.status !== 204 && response.headers.get('content-length') !== '0') {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
    }

    if (!response.ok) {
      throw new ApiError(
        data?.error || `HTTP error! status: ${response.status}`,
        response.status,
        data
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(error instanceof Error ? error.message : 'Unknown network error', 0);
  }
}

// Helper methods
const apiClient = {
  get: <T>(endpoint: string, params?: Record<string, string | number | boolean | undefined | null | string[] | number[]>) => {
    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => searchParams.append(`${key}[]`, String(v)));
          } else {
            searchParams.append(key, String(value));
          }
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }
    return fetchClient<T>(url, { method: 'GET' });
  },
  post: <T>(endpoint: string, data?: any) => 
    fetchClient<T>(endpoint, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  put: <T>(endpoint: string, data?: any) => 
    fetchClient<T>(endpoint, { method: 'PUT', body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(endpoint: string) => 
    fetchClient<T>(endpoint, { method: 'DELETE' }),
};

// ============================================================================
// MOVIES API
// ============================================================================

export async function getWeeklyMovies(): Promise<{ movies: MovieWithShowtimes[]; weekStart: string }> {
  const response = await apiClient.get<ApiResponse<{ movies: MovieWithShowtimes[]; weekStart: string }>>('/movies');
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch movies');
  }
  return response.data;
}

export async function getMoviesByDate(date: string): Promise<{ movies: MovieWithShowtimes[]; weekStart: string; date: string }> {
  const response = await apiClient.get<ApiResponse<{ movies: MovieWithShowtimes[]; weekStart: string; date: string }>>('/movies', { date });
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch movies');
  }
  return response.data;
}

export async function getMovieById(id: number): Promise<MovieWithShowtimes> {
  const response = await apiClient.get<ApiResponse<MovieWithShowtimes>>(`/movies/${id}`);
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch movie');
  }
  return response.data;
}

/**
 * Search movies using fuzzy matching
 * @param query Search query (minimum 2 characters)
 * @returns Array of movies matching the search query
 */
export async function searchMovies(query: string): Promise<Movie[]> {
  // Validate query locally to avoid unnecessary API calls
  if (!query || query.trim().length < 2) {
    return [];
  }

  const response = await apiClient.get<ApiResponse<{ movies: Movie[]; query: string }>>('/movies/search', { q: query.trim() });

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to search movies');
  }

  return response.data.movies;
}

// ============================================================================
// THEATERS API
// ============================================================================

export async function getTheaters(): Promise<Cinema[]> {
  const response = await apiClient.get<ApiResponse<Cinema[]>>('/theaters');
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch theaters');
  }
  return response.data;
}

export async function getTheaterSchedule(
  theaterId: string
): Promise<{ showtimes: ShowtimeWithMovie[]; weekStart: string }> {
  const response = await apiClient.get<ApiResponse<{ showtimes: ShowtimeWithMovie[]; weekStart: string }>>(
    `/theaters/${theaterId}`
  );
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch theater schedule');
  }
  return response.data;
}

export async function addTheater(url: string): Promise<Cinema> {
  const response = await apiClient.post<ApiResponse<Cinema>>('/theaters', { url });
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to add theater');
  }
  return response.data;
}

// ============================================================================
// SCRAPER API
// ============================================================================

export async function triggerScrape(): Promise<{ reportId: number; message: string }> {
  const response = await apiClient.post<ApiResponse<{ reportId: number; message: string }>>('/scraper/trigger');
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to trigger scrape');
  }
  return response.data;
}

export async function triggerTheaterScrape(theaterId: string): Promise<{ reportId: number; message: string }> {
  const response = await apiClient.post<ApiResponse<{ reportId: number; message: string }>>('/scraper/trigger', {
    theaterId,
  });
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to trigger theater scrape');
  }
  return response.data;
}

export async function triggerMovieScrape(movieId: number): Promise<{ reportId: number; message: string }> {
  const response = await apiClient.post<ApiResponse<{ reportId: number; message: string }>>('/scraper/trigger', {
    movieId,
  });
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to trigger movie scrape');
  }
  return response.data;
}

export async function getScrapeStatus(): Promise<ScrapeStatus> {
  const response = await apiClient.get<ApiResponse<ScrapeStatus>>('/scraper/status');
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch scrape status');
  }
  return response.data;
}

export function subscribeToProgress(onEvent: (event: ProgressEvent) => void, onError?: (error: Error) => void): () => void {
  const eventSource = new EventSource(`${API_BASE_URL}/scraper/progress`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onEvent(data);
    } catch (error) {
      console.error('Failed to parse SSE event:', error);
    }
  };

  eventSource.onerror = (error) => {
    console.error('SSE connection error:', error);
    if (onError) {
      onError(new Error('Connection lost'));
    }
  };

  // Return unsubscribe function
  return () => {
    eventSource.close();
  };
}

// ============================================================================
// SCHEDULES API
// ============================================================================

export async function getSchedules(): Promise<ScrapeSchedule[]> {
  const response = await apiClient.get<ApiResponse<ScrapeSchedule[]>>('/scraper/schedules');
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch schedules');
  }
  return response.data;
}

export async function getSchedule(id: number): Promise<ScrapeSchedule> {
  const response = await apiClient.get<ApiResponse<ScrapeSchedule>>(`/scraper/schedules/${id}`);
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch schedule');
  }
  return response.data;
}

export interface CreateSchedulePayload {
  name: string;
  description?: string | null;
  cron_expression: string;
  enabled?: boolean;
  target_theaters?: string[] | null;
}

export async function createSchedule(payload: CreateSchedulePayload): Promise<ScrapeSchedule> {
  const response = await apiClient.post<ApiResponse<ScrapeSchedule>>('/scraper/schedules', payload);
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to create schedule');
  }
  return response.data;
}

export interface UpdateSchedulePayload {
  name?: string;
  description?: string | null;
  cron_expression?: string;
  enabled?: boolean;
  target_theaters?: string[] | null;
}

export async function updateSchedule(id: number, payload: UpdateSchedulePayload): Promise<ScrapeSchedule> {
  const response = await apiClient.put<ApiResponse<ScrapeSchedule>>(`/scraper/schedules/${id}`, payload);
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to update schedule');
  }
  return response.data;
}

export async function deleteSchedule(id: number): Promise<void> {
  await apiClient.delete(`/scraper/schedules/${id}`);
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
  const response = await apiClient.get<ApiResponse<PaginatedResponse<ScrapeReport>>>('/reports', params as Record<string, string | number>);
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch reports');
  }
  return response.data;
}

export async function getScrapeReportById(id: number): Promise<ScrapeReport> {
  const response = await apiClient.get<ApiResponse<ScrapeReport>>(`/reports/${id}`);
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch report');
  }
  return response.data;
}

export interface ScrapeAttempt {
  id: number;
  report_id: number;
  theater_id: string;
  date: string;
  status: 'pending' | 'success' | 'failed' | 'rate_limited' | 'not_attempted';
  error_type?: string | null;
  error_message?: string | null;
  http_status_code?: number | null;
  movies_scraped: number;
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
  const response = await apiClient.get<ApiResponse<ReportDetails>>(`/reports/${id}/details`);
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch report details');
  }
  return response.data;
}

export async function resumeScrape(reportId: number): Promise<{ reportId: number; parentReportId: number; pendingAttempts: number; message: string }> {
  const response = await apiClient.post<ApiResponse<{ reportId: number; parentReportId: number; pendingAttempts: number; message: string }>>(`/scraper/resume/${reportId}`);
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to resume scrape');
  }
  return response.data;
}

// Export api instance for custom requests
export default apiClient;
