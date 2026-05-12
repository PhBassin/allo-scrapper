// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Movie types
export interface Movie {
  id: number;
  title: string;
  original_title?: string;
  poster_url?: string;
  duration_minutes?: number;
  release_date?: string;
  rerelease_date?: string;
  genres: string[];
  nationality?: string;
  director?: string;
  screenwriters?: string[];
  actors: string[];
  synopsis?: string;
  certificate?: string;
  press_rating?: number;
  audience_rating?: number;
  source_url: string;
  trailer_url?: string;
}

// Theater types
export interface Theater {
  id: string;
  name: string;
  url?: string;
  address?: string;
  postal_code?: string;
  city?: string;
  screen_count?: number;
  image_url?: string;
}

// Showtime types
export interface Showtime {
  id: string;
  movie_id: number;
  theater_id: string;
  date: string;
  time: string;
  datetime_iso: string;
  version?: string;
  format?: string;
  experiences: string[];
  week_start: string;
}

export interface ShowtimeWithMovie extends Showtime {
  movie: Movie;
}

export interface MovieWithTheaters extends Movie {
  theaters: Theater[];
}

export interface TheaterWithShowtimes extends Theater {
  showtimes: Showtime[];
}

export interface MovieWithShowtimes extends Movie {
  theaters: TheaterWithShowtimes[];
}

// Scrape Report types
export interface ScrapeReport {
  id: number;
  started_at: string;
  completed_at?: string;
  status: 'running' | 'success' | 'partial_success' | 'failed' | 'rate_limited';
  trigger_type: 'manual' | 'cron';
  total_theaters?: number;
  successful_theaters?: number;
  failed_theaters?: number;
  total_movies_scraped?: number;
  total_showtimes_scraped?: number;
  errors?: Array<{ 
    theater_name: string; 
    theater_id?: string;
    date?: string;
    error: string;
    error_type?: 'http_429' | 'http_5xx' | 'http_4xx' | 'network' | 'parse' | 'timeout';
    http_status_code?: number;
  }>;
  progress_log?: Array<{ timestamp: string; message: string; level: string; type?: string }>;
}

// Progress Event types
export type ProgressEvent = {
  report_id?: number;
} & (
  | { type: 'started'; total_theaters: number; total_dates: number }
  | { type: 'theater_started'; theater_name: string; theater_id: string; index: number }
  | { type: 'date_started'; date: string; theater_name: string }
  | { type: 'date_stale'; date: string; theater_name: string; actual_date: string }
  | { type: 'date_failed'; date: string; theater_name: string; error: string }
  | { type: 'movie_started'; movie_title: string; movie_id: number }
  | { type: 'movie_completed'; movie_title: string; showtimes_count: number }
  | { type: 'movie_failed'; movie_title: string; error: string }
  | { type: 'date_completed'; date: string; movies_count: number }
  | { type: 'theater_completed'; theater_name: string; total_movies: number }
  | { type: 'theater_failed'; theater_name: string; error: string }
  | { type: 'completed'; summary: ScrapeSummary }
  | { type: 'ping'; timestamp: string }
  | { type: 'failed'; error: string }
);

export interface ScrapeSummary {
  total_theaters: number;
  successful_theaters: number;
  failed_theaters: number;
  total_movies: number;
  total_showtimes: number;
  total_dates: number;
  duration_ms: number;
  errors: Array<{
    theater_name: string;
    theater_id: string;
    date?: string;
    error: string;
    error_type?: 'http_429' | 'http_5xx' | 'http_4xx' | 'network' | 'parse' | 'timeout';
    http_status_code?: number;
  }>;
  status?: 'success' | 'partial_success' | 'failed' | 'rate_limited' | 'circuit_open';
}

export interface ScrapeStatus {
  isRunning: boolean;
  currentSession?: {
    reportId: number;
    triggerType: 'manual' | 'cron';
    startedAt: string;
    status: string;
  };
  latestReport?: ScrapeReport;
}

export interface ScrapeSchedule {
  id: number;
  name: string;
  description: string | null;
  cron_expression: string;
  enabled: boolean;
  target_theaters: string[] | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  last_run_status: string | null;
}
