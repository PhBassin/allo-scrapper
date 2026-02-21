import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractCinemaIdFromUrl, isStaleResponse } from '../../../src/scraper/utils.js';

describe('extractCinemaIdFromUrl', () => {
  it('extracts ID from salle_gen_csalle= format', () => {
    expect(extractCinemaIdFromUrl('https://www.allocine.fr/seance/salle_gen_csalle=C0072.html')).toBe('C0072');
  });

  it('extracts ID from salle-salle= format', () => {
    expect(extractCinemaIdFromUrl('https://www.allocine.fr/seance/salle-salle=W7504.html')).toBe('W7504');
  });

  it('returns null for unknown URL format', () => {
    expect(extractCinemaIdFromUrl('https://www.allocine.fr/unknown')).toBeNull();
  });

  it('handles alphanumeric IDs', () => {
    expect(extractCinemaIdFromUrl('https://www.allocine.fr/seance/salle_gen_csalle=C0089.html')).toBe('C0089');
  });
});

describe('isStaleResponse', () => {
  it('returns false when no showtimes and dates match', () => {
    expect(isStaleResponse('2026-02-22', '2026-02-22', [])).toBe(false);
  });

  it('returns true when selectedDate differs and no showtimes for requested date', () => {
    const showtimes = [{ date: '2026-02-21' } as any];
    expect(isStaleResponse('2026-02-22', '2026-02-21', showtimes)).toBe(true);
  });

  it('returns false when selectedDate differs but some showtimes are for requested date', () => {
    const showtimes = [{ date: '2026-02-22' } as any, { date: '2026-02-21' } as any];
    expect(isStaleResponse('2026-02-22', '2026-02-21', showtimes)).toBe(false);
  });

  it('returns false when no showtimes (empty is legitimate)', () => {
    expect(isStaleResponse('2026-02-22', '2026-02-22', [])).toBe(false);
  });

  it('returns true when all showtimes are for different date', () => {
    const showtimes = [
      { date: '2026-02-21' } as any,
      { date: '2026-02-21' } as any,
    ];
    expect(isStaleResponse('2026-02-22', '2026-02-22', showtimes)).toBe(true);
  });
});
