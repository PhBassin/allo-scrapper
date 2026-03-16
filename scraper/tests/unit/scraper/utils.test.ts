import { describe, it, expect } from 'vitest';
import {
  extractCinemaIdFromUrl,
  isStaleResponse,
  isValidAllocineUrl,
  cleanCinemaUrl,
  ALLOCINE_BASE_URL,
} from '../../../src/scraper/utils.js';

describe('ALLOCINE_BASE_URL', () => {
  it('should be https://www.allocine.fr', () => {
    expect(ALLOCINE_BASE_URL).toBe('https://www.allocine.fr');
  });
});

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

  it('should reject URLs from non-allocine domains', () => {
    expect(extractCinemaIdFromUrl('https://evil.com/seance/salle_gen_csalle=C0072.html')).toBeNull();
  });

  it('should reject URLs from allocine subdomains', () => {
    expect(extractCinemaIdFromUrl('https://evil.allocine.fr/seance/salle_gen_csalle=C0072.html')).toBeNull();
  });

  it('should reject invalid URLs', () => {
    expect(extractCinemaIdFromUrl('not-a-url')).toBeNull();
  });

  it('should reject plain strings with cinema ID pattern but no valid domain', () => {
    expect(extractCinemaIdFromUrl('salle_gen_csalle=C0072')).toBeNull();
  });
});

describe('isValidAllocineUrl', () => {
  it('should accept valid allocine cinema URLs', () => {
    expect(isValidAllocineUrl('https://www.allocine.fr/seance/salle_gen_csalle=C0072.html')).toBe(true);
  });

  it('should accept any https allocine.fr URL', () => {
    expect(isValidAllocineUrl('https://www.allocine.fr/film/fichefilm_gen_cfilm=123.html')).toBe(true);
  });

  it('should reject non-allocine URLs', () => {
    expect(isValidAllocineUrl('https://www.evil.com/seance/salle_gen_csalle=C0072.html')).toBe(false);
  });

  it('should reject http (non-https) allocine URLs', () => {
    expect(isValidAllocineUrl('http://www.allocine.fr/seance/salle_gen_csalle=C0072.html')).toBe(false);
  });

  it('should reject allocine subdomains', () => {
    expect(isValidAllocineUrl('https://evil.allocine.fr/seance/salle_gen_csalle=C0072.html')).toBe(false);
  });

  it('should reject invalid URL strings', () => {
    expect(isValidAllocineUrl('not-a-url')).toBe(false);
  });

  it('should reject empty string', () => {
    expect(isValidAllocineUrl('')).toBe(false);
  });
});

describe('cleanCinemaUrl', () => {
  it('should strip query parameters', () => {
    expect(cleanCinemaUrl('https://www.allocine.fr/seance/salle_gen_csalle=C0072.html?ref=foo')).toBe(
      'https://www.allocine.fr/seance/salle_gen_csalle=C0072.html'
    );
  });

  it('should strip fragments', () => {
    expect(cleanCinemaUrl('https://www.allocine.fr/seance/salle_gen_csalle=C0072.html#section')).toBe(
      'https://www.allocine.fr/seance/salle_gen_csalle=C0072.html'
    );
  });

  it('should strip both query parameters and fragments', () => {
    expect(cleanCinemaUrl('https://www.allocine.fr/seance/salle_gen_csalle=C0072.html?ref=foo#section')).toBe(
      'https://www.allocine.fr/seance/salle_gen_csalle=C0072.html'
    );
  });

  it('should return clean URLs unchanged', () => {
    const clean = 'https://www.allocine.fr/seance/salle_gen_csalle=C0072.html';
    expect(cleanCinemaUrl(clean)).toBe(clean);
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
