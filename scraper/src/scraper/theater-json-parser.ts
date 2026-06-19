import type { MovieShowtimeData, Movie, Showtime } from '../types/scraper.js';
import { logger } from '../utils/logger.js';
import { decodeHtmlEntities, decodeHtmlEntitiesArray } from '../utils/html-decode.js';

// ── Allociné internal API response types ──────────────────────────────────────

interface AllocinePoster {
  url?: string;
}

interface AllocineRelease {
  releaseDate?: { date?: string };
  name?: string; // e.g. "Sortie", "Reprise", etc.
}

interface AllocineStats {
  userRating?: { score?: number };
  pressReview?: { score?: number };
}

interface AllocineGenre {
  translate?: string;
}

interface AllocineCountry {
  localizedName?: string;
}

interface AllocineCredit {
  person?: { fullName?: string };
  position?: { name?: string };
}

interface AllocineMovie {
  internalId?: number;
  id?: string; // e.g. "movie:movie:_:12345"
  title?: string;
  originalTitle?: string;
  synopsis?: string;
  runtime?: number; // seconds
  poster?: AllocinePoster;
  genres?: AllocineGenre[];
  countries?: AllocineCountry[];
  credits?: AllocineCredit[];
  stats?: AllocineStats;
  releases?: AllocineRelease[];
  flags?: { isNewRelease?: boolean };
}

interface AllocineShowtime {
  internalId?: number;
  startsAt?: string; // ISO 8601, e.g. "2026-02-22T11:45:00"
  diffusionVersion?: string; // "ORIGINAL" | "LOCAL" | "DUBBED"
  projection?: string[];
  sound?: string[];
  picture?: string[];
  experience?: string[];
  tags?: string[];
}

interface AllocineShowtimesGroup {
  original?: AllocineShowtime[];
  original_st?: AllocineShowtime[];
  original_st_sme?: AllocineShowtime[];
  multiple?: AllocineShowtime[];
  multiple_st?: AllocineShowtime[];
  multiple_st_sme?: AllocineShowtime[];
}

interface AllocineResult {
  movie: AllocineMovie;
  showtimes: AllocineShowtimesGroup;
}

interface AllocineApiResponse {
  error?: boolean;
  results?: AllocineResult[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const VERSION_MAP: Record<string, string> = {
  ORIGINAL: 'VO',
  LOCAL: 'VF',
  DUBBED: 'VF',
};

function extractMovieId(movie: AllocineMovie): number | null {
  if (typeof movie.internalId === 'number' && movie.internalId > 0) return movie.internalId;

  if (movie.id) {
    const match = movie.id.match(/:(\d+)$/);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

function uniqueNonEmptyStrings(values: string[]): string[] {
  return Array.from(new Set(values.map(v => v.trim()).filter(Boolean)));
}

/**
 * Convert runtime from seconds to minutes, filtering out invalid values.
 * Returns undefined for NaN, Infinity, zero, negative, or missing values.
 */
function runtimeToMinutes(seconds: number | undefined): number | undefined {
  if (seconds === undefined || seconds === null) return undefined;
  if (!Number.isFinite(seconds) || seconds <= 0) {
    if (Number.isNaN(seconds) || !Number.isFinite(seconds)) {
      logger.warn('Invalid runtime value detected', { runtime: seconds });
    }
    return undefined;
  }
  return Math.round(seconds / 60);
}

/**
 * Validate and sanitize a rating value (press or audience).
 * Returns undefined for NaN, Infinity, or values outside 0-5 range.
 */
function sanitizeRating(rating: number | undefined): number | undefined {
  if (rating === undefined || rating === null) return undefined;
  if (!Number.isFinite(rating)) {
    logger.warn('Invalid rating value detected', { rating });
    return undefined;
  }
  // Ratings should be between 0 and 5
  if (rating < 0 || rating > 5) {
    logger.warn('Rating out of range (0-5)', { rating });
    return undefined;
  }
  return rating;
}

function parseReleaseDate(releases: AllocineRelease[] | undefined): {
  release_date?: string;
  rerelease_date?: string;
} {
  if (!releases) return {};
  let release_date: string | undefined;
  let rerelease_date: string | undefined;

  for (const rel of releases) {
    const date = rel.releaseDate?.date?.split('T')[0];
    if (!date) continue;
    const name = (rel.name ?? '').toLowerCase();
    if (name.includes('reprise') || name.includes('rerelease')) {
      rerelease_date = date;
    } else {
      release_date = date;
    }
  }
  return { release_date, rerelease_date };
}

function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = date.getDay();
  let offset = dayOfWeek - 3;
  if (offset < 0) offset += 7;
  const wed = new Date(date);
  wed.setDate(date.getDate() - offset);
  const y = wed.getFullYear();
  const m = String(wed.getMonth() + 1).padStart(2, '0');
  const d = String(wed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

type AllocineVersionKey = keyof AllocineShowtimesGroup;

const VERSION_GROUPS: ReadonlyArray<[AllocineVersionKey, string]> = [
  ['original', 'VO'],
  ['original_st', 'VOST'],
  ['original_st_sme', 'VOST'],
  ['multiple', 'VF'],
  ['multiple_st', 'VOST'],
  ['multiple_st_sme', 'VOST'],
];

function flattenShowtimes(group: AllocineShowtimesGroup): Array<{ showtime: AllocineShowtime; version: string }> {
  const result: Array<{ showtime: AllocineShowtime; version: string }> = [];
  for (const [key, ver] of VERSION_GROUPS) {
    for (const st of group[key] ?? []) {
      result.push({ showtime: st, version: ver });
    }
  }
  return result;
}

function resolveVersion(showtime: AllocineShowtime, fallback: string): string {
  return showtime.diffusionVersion ? (VERSION_MAP[showtime.diffusionVersion] ?? fallback) : fallback;
}

function buildShowtimeEntry(
  showtime: AllocineShowtime,
  fallbackVersion: string,
  context: { movieId: number; theaterId: string; date: string }
): Showtime | null {
  if (!showtime.startsAt) return null;
  const [actualDate, timePart] = showtime.startsAt.split('T');
  const time = timePart?.substring(0, 5) ?? '';
  const version = resolveVersion(showtime, fallbackVersion);
  const format = showtime.projection?.[0];
  const experiences = showtime.tags ?? [];

  return {
    id: `${context.theaterId}_${context.movieId}_${actualDate ?? context.date}_${time}_${version}_${format ?? ''}`,
    movie_id: context.movieId,
    theater_id: context.theaterId,
    date: actualDate || context.date,
    time,
    datetime_iso: showtime.startsAt,
    version,
    format,
    experiences,
    week_start: getWeekStart(actualDate || context.date),
  };
}

function mapShowtimes(
  group: AllocineShowtimesGroup,
  movieId: number,
  theaterId: string,
  date: string
): Showtime[] {
  const context = { movieId, theaterId, date };
  const showtimes: Showtime[] = [];
  for (const { showtime, version } of flattenShowtimes(group)) {
    const entry = buildShowtimeEntry(showtime, version, context);
    if (entry) showtimes.push(entry);
  }
  return showtimes;
}

// ── Main parser ───────────────────────────────────────────────────────────────

// ── parseShowtimesJson helpers ────────────────────────────────────────────────

interface ParsedMovieCredits {
  director?: string;
  screenwriters: string[];
  actors: string[];
}

type CreditBucket = 'director' | 'screenwriter' | 'actor' | null;

const CREDIT_ROLES: Record<string, CreditBucket> = {
  director: 'director',
  réalisateur: 'director',
  writer: 'screenwriter',
  screenwriter: 'screenwriter',
  screenplay: 'screenwriter',
  scénariste: 'screenwriter',
  scenariste: 'screenwriter',
  actor: 'actor',
  acteur: 'actor',
};

function bucketFor(positionName: string | undefined): CreditBucket {
  if (!positionName) return null;
  return CREDIT_ROLES[positionName.toLowerCase()] ?? null;
}

function parseMovieCredits(credits: AllocineCredit[] | undefined): ParsedMovieCredits {
  const result: ParsedMovieCredits = { director: undefined, screenwriters: [], actors: [] };

  for (const credit of credits ?? []) {
    const name = credit.person?.fullName;
    if (!name) continue;
    const decodedName = decodeHtmlEntities(name) ?? name;
    const bucket = bucketFor(credit.position?.name);
    if (bucket === 'director') {
      result.director = decodedName;
    } else if (bucket === 'screenwriter') {
      result.screenwriters.push(decodedName);
    } else if (bucket === 'actor') {
      result.actors.push(decodedName);
    }
  }

  return result;
}

function buildMovie(rawMovie: AllocineMovie, credits: ParsedMovieCredits, movieId: number): Movie {
  const genres = decodeHtmlEntitiesArray(
    (rawMovie.genres ?? []).map(g => g.translate ?? '').filter(Boolean),
  );
  const nationalityRaw = (rawMovie.countries ?? [])
    .map(c => c.localizedName ?? '')
    .filter(Boolean)
    .join(', ') || undefined;
  const nationality = decodeHtmlEntities(nationalityRaw);

  const press_rating = sanitizeRating(rawMovie.stats?.pressReview?.score);
  const audience_rating = sanitizeRating(rawMovie.stats?.userRating?.score);
  const { release_date, rerelease_date } = parseReleaseDate(rawMovie.releases);

  return {
    id: movieId,
    title: decodeHtmlEntities(rawMovie.title) ?? '',
    original_title: decodeHtmlEntities(rawMovie.originalTitle),
    poster_url: rawMovie.poster?.url,
    duration_minutes: runtimeToMinutes(rawMovie.runtime),
    genres,
    nationality,
    director: credits.director,
    screenwriters: uniqueNonEmptyStrings(credits.screenwriters),
    actors: credits.actors,
    synopsis: decodeHtmlEntities(rawMovie.synopsis),
    press_rating,
    audience_rating,
    release_date,
    rerelease_date,
    source_url: `https://www.allocine.fr/film/fichefilm_gen_cfilm=${movieId}.html`,
  };
}

function parseShowtimeEntry(
  result: AllocineResult,
  theaterId: string,
  date: string,
): MovieShowtimeData | null {
  const rawMovie = result.movie;
  if (!rawMovie) return null;

  const movieId = extractMovieId(rawMovie);
  if (!movieId) {
    logger.warn('Could not extract movie ID', {
      preview: JSON.stringify(rawMovie).substring(0, 100),
    });
    return null;
  }

  const credits = parseMovieCredits(rawMovie.credits);
  const movie = buildMovie(rawMovie, credits, movieId);
  const showtimes = mapShowtimes(result.showtimes ?? {}, movieId, theaterId, date);
  const isNewThisWeek = rawMovie.flags?.isNewRelease ?? false;

  if (showtimes.length === 0) return null;
  return { movie, showtimes, is_new_this_week: isNewThisWeek };
}

/**
 * Parse the Allociné internal showtimes API JSON response into MovieShowtimeData[].
 */
export function parseShowtimesJson(
  json: unknown,
  theaterId: string,
  date: string
): MovieShowtimeData[] {
  const response = json as AllocineApiResponse;

  if (response.error) {
    logger.warn('Showtimes API returned error', { theaterId, date });
    return [];
  }

  const results = response.results ?? [];
  const movieShowtimes: MovieShowtimeData[] = [];

  for (const result of results) {
    const entry = parseShowtimeEntry(result, theaterId, date);
    if (entry) movieShowtimes.push(entry);
  }

  return movieShowtimes;
}
