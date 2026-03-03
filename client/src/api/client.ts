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
} from '../types';
import { logger } from '../utils/logger';

// Create axios instance
// Use relative path by default to work with proxy in dev and same-origin in prod
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
          originalPath: window.location.pathname 
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
  const response = await apiClient.get<ApiResponse<Cinema[]>>('/cinemas');
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch cinemas');
  }
  return response.data.data;
}

export async function getCinemaSchedule(
  cinemaId: string
): Promise<{ showtimes: ShowtimeWithFilm[]; weekStart: string }> {
  const response = await apiClient.get<ApiResponse<{ showtimes: ShowtimeWithFilm[]; weekStart: string }>>(
    `/cinemas/${cinemaId}`
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
  const response = await apiClient.post<ApiResponse<{ reportId: number; message: string }>>('/scraper/trigger');
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to trigger scrape');
  }
  return response.data.data;
}

export async function triggerCinemaScrape(cinemaId: string): Promise<{ reportId: number; message: string }> {
  const response = await apiClient.post<ApiResponse<{ reportId: number; message: string }>>('/scraper/trigger', {
    cinemaId,
  });
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to trigger cinema scrape');
  }
  return response.data.data;
}

export async function triggerFilmScrape(filmId: number): Promise<{ reportId: number; message: string }> {
  const response = await apiClient.post<ApiResponse<{ reportId: number; message: string }>>('/scraper/trigger', {
    filmId,
  });
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to trigger film scrape');
  }
  return response.data.data;
}

export async function getScrapeStatus(): Promise<ScrapeStatus> {
  const response = await apiClient.get<ApiResponse<ScrapeStatus>>('/scraper/status');
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch scrape status');
  }
  return response.data.data;
}

export function subscribeToProgress(onEvent: (event: any) => void, onError?: (error: Error) => void): () => void {
  const eventSource = new EventSource(`${API_BASE_URL}/scraper/progress`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onEvent(data);
    } catch (error) {
      logger.error('Failed to parse SSE event', { detail: String(error) });
    }
  };

  eventSource.onerror = (error) => {
    logger.error('SSE connection error', { detail: String(error) });
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
// REPORTS API
// ============================================================================

export async function getScrapeReports(params?: {
  page?: number;
  pageSize?: number;
  status?: 'running' | 'success' | 'partial_success' | 'failed';
  triggerType?: 'manual' | 'cron';
}): Promise<PaginatedResponse<ScrapeReport>> {
  const response = await apiClient.get<ApiResponse<PaginatedResponse<ScrapeReport>>>('/reports', { params });
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch reports');
  }
  return response.data.data;
}

export async function getScrapeReportById(id: number): Promise<ScrapeReport> {
  const response = await apiClient.get<ApiResponse<ScrapeReport>>(`/reports/${id}`);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch report');
  }
  return response.data.data;
}

// Export api instance for custom requests
export default apiClient;
