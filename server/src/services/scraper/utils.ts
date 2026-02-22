import type { Showtime } from '../../types/scraper.js';

/**
 * Determines whether a scraped page is a stale/fallback response.
 *
 * The source cinema site returns the closest published date's data when
 * the requested date has no showtimes yet (e.g. future dates not yet
 * published). We detect this by checking whether *all* showtimes on the
 * page have a date that differs from the requested date.
 *
 * Returns false when there are no showtimes — an empty schedule is a
 * legitimate result, not a fallback.
 */
export function isStaleResponse(
  requestedDate: string,
  selectedDate: string,
  showtimes: Showtime[]
): boolean {
  // If the site explicitly says it's showing a different date, it's stale
  // This is a more reliable signal than showtime dates alone, especially when
  // there are no showtimes.
  if (selectedDate && requestedDate && selectedDate !== requestedDate) {
    // Exception: if the page has showtimes for the requested date anyway,
    // trust the showtimes over the selectedDate attribute.
    const hasRequestedDate = showtimes.some((s) => s.date === requestedDate);
    if (!hasRequestedDate) {
      return true;
    }
  }

  if (showtimes.length === 0) return false;

  // If all showtimes are for a different date than requested, it's stale
  return showtimes.every((s) => s.date !== requestedDate);
}

/**
 * Extracts the Allocine cinema ID (e.g., C0013) from a URL.
 * Strictly validates that the URL originates from www.allocine.fr to prevent SSRF.
 */
export function extractCinemaIdFromUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    // Strict domain validation
    if (parsedUrl.hostname !== 'www.allocine.fr') {
      return null;
    }
  } catch {
    // Invalid URL format
    return null;
  }

  const match = url.match(/(?:-salle=|_csalle=)([A-Z0-9]+)/);
  return match ? match[1] : null;
}

/**
 * Cleans an Allocine cinema URL by stripping fragments (#) and query parameters (?).
 * Returns a clean URL like https://www.allocine.fr/seance/salle_gen_csalle=W7517.html
 */
export function cleanCinemaUrl(url: string): string {
  // Remove everything from the first ? or # onwards
  return url.split(/[?#]/)[0];
}

/**
 * Validates that the URL is a valid Allociné URL (https://www.allocine.fr/...)
 */
export function isValidAllocineUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'www.allocine.fr';
  } catch {
    return false;
  }
}
