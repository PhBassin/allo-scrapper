import type { Showtime } from '../types/scraper.js';

/**
 * Determines whether a scraped page is a stale/fallback response.
 */
export function isStaleResponse(
  requestedDate: string,
  selectedDate: string,
  showtimes: Showtime[]
): boolean {
  if (selectedDate && requestedDate && selectedDate !== requestedDate) {
    const hasRequestedDate = showtimes.some((s) => s.date === requestedDate);
    if (!hasRequestedDate) {
      return true;
    }
  }

  if (showtimes.length === 0) return false;

  return showtimes.every((s) => s.date !== requestedDate);
}

/**
 * Extracts the Allocine cinema ID (e.g., C0013) from a URL.
 */
export function extractCinemaIdFromUrl(url: string): string | null {
  const match = url.match(/(?:-salle=|_csalle=)([A-Z0-9]+)/);
  return match ? match[1] : null;
}
