import axios from 'axios';
import type {
  ApiResponse,
  FilmWithShowtimes,
  Cinema,
  ShowtimeWithFilm,
  ScrapeReport,
  PaginatedResponse,
  ScrapeStatus,
} from '../types';

// Create axios instance
// Use relative path by default to work with proxy in dev and same-origin in prod
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================================
// FILMS API
// ============================================================================

export async function getWeeklyFilms(): Promise<{ films: FilmWithShowtimes[]; weekStart: string }> {
  const response = await api.get<ApiResponse<{ films: FilmWithShowtimes[]; weekStart: string }>>('/films');
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch films');
  }
  return response.data.data;
}

export async function getFilmById(id: number): Promise<FilmWithShowtimes> {
  const response = await api.get<ApiResponse<FilmWithShowtimes>>(`/films/${id}`);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch film');
  }
  return response.data.data;
}

// ============================================================================
// CINEMAS API
// ============================================================================

export async function getCinemas(): Promise<Cinema[]> {
  const response = await api.get<ApiResponse<Cinema[]>>('/cinemas');
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch cinemas');
  }
  return response.data.data;
}

export async function getCinemaSchedule(
  cinemaId: string
): Promise<{ showtimes: ShowtimeWithFilm[]; weekStart: string }> {
  const response = await api.get<ApiResponse<{ showtimes: ShowtimeWithFilm[]; weekStart: string }>>(
    `/cinemas/${cinemaId}`
  );
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch cinema schedule');
  }
  return response.data.data;
}

// ============================================================================
// SCRAPER API
// ============================================================================

export async function triggerScrape(): Promise<{ reportId: number; message: string }> {
  const response = await api.post<ApiResponse<{ reportId: number; message: string }>>('/scraper/trigger');
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to trigger scrape');
  }
  return response.data.data;
}

export async function getScrapeStatus(): Promise<ScrapeStatus> {
  const response = await api.get<ApiResponse<ScrapeStatus>>('/scraper/status');
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
// REPORTS API
// ============================================================================

export async function getScrapeReports(params?: {
  page?: number;
  pageSize?: number;
  status?: 'running' | 'success' | 'partial_success' | 'failed';
  triggerType?: 'manual' | 'cron';
}): Promise<PaginatedResponse<ScrapeReport>> {
  const response = await api.get<ApiResponse<PaginatedResponse<ScrapeReport>>>('/reports', { params });
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch reports');
  }
  return response.data.data;
}

export async function getScrapeReportById(id: number): Promise<ScrapeReport> {
  const response = await api.get<ApiResponse<ScrapeReport>>(`/reports/${id}`);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to fetch report');
  }
  return response.data.data;
}

// Export api instance for custom requests
export default api;
