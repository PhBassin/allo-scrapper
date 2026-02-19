import { describe, it, expect } from 'vitest';
import { parseShowtimesJson } from './theater-json-parser.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeMovie(overrides: Record<string, unknown> = {}) {
  return {
    internalId: 12345,
    title: 'Test Film',
    originalTitle: 'Test Film Original',
    runtime: 5400, // 90 minutes
    poster: { url: 'https://cdn.allocine.fr/poster.jpg' },
    genres: [{ translate: 'Drama' }, { translate: 'Comedy' }],
    countries: [{ localizedName: 'France' }],
    credits: [
      { person: { fullName: 'Jane Director' }, position: { name: 'director' } },
      { person: { fullName: 'John Actor' }, position: { name: 'actor' } },
      { person: { fullName: 'Jane Actress' }, position: { name: 'actor' } },
    ],
    stats: {
      pressReview: { score: 4.0 },
      userRating: { score: 3.5 },
    },
    releases: [
      { releaseDate: { date: '2026-01-15T00:00:00' }, name: 'Sortie' },
    ],
    flags: { isNewRelease: true },
    synopsis: 'A great test film.',
    ...overrides,
  };
}

function makeShowtime(overrides: Record<string, unknown> = {}) {
  return {
    internalId: 999,
    startsAt: '2026-02-22T14:00:00',
    diffusionVersion: 'ORIGINAL',
    projection: ['DIGITAL'],
    tags: ['Format.Projection.Digital'],
    ...overrides,
  };
}

function makeResponse(movie = makeMovie(), showtimesGroup: Record<string, unknown> = {}) {
  return {
    error: false,
    results: [
      {
        movie,
        showtimes: {
          original: [makeShowtime()],
          ...showtimesGroup,
        },
      },
    ],
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('parseShowtimesJson', () => {
  describe('error handling', () => {
    it('should return empty array when response has error flag', () => {
      const result = parseShowtimesJson({ error: true, results: [] }, 'C0072', '2026-02-22');
      expect(result).toEqual([]);
    });

    it('should return empty array when results are missing', () => {
      const result = parseShowtimesJson({}, 'C0072', '2026-02-22');
      expect(result).toEqual([]);
    });

    it('should return empty array when results is an empty array', () => {
      const result = parseShowtimesJson({ error: false, results: [] }, 'C0072', '2026-02-22');
      expect(result).toEqual([]);
    });

    it('should skip results with no movie', () => {
      const result = parseShowtimesJson(
        { error: false, results: [{ movie: null, showtimes: {} }] },
        'C0072',
        '2026-02-22'
      );
      expect(result).toEqual([]);
    });

    it('should skip movies with no extractable film ID', () => {
      const movie = makeMovie({ internalId: undefined, id: undefined });
      const result = parseShowtimesJson(
        { error: false, results: [{ movie, showtimes: { original: [makeShowtime()] } }] },
        'C0072',
        '2026-02-22'
      );
      expect(result).toEqual([]);
    });

    it('should skip films that produce no valid showtimes', () => {
      // Showtime missing startsAt and internalId → no showtimes
      const invalidShowtime = { projection: ['DIGITAL'] };
      const result = parseShowtimesJson(
        { error: false, results: [{ movie: makeMovie(), showtimes: { original: [invalidShowtime] } }] },
        'C0072',
        '2026-02-22'
      );
      expect(result).toEqual([]);
    });
  });

  describe('film ID extraction', () => {
    it('should use internalId when provided as a number', () => {
      const result = parseShowtimesJson(makeResponse(), 'C0072', '2026-02-22');
      expect(result[0].film.id).toBe(12345);
    });

    it('should extract ID from id string like "movie:movie:_:67890"', () => {
      const movie = makeMovie({ internalId: undefined, id: 'movie:movie:_:67890' });
      const result = parseShowtimesJson(
        { error: false, results: [{ movie, showtimes: { original: [makeShowtime()] } }] },
        'C0072',
        '2026-02-22'
      );
      expect(result[0].film.id).toBe(67890);
    });

    it('should extract ID from id string like "entity:movie:1000007317"', () => {
      const movie = makeMovie({ internalId: undefined, id: 'entity:movie:1000007317' });
      const result = parseShowtimesJson(
        { error: false, results: [{ movie, showtimes: { original: [makeShowtime()] } }] },
        'C0072',
        '2026-02-22'
      );
      expect(result[0].film.id).toBe(1000007317);
    });

    it('should return null and skip when id string has no numeric suffix', () => {
      const movie = makeMovie({ internalId: undefined, id: 'no-number-here' });
      const result = parseShowtimesJson(
        { error: false, results: [{ movie, showtimes: { original: [makeShowtime()] } }] },
        'C0072',
        '2026-02-22'
      );
      expect(result).toEqual([]);
    });
  });

  describe('film metadata', () => {
    it('should map film fields correctly', () => {
      const result = parseShowtimesJson(makeResponse(), 'C0072', '2026-02-22');
      const film = result[0].film;
      expect(film.title).toBe('Test Film');
      expect(film.original_title).toBe('Test Film Original');
      expect(film.poster_url).toBe('https://cdn.allocine.fr/poster.jpg');
      expect(film.duration_minutes).toBe(90);
      expect(film.genres).toEqual(['Drama', 'Comedy']);
      expect(film.nationality).toBe('France');
      expect(film.director).toBe('Jane Director');
      expect(film.actors).toEqual(['John Actor', 'Jane Actress']);
      expect(film.synopsis).toBe('A great test film.');
      expect(film.press_rating).toBe(4.0);
      expect(film.audience_rating).toBe(3.5);
      expect(film.release_date).toBe('2026-01-15');
      expect(film.source_url).toBe('https://www.allocine.fr/film/fichefilm_gen_cfilm=12345.html');
    });

    it('should handle missing optional fields gracefully', () => {
      const movie = makeMovie({
        originalTitle: undefined,
        poster: undefined,
        runtime: undefined,
        genres: [],
        countries: [],
        credits: [],
        stats: undefined,
        releases: undefined,
        synopsis: undefined,
        flags: undefined,
      });
      const result = parseShowtimesJson(
        { error: false, results: [{ movie, showtimes: { original: [makeShowtime()] } }] },
        'C0072',
        '2026-02-22'
      );
      const film = result[0].film;
      expect(film.original_title).toBeUndefined();
      expect(film.poster_url).toBeUndefined();
      expect(film.duration_minutes).toBeUndefined();
      expect(film.genres).toEqual([]);
      expect(film.nationality).toBeUndefined();
      expect(film.director).toBeUndefined();
      expect(film.actors).toEqual([]);
      expect(film.press_rating).toBeUndefined();
      expect(film.audience_rating).toBeUndefined();
      expect(film.release_date).toBeUndefined();
    });

    it('should return 0 for runtime 0 as undefined', () => {
      const movie = makeMovie({ runtime: 0 });
      const result = parseShowtimesJson(
        { error: false, results: [{ movie, showtimes: { original: [makeShowtime()] } }] },
        'C0072',
        '2026-02-22'
      );
      expect(result[0].film.duration_minutes).toBeUndefined();
    });

    it('should detect réalisateur as director', () => {
      const movie = makeMovie({
        credits: [
          { person: { fullName: 'French Director' }, position: { name: 'réalisateur' } },
        ],
      });
      const result = parseShowtimesJson(
        { error: false, results: [{ movie, showtimes: { original: [makeShowtime()] } }] },
        'C0072',
        '2026-02-22'
      );
      expect(result[0].film.director).toBe('French Director');
    });

    it('should handle multiple countries joined with comma', () => {
      const movie = makeMovie({
        countries: [{ localizedName: 'France' }, { localizedName: 'Italy' }],
      });
      const result = parseShowtimesJson(
        { error: false, results: [{ movie, showtimes: { original: [makeShowtime()] } }] },
        'C0072',
        '2026-02-22'
      );
      expect(result[0].film.nationality).toBe('France, Italy');
    });

    it('should identify rerelease date from release name containing "reprise"', () => {
      const movie = makeMovie({
        releases: [
          { releaseDate: { date: '2020-01-01T00:00:00' }, name: 'Sortie' },
          { releaseDate: { date: '2026-02-22T00:00:00' }, name: 'Reprise' },
        ],
      });
      const result = parseShowtimesJson(
        { error: false, results: [{ movie, showtimes: { original: [makeShowtime()] } }] },
        'C0072',
        '2026-02-22'
      );
      expect(result[0].film.release_date).toBe('2020-01-01');
      expect(result[0].film.rerelease_date).toBe('2026-02-22');
    });

    it('should skip releases with no date', () => {
      const movie = makeMovie({
        releases: [{ releaseDate: undefined, name: 'Sortie' }],
      });
      const result = parseShowtimesJson(
        { error: false, results: [{ movie, showtimes: { original: [makeShowtime()] } }] },
        'C0072',
        '2026-02-22'
      );
      expect(result[0].film.release_date).toBeUndefined();
    });

    it('should skip credits with no person name', () => {
      const movie = makeMovie({
        credits: [
          { person: undefined, position: { name: 'director' } },
          { person: { fullName: undefined }, position: { name: 'actor' } },
        ],
      });
      const result = parseShowtimesJson(
        { error: false, results: [{ movie, showtimes: { original: [makeShowtime()] } }] },
        'C0072',
        '2026-02-22'
      );
      expect(result[0].film.director).toBeUndefined();
      expect(result[0].film.actors).toEqual([]);
    });

    it('should ignore genres with no translate field', () => {
      const movie = makeMovie({ genres: [{ translate: undefined }, { translate: 'Action' }] });
      const result = parseShowtimesJson(
        { error: false, results: [{ movie, showtimes: { original: [makeShowtime()] } }] },
        'C0072',
        '2026-02-22'
      );
      expect(result[0].film.genres).toEqual(['Action']);
    });
  });

  describe('showtime mapping', () => {
    it('should map a showtime with all fields', () => {
      const result = parseShowtimesJson(makeResponse(), 'C0072', '2026-02-22');
      const st = result[0].showtimes[0];
      expect(st.id).toBe('999-2026-02-22');
      expect(st.film_id).toBe(12345);
      expect(st.cinema_id).toBe('C0072');
      expect(st.date).toBe('2026-02-22');
      expect(st.time).toBe('14:00');
      expect(st.datetime_iso).toBe('2026-02-22T14:00:00');
      expect(st.version).toBe('VO');
      expect(st.format).toBe('DIGITAL');
      expect(st.experiences).toEqual(['Format.Projection.Digital']);
    });

    it('should map diffusionVersion ORIGINAL to VO', () => {
      const st = makeShowtime({ diffusionVersion: 'ORIGINAL' });
      const result = parseShowtimesJson(
        { error: false, results: [{ movie: makeMovie(), showtimes: { original: [st] } }] },
        'C0072',
        '2026-02-22'
      );
      expect(result[0].showtimes[0].version).toBe('VO');
    });

    it('should map diffusionVersion LOCAL to VF', () => {
      const st = makeShowtime({ diffusionVersion: 'LOCAL' });
      const result = parseShowtimesJson(
        { error: false, results: [{ movie: makeMovie(), showtimes: { multiple: [st] } }] },
        'C0072',
        '2026-02-22'
      );
      expect(result[0].showtimes[0].version).toBe('VF');
    });

    it('should map diffusionVersion DUBBED to VF', () => {
      const st = makeShowtime({ diffusionVersion: 'DUBBED' });
      const result = parseShowtimesJson(
        { error: false, results: [{ movie: makeMovie(), showtimes: { multiple: [st] } }] },
        'C0072',
        '2026-02-22'
      );
      expect(result[0].showtimes[0].version).toBe('VF');
    });

    it('should use group version when diffusionVersion is absent', () => {
      const st = makeShowtime({ diffusionVersion: undefined });
      const result = parseShowtimesJson(
        { error: false, results: [{ movie: makeMovie(), showtimes: { original_st: [st] } }] },
        'C0072',
        '2026-02-22'
      );
      expect(result[0].showtimes[0].version).toBe('VOST');
    });

    it('should handle multiple showtime groups (original + original_st + multiple)', () => {
      const stVO = makeShowtime({ internalId: 1, startsAt: '2026-02-22T11:00:00', diffusionVersion: 'ORIGINAL' });
      const stVOST = makeShowtime({ internalId: 2, startsAt: '2026-02-22T14:00:00', diffusionVersion: undefined });
      const stVF = makeShowtime({ internalId: 3, startsAt: '2026-02-22T17:00:00', diffusionVersion: 'LOCAL' });

      const result = parseShowtimesJson(
        {
          error: false,
          results: [{
            movie: makeMovie(),
            showtimes: {
              original: [stVO],
              original_st: [stVOST],
              multiple: [stVF],
            },
          }],
        },
        'C0072',
        '2026-02-22'
      );

      expect(result[0].showtimes).toHaveLength(3);
      expect(result[0].showtimes[0].version).toBe('VO');
      expect(result[0].showtimes[1].version).toBe('VOST');
      expect(result[0].showtimes[2].version).toBe('VF');
    });

    it('should skip showtimes missing startsAt or internalId', () => {
      const valid = makeShowtime();
      const missingStartsAt = { internalId: 10, diffusionVersion: 'ORIGINAL' };
      const missingId = { startsAt: '2026-02-22T18:00:00', diffusionVersion: 'ORIGINAL' };

      const result = parseShowtimesJson(
        {
          error: false,
          results: [{
            movie: makeMovie(),
            showtimes: { original: [valid, missingStartsAt, missingId] },
          }],
        },
        'C0072',
        '2026-02-22'
      );

      expect(result[0].showtimes).toHaveLength(1);
    });

    it('should derive date from startsAt timestamp', () => {
      const st = makeShowtime({ startsAt: '2026-02-23T23:30:00' });
      const result = parseShowtimesJson(
        { error: false, results: [{ movie: makeMovie(), showtimes: { original: [st] } }] },
        'C0072',
        '2026-02-22'
      );
      expect(result[0].showtimes[0].date).toBe('2026-02-23');
    });

    it('should set week_start to the preceding Wednesday', () => {
      // 2026-02-22 is a Sunday; preceding Wednesday is 2026-02-18
      const result = parseShowtimesJson(makeResponse(), 'C0072', '2026-02-22');
      expect(result[0].showtimes[0].week_start).toBe('2026-02-18');
    });

    it('should set week_start correctly when date IS a Wednesday', () => {
      const st = makeShowtime({ startsAt: '2026-02-25T14:00:00' });
      const result = parseShowtimesJson(
        { error: false, results: [{ movie: makeMovie(), showtimes: { original: [st] } }] },
        'C0072',
        '2026-02-25'
      );
      // Wednesday should map to itself
      expect(result[0].showtimes[0].week_start).toBe('2026-02-25');
    });

    it('should handle all six showtime group keys', () => {
      const mkSt = (id: number, time: string) =>
        makeShowtime({ internalId: id, startsAt: `2026-02-22T${time}:00`, diffusionVersion: undefined });

      const result = parseShowtimesJson(
        {
          error: false,
          results: [{
            movie: makeMovie(),
            showtimes: {
              original: [mkSt(1, '10:00')],
              original_st: [mkSt(2, '11:00')],
              original_st_sme: [mkSt(3, '12:00')],
              multiple: [mkSt(4, '13:00')],
              multiple_st: [mkSt(5, '14:00')],
              multiple_st_sme: [mkSt(6, '15:00')],
            },
          }],
        },
        'C0072',
        '2026-02-22'
      );

      expect(result[0].showtimes).toHaveLength(6);
    });
  });

  describe('is_new_this_week flag', () => {
    it('should set is_new_this_week to true when flags.isNewRelease is true', () => {
      const result = parseShowtimesJson(makeResponse(), 'C0072', '2026-02-22');
      expect(result[0].is_new_this_week).toBe(true);
    });

    it('should set is_new_this_week to false when flags.isNewRelease is false', () => {
      const movie = makeMovie({ flags: { isNewRelease: false } });
      const result = parseShowtimesJson(
        { error: false, results: [{ movie, showtimes: { original: [makeShowtime()] } }] },
        'C0072',
        '2026-02-22'
      );
      expect(result[0].is_new_this_week).toBe(false);
    });

    it('should default is_new_this_week to false when flags is absent', () => {
      const movie = makeMovie({ flags: undefined });
      const result = parseShowtimesJson(
        { error: false, results: [{ movie, showtimes: { original: [makeShowtime()] } }] },
        'C0072',
        '2026-02-22'
      );
      expect(result[0].is_new_this_week).toBe(false);
    });
  });

  describe('multiple films', () => {
    it('should return one entry per film with showtimes', () => {
      const movie2 = makeMovie({ internalId: 99999, title: 'Second Film' });
      const result = parseShowtimesJson(
        {
          error: false,
          results: [
            { movie: makeMovie(), showtimes: { original: [makeShowtime()] } },
            { movie: movie2, showtimes: { original: [makeShowtime({ internalId: 888 })] } },
          ],
        },
        'C0072',
        '2026-02-22'
      );
      expect(result).toHaveLength(2);
      expect(result[0].film.id).toBe(12345);
      expect(result[1].film.id).toBe(99999);
    });
  });
});
