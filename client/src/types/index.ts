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

// Film types
export interface Film {
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

// Cinema types
export interface Cinema {
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
  film_id: number;
  cinema_id: string;
  date: string;
  time: string;
  datetime_iso: string;
  version?: string;
  format?: string;
  experiences: string[];
  week_start: string;
}

export interface ShowtimeWithFilm extends Showtime {
  film: Film;
}

export interface FilmWithCinemas extends Film {
  cinemas: Cinema[];
}

export interface CinemaWithShowtimes extends Cinema {
  showtimes: Showtime[];
}

export interface FilmWithShowtimes extends Film {
  cinemas: CinemaWithShowtimes[];
}

// Scrape Report types
export interface ScrapeReport {
  id: number;
  started_at: string;
  completed_at?: string;
  status: 'running' | 'success' | 'partial_success' | 'failed' | 'rate_limited';
  trigger_type: 'manual' | 'cron';
  total_cinemas?: number;
  successful_cinemas?: number;
  failed_cinemas?: number;
  total_films_scraped?: number;
  total_showtimes_scraped?: number;
  errors?: Array<{ 
    cinema_name: string; 
    cinema_id?: string;
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
  | { type: 'ping'; timestamp: string }
  | { type: 'failed'; error: string }
);

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
  target_cinemas: string[] | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  last_run_status: string | null;
}
