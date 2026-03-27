import { describe, expect, it } from 'vitest';
import { shouldRefreshFilmDetails } from './AllocineScraperStrategy.js';

describe('shouldRefreshFilmDetails', () => {
  it('returns true when existing film is missing', () => {
    expect(shouldRefreshFilmDetails(null)).toBe(true);
  });

  it('returns true when trailer_url is missing', () => {
    expect(
      shouldRefreshFilmDetails({
        duration_minutes: 120,
        director: 'Director',
        screenwriters: ['Writer'],
      })
    ).toBe(true);
  });

  it('returns false when all required details exist', () => {
    expect(
      shouldRefreshFilmDetails({
        duration_minutes: 120,
        director: 'Director',
        screenwriters: ['Writer'],
        trailer_url: 'https://www.allocine.fr/video/player_gen_cmedia=99&cfilm=123.html',
      })
    ).toBe(false);
  });
});
