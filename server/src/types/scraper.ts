// Types TypeScript partagés pour le scraper et la base de données

export interface Cinema {
  id: string; // Unique cinema identifier (e.g., "W7504", "C0072")
  name: string;
  address?: string;
  postal_code?: string;
  city?: string;
  screen_count?: number;
  image_url?: string;
  url?: string; // AlloCiné page URL for scraping
}

export interface Film {
  id: number; // Unique film identifier
  title: string;
  original_title?: string;
  poster_url?: string;
  duration_minutes?: number;
  release_date?: string; // Format YYYY-MM-DD
  rerelease_date?: string; // Format YYYY-MM-DD
  genres: string[]; // ["Drama", "Comedy"]
  nationality?: string;
  director?: string;
  actors: string[];
  synopsis?: string;
  certificate?: string; // "All audiences", "16+"
  press_rating?: number; // Rating out of 5
  audience_rating?: number; // Rating out of 5
  source_url: string;
}

export interface Showtime {
  id: string; // Unique showtime identifier
  film_id: number;
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
  film_id: number;
  week_start: string; // Date du mercredi (YYYY-MM-DD)
  is_new_this_week: boolean;
  scraped_at: string; // ISO 8601
}

// Configuration d'un cinéma
export interface CinemaConfig {
  id: string;
  name: string;
  url: string;
}

// Data parsed from cinema page
export interface TheaterPageData {
  cinema: Cinema;
  films: FilmShowtimeData[];
  dates: string[]; // Available dates
  selected_date: string;
}

// Film data with its showtimes on cinema page
export interface FilmShowtimeData {
  film: Film;
  showtimes: Showtime[];
  is_new_this_week: boolean;
}

export interface CinemaWithShowtimes extends Cinema {
  showtimes: Showtime[];
}

export interface FilmWithShowtimes extends Film {
  cinemas: CinemaWithShowtimes[];
}

// Data parsed from film details page
export interface FilmPageData {
  duration_minutes?: number;
  trailer_url?: string;
}
