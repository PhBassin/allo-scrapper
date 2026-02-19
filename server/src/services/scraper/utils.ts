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
