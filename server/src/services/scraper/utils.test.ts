import { describe, it, expect } from 'vitest';
import { isStaleResponse, extractCinemaIdFromUrl, isValidAllocineUrl } from './utils.js';
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
    week_start: date,
  };
}

describe('isStaleResponse', () => {
  describe('Basic functionality (Showtime-based detection)', () => {
    it('returns true when all showtimes have a different date than requested', () => {
      const showtimes = [makeShowtime('2026-02-18'), makeShowtime('2026-02-18')];
      expect(isStaleResponse('2026-02-20', '2026-02-18', showtimes)).toBe(true);
    });

    it('returns false when all showtimes match the requested date', () => {
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
      expect(isStaleResponse('2026-02-20', '2026-02-20', [])).toBe(false);
    });
  });

  describe('Selected Date detection', () => {
    it('returns true when selected_date differs and there are no showtimes', () => {
      // Improved logic: if the site says it's showing the 18th but we wanted the 20th,
      // it's stale even if there are no showtimes to confirm.
      expect(isStaleResponse('2026-02-20', '2026-02-18', [])).toBe(true);
    });

    it('returns true when selected_date differs and all showtime dates also differ', () => {
      const showtimes = [makeShowtime('2026-02-18')];
      expect(isStaleResponse('2026-02-20', '2026-02-18', showtimes)).toBe(true);
    });

    it('returns false when selected_date matches requested date even if showtimes are empty', () => {
      expect(isStaleResponse('2026-02-20', '2026-02-20', [])).toBe(false);
    });

    it('returns false when selected_date differs but at least one showtime matches (trust showtimes)', () => {
      // Edge case: if the attribute is wrong but showtimes are right, trust showtimes
      const showtimes = [makeShowtime('2026-02-20')];
      expect(isStaleResponse('2026-02-20', '2026-02-18', showtimes)).toBe(false);
    });
  });

  describe('Edge cases and robustness', () => {
    it('handles empty requestedDate gracefully (defaults to not stale unless showtimes exist)', () => {
      expect(isStaleResponse('', '2026-02-18', [])).toBe(false);
      expect(isStaleResponse('', '', [makeShowtime('2026-02-18')])).toBe(true);
    });

    it('handles empty selectedDate gracefully (falls back to showtime detection)', () => {
      const showtimes = [makeShowtime('2026-02-18')];
      expect(isStaleResponse('2026-02-20', '', showtimes)).toBe(true);
      expect(isStaleResponse('2026-02-18', '', showtimes)).toBe(false);
    });

    it('returns false for empty inputs', () => {
      expect(isStaleResponse('', '', [])).toBe(false);
    });
  });
});

describe('extractCinemaIdFromUrl', () => {
  it('extracts ID from standard Allociné URL', () => {
    expect(extractCinemaIdFromUrl('https://www.allocine.fr/seance/salle_affich-salle=C0013.html')).toBe('C0013');
  });

  it('extracts ID from URL with csalle parameter', () => {
    expect(extractCinemaIdFromUrl('https://www.allocine.fr/seance/salle_gen_csalle=C0013.html')).toBe('C0013');
  });

  it('returns null for invalid URLs', () => {
    expect(extractCinemaIdFromUrl('https://www.google.com')).toBeNull();
    expect(extractCinemaIdFromUrl('https://www.allocine.fr/film/fichefilm_gen_cfilm=12345.html')).toBeNull();
  });
});

describe('isValidAllocineUrl', () => {
  it('returns true for valid Allociné URLs', () => {
    expect(isValidAllocineUrl('https://www.allocine.fr/seance/salle_affich-salle=C0013.html')).toBe(true);
    expect(isValidAllocineUrl('https://www.allocine.fr/seance/salle_gen_csalle=C0013.html')).toBe(true);
    expect(isValidAllocineUrl('https://www.allocine.fr/some/other/page.html')).toBe(true);
  });

  it('returns false for non-https URLs', () => {
    expect(isValidAllocineUrl('http://www.allocine.fr/seance/salle_affich-salle=C0013.html')).toBe(false);
  });

  it('returns false for different domains', () => {
    expect(isValidAllocineUrl('https://www.google.com')).toBe(false);
    expect(isValidAllocineUrl('https://evil.allocine.fr.com')).toBe(false);
    expect(isValidAllocineUrl('https://allocine.fr')).toBe(false); // subdomain mismatch
  });

  it('returns false for malformed URLs', () => {
    expect(isValidAllocineUrl('not a url')).toBe(false);
    expect(isValidAllocineUrl('')).toBe(false);
  });
});
