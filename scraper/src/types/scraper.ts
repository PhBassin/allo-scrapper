// Types TypeScript partagés pour le scraper microservice

export interface Cinema {
  id: string; // Unique cinema identifier (e.g., "W7504", "C0072")
  name: string;
  address?: string;
  postal_code?: string;
  city?: string;
  screen_count?: number;
  image_url?: string;
  url?: string; // Source website page URL for scraping
  source?: string; // Scraper source (e.g., "allocine")
}

export interface Movie {
  id: number; // Unique movie identifier
  title: string;
  original_title?: string;
  poster_url?: string;
  duration_minutes?: number;
  release_date?: string; // Format YYYY-MM-DD
  rerelease_date?: string; // Format YYYY-MM-DD
  genres: string[]; // ["Drama", "Comedy"]
  nationality?: string;
  director?: string;
  screenwriters?: string[];
  actors: string[];
  synopsis?: string;
  certificate?: string; // "All audiences", "16+"
  press_rating?: number; // Rating out of 5
  audience_rating?: number; // Rating out of 5
  source_url: string;
  trailer_url?: string;
}

export interface Showtime {
  id: string; // Unique showtime identifier
  movie_id: number;
  cinema_id: string;
  date: string; // Format YYYY-MM-DD
  time: string; // Format HH:MM
  datetime_iso: string; // Full ISO 8601
  version: string; // "VF", "VO", "VOST"
  format?: string; // "Digital", "Dolby", etc.
  experiences: string[]; // ["Language.French", "Format.Projection.Digital"]
  week_start: string; // Wednesday date (YYYY-MM-DD)
}

export interface WeeklyProgram {
  id?: number;
  cinema_id: string;
  movie_id: number;
  week_start: string; // Date du mercredi (YYYY-MM-DD)
  is_new_this_week: boolean;
  scraped_at: string; // ISO 8601
}

// Configuration d'un cinéma
export interface CinemaConfig {
  id: string;
  name: string;
  url: string;
  source: string;
}

// Data parsed from cinema page
export interface TheaterPageData {
  cinema: Cinema;
  movies: MovieShowtimeData[];
  dates: string[]; // Available dates
  selected_date: string;
}

// Movie data with its showtimes on cinema page
export interface MovieShowtimeData {
  movie: Movie;
  showtimes: Showtime[];
  is_new_this_week: boolean;
}

export interface CinemaWithShowtimes extends Cinema {
  showtimes: Showtime[];
}

export interface MovieWithShowtimes extends Movie {
  cinemas: CinemaWithShowtimes[];
}

// Data parsed from movie details page
export interface MoviePageData {
  duration_minutes?: number;
  trailer_url?: string;
  director?: string;
  screenwriters?: string[];
}

// Progress event types (published to Redis)
export type ProgressEvent = {
  report_id?: number;
  traceContext?: {
    org_id?: string;
    org_slug?: string;
    user_id?: string;
    endpoint?: string;
    method?: string;
    traceparent?: string;
  };
} & (
  | { type: 'started'; total_cinemas: number; total_dates: number }
  | { type: 'cinema_started'; cinema_name: string; cinema_id: string; index: number }
  | { type: 'date_started'; date: string; cinema_name: string }
  | { type: 'date_stale'; date: string; cinema_name: string; actual_date: string }
  | { type: 'date_failed'; date: string; cinema_name: string; error: string }
  | { type: 'movie_started'; movie_title: string; movie_id: number }
  | { type: 'movie_completed'; movie_title: string; showtimes_count: number }
  | { type: 'movie_failed'; movie_title: string; error: string }
  | { type: 'date_completed'; date: string; movies_count: number }
  | { type: 'cinema_completed'; cinema_name: string; total_movies: number }
  | { type: 'cinema_failed'; cinema_name: string; error: string }
  | { type: 'completed'; summary: ScrapeSummary }
  | { type: 'failed'; error: string }
);

export interface ScrapeSummary {
  total_cinemas: number;
  successful_cinemas: number;
  failed_cinemas: number;
  total_movies: number;
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
  circuit_state?: 'closed' | 'open' | 'half-open';
}
