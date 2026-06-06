// Types TypeScript partagés pour le scraper et la base de données

export interface Theater {
  id: string; // Unique theater identifier (e.g., "W7504", "C0072")
  name: string;
  address?: string;
  postal_code?: string;
  city?: string;
  screen_count?: number;
  image_url?: string;
  url?: string; // Source website page URL for scraping
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
  theater_id: string;
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
  theater_id: string;
  movie_id: number;
  week_start: string; // Date du mercredi (YYYY-MM-DD)
  is_new_this_week: boolean;
  scraped_at: string; // ISO 8601
}

// Configuration d'un theater
export interface TheaterConfig {
  id: string;
  name: string;
  url: string;
}

export interface TheaterWithShowtimes extends Theater {
  showtimes: Showtime[];
}

export interface MovieWithShowtimes extends Movie {
  theaters: TheaterWithShowtimes[];
}
