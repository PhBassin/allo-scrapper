import { describe, it, expect } from 'vitest';
import { getCinemaUrl } from './cinema-url';

describe('Cinema URL Utils', () => {
  describe('getCinemaUrl', () => {
    it('should return correct URL for a cinema ID', () => {
      const cinemaId = 'W7504';
      const expected = 'https://www.example-cinema-site.com/seance/salle_gen_csalle=W7504.html';
      expect(getCinemaUrl(cinemaId)).toBe(expected);
    });

    it('should return empty string if cinema ID is empty', () => {
      expect(getCinemaUrl('')).toBe('');
    });

    it('should handle different cinema ID formats', () => {
      const cinemaId = 'C0072';
      const expected = 'https://www.example-cinema-site.com/seance/salle_gen_csalle=C0072.html';
      expect(getCinemaUrl(cinemaId)).toBe(expected);
    });
  });
});
