import { describe, it, expect } from 'vitest';
import { getAllocineCinemaUrl } from './allocine';

describe('Allocine Utils', () => {
  describe('getAllocineCinemaUrl', () => {
    it('should return correct URL for a cinema ID', () => {
      const cinemaId = 'W7504';
      const expected = 'https://www.allocine.fr/seance/salle_gen_csalle=W7504.html';
      expect(getAllocineCinemaUrl(cinemaId)).toBe(expected);
    });

    it('should return empty string if cinema ID is empty', () => {
      expect(getAllocineCinemaUrl('')).toBe('');
    });

    it('should handle different cinema ID formats', () => {
      const cinemaId = 'C0072';
      const expected = 'https://www.allocine.fr/seance/salle_gen_csalle=C0072.html';
      expect(getAllocineCinemaUrl(cinemaId)).toBe(expected);
    });
  });
});
