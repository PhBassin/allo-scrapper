import { describe, it, expect } from 'vitest';
import { isValidAllocineUrl, extractCinemaIdFromUrl, cleanCinemaUrl } from './url.js';

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
    expect(isValidAllocineUrl('https://allocine.fr')).toBe(false);
  });

  it('returns false for malformed URLs', () => {
    expect(isValidAllocineUrl('not a url')).toBe(false);
    expect(isValidAllocineUrl('')).toBe(false);
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
    expect(extractCinemaIdFromUrl('https://malicious.com/attack?param-salle=C1234')).toBeNull();
    expect(extractCinemaIdFromUrl('http://localhost:8080/my-exploit?_csalle=C9999')).toBeNull();
    expect(extractCinemaIdFromUrl('https://www.allocine.fr.evil.com/seance/salle_gen_csalle=C0013.html')).toBeNull();
    expect(extractCinemaIdFromUrl('/seance/salle_gen_csalle=C0013.html')).toBeNull();
    expect(extractCinemaIdFromUrl('https://www.allocine.fr/film/fichefilm_gen_cfilm=12345.html')).toBeNull();
    expect(extractCinemaIdFromUrl('https://www.google.com')).toBeNull();
  });
});

describe('cleanCinemaUrl', () => {
  it('strips query string from URL', () => {
    expect(cleanCinemaUrl('https://www.allocine.fr/seance/salle_gen_csalle=C0013.html?date=2026-01-01')).toBe(
      'https://www.allocine.fr/seance/salle_gen_csalle=C0013.html'
    );
  });

  it('strips fragment from URL', () => {
    expect(cleanCinemaUrl('https://www.allocine.fr/seance/salle_gen_csalle=C0013.html#showtimes')).toBe(
      'https://www.allocine.fr/seance/salle_gen_csalle=C0013.html'
    );
  });

  it('leaves clean URLs unchanged', () => {
    expect(cleanCinemaUrl('https://www.allocine.fr/seance/salle_gen_csalle=C0013.html')).toBe(
      'https://www.allocine.fr/seance/salle_gen_csalle=C0013.html'
    );
  });
});
