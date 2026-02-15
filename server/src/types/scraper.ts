// Types TypeScript partagés pour le scraper et la base de données

export interface Cinema {
  id: string; // Identifiant Allociné (ex: "W7504", "C0072")
  name: string;
  address: string;
  postal_code: string;
  city: string;
  screen_count: number;
  image_url?: string;
}

export interface Film {
  id: number; // ID Allociné (extrait de cfilm=XXXXX)
  title: string;
  original_title?: string;
  poster_url?: string;
  duration_minutes?: number;
  release_date?: string; // Format YYYY-MM-DD
  rerelease_date?: string; // Format YYYY-MM-DD
  genres: string[]; // ["Drame", "Comédie"]
  nationality?: string;
  director?: string;
  actors: string[];
  synopsis?: string;
  certificate?: string; // "Tout public", "Interdit - 16 ans"
  press_rating?: number; // Note sur 5
  audience_rating?: number; // Note sur 5
  allocine_url: string;
}

export interface Showtime {
  id: string; // ID de séance Allociné (data-showtime-id)
  film_id: number;
  cinema_id: string;
  date: string; // Format YYYY-MM-DD
  time: string; // Format HH:MM
  datetime_iso: string; // ISO 8601 complet
  version: string; // "VF", "VO", "VOST"
  format?: string; // "Numérique", "Dolby", etc.
  experiences: string[]; // ["Localization.Language.French", "Format.Projection.Digital"]
  week_start: string; // Date du mercredi (YYYY-MM-DD)
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

// Données parsées depuis la page cinéma Allociné
export interface TheaterPageData {
  cinema: Cinema;
  films: FilmShowtimeData[];
  dates: string[]; // Dates disponibles
  selected_date: string;
}

// Données d'un film avec ses séances sur la page cinéma
export interface FilmShowtimeData {
  film: Film;
  showtimes: Showtime[];
  is_new_this_week: boolean;
}

// Données parsées depuis la fiche film Allociné
export interface FilmPageData {
  duration_minutes?: number;
  trailer_url?: string;
}
