import type { FilmShowtimeData, Film, Showtime } from '../../types/scraper.js';
import { logger } from '../../utils/logger.js';

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
  // internalId is sometimes numeric
  if (typeof movie.internalId === 'number' && movie.internalId > 0) return movie.internalId;

  // id is like "movie:movie:_:12345" or "entity:movie:1000007317"
  if (movie.id) {
    const match = movie.id.match(/:(\d+)$/);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

function runtimeToMinutes(seconds: number | undefined): number | undefined {
  if (!seconds || seconds <= 0) return undefined;
  return Math.round(seconds / 60);
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

function mapShowtimes(
  group: AllocineShowtimesGroup,
  filmId: number,
  cinemaId: string,
  date: string
): Showtime[] {
  const allEntries: { showtime: AllocineShowtime; version: string }[] = [];

  const versionGroups: Array<[keyof AllocineShowtimesGroup, string]> = [
    ['original', 'VO'],
    ['original_st', 'VOST'],
    ['original_st_sme', 'VOST'],
    ['multiple', 'VF'],
    ['multiple_st', 'VOST'],
    ['multiple_st_sme', 'VOST'],
  ];

  for (const [key, ver] of versionGroups) {
    for (const st of group[key] ?? []) {
      allEntries.push({ showtime: st, version: ver });
    }
  }

  const showtimes: Showtime[] = [];
  for (const { showtime, version } of allEntries) {
    if (!showtime.startsAt || !showtime.internalId) continue;

    // Derive actual date from the ISO timestamp (more reliable than the requested date)
    const actualDate = showtime.startsAt.split('T')[0] || date;
    const time = showtime.startsAt.split('T')[1]?.substring(0, 5) ?? '';

    // Derive version from diffusionVersion if available
    const ver2 = showtime.diffusionVersion
      ? (VERSION_MAP[showtime.diffusionVersion] ?? version)
      : version;

    // Format from projection
    const format = showtime.projection?.[0];

    const experiences: string[] = showtime.tags ?? [];

    showtimes.push({
      id: `${showtime.internalId}-${actualDate}`,
      film_id: filmId,
      cinema_id: cinemaId,
      date: actualDate,
      time,
      datetime_iso: showtime.startsAt,
      version: ver2,
      format,
      experiences,
      week_start: getWeekStart(actualDate),
    });
  }

  return showtimes;
}

// ── Main parser ───────────────────────────────────────────────────────────────

/**
 * Parse the Allociné internal showtimes API JSON response into FilmShowtimeData[].
 *
 * @param json     - Raw parsed JSON from /_/showtimes/theater-{id}/d-{date}/
 * @param cinemaId - Cinema ID (e.g. "C0072")
 * @param date     - Requested date (YYYY-MM-DD)
 */
export function parseShowtimesJson(
  json: unknown,
  cinemaId: string,
  date: string
): FilmShowtimeData[] {
  const response = json as AllocineApiResponse;

  if (response.error) {
    logger.warn(`⚠️  Showtimes API returned error for ${cinemaId} on ${date}`);
    return [];
  }

  const results = response.results ?? [];
  const filmShowtimes: FilmShowtimeData[] = [];

  for (const result of results) {
    const movie = result.movie;
    if (!movie) continue;

    const filmId = extractMovieId(movie);
    if (!filmId) {
      logger.warn(`⚠️  Could not extract film ID from movie:`, JSON.stringify(movie).substring(0, 100));
      continue;
    }

    // Extract director and actors from credits
    let director: string | undefined;
    const actors: string[] = [];
    for (const credit of movie.credits ?? []) {
      const name = credit.person?.fullName;
      if (!name) continue;
      const pos = credit.position?.name?.toLowerCase() ?? '';
      if (pos === 'director' || pos === 'réalisateur') {
        director = name;
      } else if (pos === 'actor' || pos === 'acteur') {
        actors.push(name);
      }
    }

    // Genres
    const genres = (movie.genres ?? []).map(g => g.translate ?? '').filter(Boolean);

    // Nationality / countries
    const nationality = (movie.countries ?? []).map(c => c.localizedName ?? '').filter(Boolean).join(', ') || undefined;

    // Ratings (out of 5)
    const press_rating = movie.stats?.pressReview?.score ?? undefined;
    const audience_rating = movie.stats?.userRating?.score ?? undefined;

    // Release dates
    const { release_date, rerelease_date } = parseReleaseDate(movie.releases);

    const film: Film = {
      id: filmId,
      title: movie.title ?? '',
      original_title: movie.originalTitle,
      poster_url: movie.poster?.url,
      duration_minutes: runtimeToMinutes(movie.runtime),
      genres,
      nationality,
      director,
      actors,
      synopsis: movie.synopsis,
      press_rating,
      audience_rating,
      release_date,
      rerelease_date,
      source_url: `https://www.allocine.fr/film/fichefilm_gen_cfilm=${filmId}.html`,
    };

    const showtimes = mapShowtimes(result.showtimes ?? {}, filmId, cinemaId, date);

    const isNewThisWeek = movie.flags?.isNewRelease ?? false;

    if (showtimes.length > 0) {
      filmShowtimes.push({ film, showtimes, is_new_this_week: isNewThisWeek });
    }
  }

  return filmShowtimes;
}
