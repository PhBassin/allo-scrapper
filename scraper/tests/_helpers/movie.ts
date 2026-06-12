/**
 * Test helpers for building Movie objects in scraper tests.
 *
 * Usage:
 *   import { makeMockMovie } from '../../tests/_helpers/movie.js';
 *   const movie = makeMockMovie({ id: 123, title: 'Test Movie' });
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MockMovieOverrides {
  id?: number;
  title?: string;
  original_title?: string | null;
  poster_url?: string | null;
  duration_minutes?: number | null;
  release_date?: string | null;
  rerelease_date?: string | null;
  genres?: string[];
  nationality?: string | null;
  director?: string | null;
  screenwriters?: string[];
  actors?: string[];
  synopsis?: string | null;
  certificate?: string | null;
  press_rating?: number | null;
  audience_rating?: number | null;
  source_url?: string;
  trailer_url?: string | null;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Builds a mock Movie object with sensible defaults.
 * All fields can be overridden via the `overrides` parameter.
 */
export function makeMockMovie(overrides: MockMovieOverrides = {}) {
  return {
    id: overrides.id ?? 1,
    title: overrides.title ?? 'Default Movie',
    original_title: overrides.original_title ?? null,
    poster_url: overrides.poster_url ?? null,
    duration_minutes: overrides.duration_minutes ?? null,
    release_date: overrides.release_date ?? null,
    rerelease_date: overrides.rerelease_date ?? null,
    genres: overrides.genres ?? [],
    nationality: overrides.nationality ?? null,
    director: overrides.director ?? null,
    screenwriters: overrides.screenwriters ?? [],
    actors: overrides.actors ?? [],
    synopsis: overrides.synopsis ?? null,
    certificate: overrides.certificate ?? null,
    press_rating: overrides.press_rating ?? null,
    audience_rating: overrides.audience_rating ?? null,
    source_url:
      overrides.source_url ??
      `https://www.allocine.fr/film/fichefilm_gen_cfilm=${overrides.id ?? 1}.html`,
    trailer_url: overrides.trailer_url ?? null,
  };
}
