import { describe, it, expect } from 'vitest';
import { isStaleResponse } from './index.js';
import type { Showtime } from '../../types/scraper.js';

// Helper to build a minimal Showtime object for testing
function makeShowtime(date: string): Showtime {
  return {
    id: `123-${date}`,
    film_id: 1,
    cinema_id: 'W7504',
    date,
    time: '14:00',
    datetime_iso: `${date}T14:00:00+01:00`,
    version: 'VF',
    experiences: [],
    week_start: date, // not relevant for these tests
  };
}

describe('isStaleResponse', () => {
  it('returns true when all showtimes have a different date than requested', () => {
    const showtimes = [makeShowtime('2026-02-18'), makeShowtime('2026-02-18')];
    expect(isStaleResponse('2026-02-20', '2026-02-18', showtimes)).toBe(true);
  });

  it('returns false when showtimes match the requested date', () => {
    const showtimes = [makeShowtime('2026-02-18'), makeShowtime('2026-02-18')];
    expect(isStaleResponse('2026-02-18', '2026-02-18', showtimes)).toBe(false);
  });

  it('returns false when at least one showtime matches the requested date (mixed dates)', () => {
    const showtimes = [
      makeShowtime('2026-02-18'),
      makeShowtime('2026-02-20'), // one matching showtime
    ];
    expect(isStaleResponse('2026-02-20', '2026-02-20', showtimes)).toBe(false);
  });

  it('returns false when there are no showtimes (empty page, not stale)', () => {
    // An empty page is just a cinema with nothing scheduled, not a fallback
    expect(isStaleResponse('2026-02-20', '2026-02-20', [])).toBe(false);
  });

  it('returns false when there are no showtimes even if selected_date differs', () => {
    // Without showtimes we cannot confirm staleness — treat as empty, not stale
    expect(isStaleResponse('2026-02-20', '2026-02-18', [])).toBe(false);
  });

  it('returns true when selected_date differs and all showtime dates differ', () => {
    const showtimes = [
      makeShowtime('2026-02-19'),
      makeShowtime('2026-02-19'),
    ];
    expect(isStaleResponse('2026-02-21', '2026-02-19', showtimes)).toBe(true);
  });

  it('returns false when selected_date is empty but showtimes match requested date', () => {
    const showtimes = [makeShowtime('2026-02-20')];
    expect(isStaleResponse('2026-02-20', '', showtimes)).toBe(false);
  });

  it('returns true when selected_date is empty but all showtimes differ from requested date', () => {
    const showtimes = [makeShowtime('2026-02-18')];
    expect(isStaleResponse('2026-02-20', '', showtimes)).toBe(true);
  });
});
