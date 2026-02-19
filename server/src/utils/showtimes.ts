import type { CinemaWithShowtimes, Showtime, Cinema } from '../types/scraper.js';

/**
 * Helper to group showtimes by cinema
 */
export function groupShowtimesByCinema(showtimes: Array<Showtime & { cinema: Cinema }>): CinemaWithShowtimes[] {
  const cinemaMap = new Map<string, CinemaWithShowtimes>();

  for (const s of showtimes) {
    if (!cinemaMap.has(s.cinema_id)) {
      cinemaMap.set(s.cinema_id, {
        ...s.cinema,
        showtimes: []
      });
    }
    const { cinema: _cinema, ...showtimeOnly } = s;
    cinemaMap.get(s.cinema_id)!.showtimes.push(showtimeOnly as Showtime);
  }

  return Array.from(cinemaMap.values());
}
