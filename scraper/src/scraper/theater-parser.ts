import * as cheerio from 'cheerio';
import type { TheaterPageData, Theater, MovieShowtimeData, Movie, Showtime } from '../types/scraper.js';
import { logger } from '../utils/logger.js';

// Parse the theater page from the source website
export function parseTheaterPage(html: string, theaterId: string): TheaterPageData {
  const $ = cheerio.load(html);
  const theaterSection = $('#theaterpage-showtimes-index-ui');
  const theaterDataStr = theaterSection.attr('data-theater');
  const datesDataStr = theaterSection.attr('data-showtimes-dates');
  const selectedDate = theaterSection.attr('data-selected-date') || '';

  return {
    theater: parseTheaterSection(theaterDataStr, theaterId),
    movies: parseMoviesFromSection($, theaterSection, theaterId, selectedDate),
    dates: parseDatesAttribute(datesDataStr),
    selected_date: selectedDate,
  };
}

function parseTheaterSection(theaterDataStr: string | undefined, theaterId: string): Theater {
  const fallback: Theater = {
    id: theaterId,
    name: '',
    address: '',
    postal_code: '',
    city: '',
    screen_count: 0,
  };

  if (!theaterDataStr) return fallback;

  try {
    const data = JSON.parse(theaterDataStr);
    return {
      id: theaterId,
      name: data.name || '',
      address: data.location?.address || '',
      postal_code: data.location?.postalCode || '',
      city: data.location?.city || '',
      screen_count: data.screenCount || 0,
      image_url: data.image,
    };
  } catch (e) {
    logger.warn('Could not parse theater data JSON');
    return fallback;
  }
}

function parseDatesAttribute(datesDataStr: string | undefined): string[] {
  if (!datesDataStr) return [];
  try {
    return JSON.parse(datesDataStr);
  } catch (e) {
    logger.warn('Could not parse showtimes dates');
    return [];
  }
}

function parseMoviesFromSection(
  $: cheerio.CheerioAPI,
  theaterSection: cheerio.Cheerio<any>,
  theaterId: string,
  selectedDate: string
): MovieShowtimeData[] {
  const movies: MovieShowtimeData[] = [];
  theaterSection.find('.movie-card-theater').each((_, element) => {
    try {
      const movieData = parseMovieCard($, element, theaterId, selectedDate);
      if (movieData) movies.push(movieData);
    } catch (error) {
      logger.error('Error parsing movie card', { error });
    }
  });
  return movies;
}

interface MovieMetadata {
  href: string;
  movieId: number | null;
  title: string;
  posterUrl: string;
  genres: string[];
  nationality: string;
  director: string;
  actors: string[];
  synopsis: string;
  certificate: string;
}

function parseMovieMetadata($: cheerio.CheerioAPI, $card: cheerio.Cheerio<any>): MovieMetadata {
  const titleLink = $card.find('.meta-title-link');
  const href = titleLink.attr('href') || '';
  const movieIdMatch = href.match(/cfilm=(\d+)/);
  if (!movieIdMatch) {
    return {
      href,
      movieId: null,
      title: '',
      posterUrl: '',
      genres: [],
      nationality: '',
      director: '',
      actors: [],
      synopsis: '',
      certificate: '',
    };
  }
  const movieId = parseInt(movieIdMatch[1], 10);

  const title = titleLink.text().trim();

  const posterImg = $card.find('.thumbnail-img');
  const posterUrl = posterImg.attr('data-src') || posterImg.attr('src') || '';

  const genres: string[] = [];
  $card.find('.meta-body-info .dark-grey-link').each((_, el) => {
    const genre = $(el).text().trim();
    if (genre) genres.push(genre);
  });

  const nationality = $card.find('.meta-body-info .nationality').text().trim();

  let director = '';
  const directionDiv = $card.find('.meta-body-direction');
  if (directionDiv.length) {
    director = directionDiv.text().trim().replace(/^De\s+/, '');
  }

  const actors: string[] = [];
  const actorDiv = $card.find('.meta-body-actor');
  if (actorDiv.length) {
    const actorText = actorDiv.text().trim().replace(/^Avec\s+/, '');
    actorText.split(',').forEach((actor) => {
      const trimmed = actor.trim();
      if (trimmed) actors.push(trimmed);
    });
  }

  const synopsis = $card.find('.synopsis .content-txt').text().trim();
  const certificate = $card.find('.certificate-text').text().trim();

  return { href, movieId, title, posterUrl, genres, nationality, director, actors, synopsis, certificate };
}

function parseMovieRatings($: cheerio.CheerioAPI, $card: cheerio.Cheerio<any>): {
  pressRating: number | undefined;
  audienceRating: number | undefined;
} {
  const ratingItems = $card.find('.rating-item');
  let pressRating: number | undefined;
  let audienceRating: number | undefined;

  if (ratingItems.length >= 1) {
    const pressNote = $(ratingItems[0]).find('.stareval-note').text().trim();
    if (pressNote) pressRating = parseFloat(pressNote.replace(',', '.'));
  }
  if (ratingItems.length >= 2) {
    const audienceNote = $(ratingItems[1]).find('.stareval-note').text().trim();
    if (audienceNote) audienceRating = parseFloat(audienceNote.replace(',', '.'));
  }

  return { pressRating, audienceRating };
}

function parseMovieDates($: cheerio.CheerioAPI, $card: cheerio.Cheerio<any>): {
  releaseDate: string | undefined;
  rereleaseDate: string | undefined;
} {
  let releaseDate: string | undefined;
  let rereleaseDate: string | undefined;

  $card.find('.meta-body-item').each((_, item) => {
    const $item = $(item);
    const label = $item.find('.light').text().trim();

    if (label === 'Date de sortie') {
      const dateText = $item.find('.date').text().trim();
      releaseDate = parseDateText(dateText);
    } else if (label === 'Date de reprise') {
      const dateText = $item.text().replace(label, '').trim();
      rereleaseDate = parseDateText(dateText);
    }
  });

  return { releaseDate, rereleaseDate };
}

// Parser une carte de movie individuelle
function parseMovieCard(
  $: cheerio.CheerioAPI,
  element: any,
  theaterId: string,
  date: string
): MovieShowtimeData | null {
  const $card = $(element);
  const meta = parseMovieMetadata($, $card);
  if (meta.movieId === null) {
    logger.warn('Could not extract movie ID from href', { href: meta.href });
    return null;
  }

  const ratings = parseMovieRatings($, $card);
  const dates = parseMovieDates($, $card);
  const isNewThisWeek = $card
    .find('.label-status')
    .text()
    .toLowerCase()
    .includes('sorti cette semaine');

  const movie: Movie = {
    id: meta.movieId,
    title: meta.title,
    poster_url: meta.posterUrl || undefined,
    genres: meta.genres,
    nationality: meta.nationality || undefined,
    director: meta.director || undefined,
    actors: meta.actors,
    synopsis: meta.synopsis || undefined,
    certificate: meta.certificate || undefined,
    press_rating: ratings.pressRating,
    audience_rating: ratings.audienceRating,
    release_date: dates.releaseDate,
    rerelease_date: dates.rereleaseDate,
    source_url: `https://www.allocine.fr${meta.href}`,
  };

  const showtimes = parseShowtimes($, $card, meta.movieId, theaterId, date);

  return {
    movie,
    showtimes,
    is_new_this_week: isNewThisWeek,
  };
}

// Parser les séances d'un movie
function parseShowtimes(
  $: cheerio.CheerioAPI,
  $card: cheerio.Cheerio<any>,
  movieId: number,
  theaterId: string,
  defaultDate: string
): Showtime[] {
  const showtimes: Showtime[] = [];

  $card.find('.showtimes-version').each((_, versionBlock) => {
    const $version = $(versionBlock);
    const versionText = $version.find('.text').text().trim();
    const version = detectVersion(versionText);
    const showtimeDate = resolveShowtimeDate(versionText, defaultDate);

    $version.find('.showtimes-hour-item').each((_, hourItem) => {
      const showtime = parseShowtimeHour($, $(hourItem), movieId, theaterId, version, showtimeDate);
      if (showtime) showtimes.push(showtime);
    });
  });

  return showtimes;
}

function detectVersion(versionText: string): string {
  const lower = versionText.toLowerCase();
  if (lower.includes('vost')) return 'VOST';
  if (lower.includes('vo')) return 'VO';
  return 'VF';
}

function resolveShowtimeDate(versionText: string, defaultDate: string): string {
  const dateMatch = versionText.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (!dateMatch) return defaultDate;
  return parseDateFromText(dateMatch[1], dateMatch[2], dateMatch[3]);
}

function parseShowtimeHour(
  $: cheerio.CheerioAPI,
  $hour: cheerio.Cheerio<any>,
  movieId: number,
  theaterId: string,
  version: string,
  initialDate: string
): Showtime | null {
  const datetimeIso = $hour.attr('data-showtime-time');
  if (!datetimeIso) return null;

  const time = $hour.find('.showtimes-hour-item-value').text().trim();
  const date = resolveIsoDate(datetimeIso, initialDate);
  const experiences = parseExperiences($hour.attr('data-experiences'));
  const format = extractFormat(experiences);

  return {
    id: `${theaterId}_${movieId}_${date}_${time}_${version}_${format ?? ''}`,
    movie_id: movieId,
    theater_id: theaterId,
    date,
    time,
    datetime_iso: datetimeIso,
    version,
    format,
    experiences,
    week_start: getWeekStart(date),
  };
}

function resolveIsoDate(datetimeIso: string, fallback: string): string {
  const isoDate = datetimeIso.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  return fallback;
}

function parseExperiences(experiencesStr: string | undefined): string[] {
  if (!experiencesStr) return [];
  try {
    return JSON.parse(experiencesStr);
  } catch {
    return [];
  }
}

function extractFormat(experiences: string[]): string | undefined {
  for (const exp of experiences) {
    if (exp.includes('Format.')) {
      return exp.replace('Format.', '').replace('.', ' ');
    }
  }
  return undefined;
}

// Utilitaire: parser une date textuelle ("31 décembre 2025")
function parseDateText(dateText: string): string | undefined {
  const match = dateText.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (!match) return undefined;
  return parseDateFromText(match[1], match[2], match[3]);
}

// Utilitaire: convertir jour/mois/année en YYYY-MM-DD
function parseDateFromText(day: string, monthName: string, year: string): string {
  const months: { [key: string]: string } = {
    janvier: '01',
    février: '02',
    mars: '03',
    avril: '04',
    mai: '05',
    juin: '06',
    juillet: '07',
    août: '08',
    septembre: '09',
    octobre: '10',
    novembre: '11',
    décembre: '12',
  };

  const month = months[monthName.toLowerCase()] || '01';
  const dayPadded = day.padStart(2, '0');

  return `${year}-${month}-${dayPadded}`;
}

// Utilitaire: obtenir le mercredi de la semaine d'une date
function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr);
  const dayOfWeek = date.getDay();

  let offset = dayOfWeek - 3;
  if (offset < 0) {
    offset += 7;
  }

  const wednesday = new Date(date);
  wednesday.setDate(date.getDate() - offset);

  return wednesday.toISOString().split('T')[0];
}
