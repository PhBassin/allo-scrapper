import { describe, it, expect, vi } from 'vitest';
import { parseShowtimesJson } from './theater-json-parser.js';

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const sampleResult = (overrides: Record<string, unknown> = {}) => ({
  movie: {
    internalId: 123,
    title: 'Test Movie',
    originalTitle: 'Test Movie Original',
    runtime: 5400,
    poster: { url: 'https://example.com/poster.jpg' },
    genres: [{ translate: 'Drame' }, { translate: 'Thriller' }],
    countries: [{ localizedName: 'France' }],
    credits: [
      { person: { fullName: 'Director Name' }, position: { name: 'director' } },
      { person: { fullName: 'Writer One' }, position: { name: 'screenwriter' } },
      { person: { fullName: 'Writer Two' }, position: { name: 'scénariste' } },
      { person: { fullName: 'Actor One' }, position: { name: 'actor' } },
      { person: { fullName: 'Actor Two' }, position: { name: 'acteur' } },
      { person: { fullName: 'Unrelated' }, position: { name: 'producer' } },
    ],
    stats: {
      pressReview: { score: 4.2 },
      userRating: { score: 3.8 },
    },
    releases: [
      { name: 'Sortie', releaseDate: { date: '2026-01-15T00:00:00' } },
      { name: 'Reprise', releaseDate: { date: '2026-06-01T00:00:00' } },
    ],
    synopsis: 'A test movie.',
    flags: { isNewRelease: true },
    ...overrides,
  },
  showtimes: {
    original: [{ startsAt: '2026-02-22T11:45:00' }],
    multiple: [{ startsAt: '2026-02-22T14:30:00' }],
  },
});

describe('parseShowtimesJson', () => {
  it('returns empty when response.error is true', () => {
    expect(parseShowtimesJson({ error: true }, 'C0001', '2026-02-22')).toEqual([]);
  });

  it('returns empty when no results', () => {
    expect(parseShowtimesJson({}, 'C0001', '2026-02-22')).toEqual([]);
  });

  it('skips entries without internalId and logs a warning', () => {
    const result = parseShowtimesJson(
      { results: [{ movie: { title: 'no id' }, showtimes: {} }] },
      'C0001',
      '2026-02-22'
    );
    expect(result).toEqual([]);
  });

  it('skips entries with no showtimes', () => {
    const result = parseShowtimesJson(
      { results: [{ movie: { internalId: 1, title: 'No showtimes' }, showtimes: {} }] },
      'C0001',
      '2026-02-22'
    );
    expect(result).toEqual([]);
  });

  it('extracts director, screenwriters, actors with French and English role names', () => {
    const result = parseShowtimesJson(
      { results: [sampleResult()] },
      'C0001',
      '2026-02-22'
    );
    expect(result).toHaveLength(1);
    const movie = result[0].movie;
    expect(movie.director).toBe('Director Name');
    expect(movie.screenwriters).toEqual(['Writer One', 'Writer Two']);
    expect(movie.actors).toEqual(['Actor One', 'Actor Two']);
  });

  it('skips credits without person.fullName', () => {
    const result = parseShowtimesJson(
      {
        results: [
          {
            movie: {
              internalId: 5,
              title: 'M',
              credits: [
                { position: { name: 'director' } },
                { person: { fullName: 'Real Director' }, position: { name: 'director' } },
              ],
            },
            showtimes: { original: [{ startsAt: '2026-02-22T11:45:00' }] },
          },
        ],
      },
      'C0001',
      '2026-02-22'
    );
    expect(result[0].movie.director).toBe('Real Director');
  });

  it('keeps the last director when multiple are present (current behavior)', () => {
    const result = parseShowtimesJson(
      {
        results: [
          {
            movie: {
              internalId: 5,
              title: 'M',
              credits: [
                { person: { fullName: 'First' }, position: { name: 'director' } },
                { person: { fullName: 'Second' }, position: { name: 'réalisateur' } },
              ],
            },
            showtimes: { original: [{ startsAt: '2026-02-22T11:45:00' }] },
          },
        ],
      },
      'C0001',
      '2026-02-22'
    );
    expect(result[0].movie.director).toBe('Second');
  });

  it('parses runtime from seconds to minutes', () => {
    const result = parseShowtimesJson(
      { results: [sampleResult()] },
      'C0001',
      '2026-02-22'
    );
    expect(result[0].movie.duration_minutes).toBe(90);
  });

  it('sets is_new_this_week from flags.isNewRelease', () => {
    const result = parseShowtimesJson(
      { results: [sampleResult()] },
      'C0001',
      '2026-02-22'
    );
    expect(result[0].is_new_this_week).toBe(true);
  });

  it('separates release_date from rerelease_date', () => {
    const result = parseShowtimesJson(
      { results: [sampleResult()] },
      'C0001',
      '2026-02-22'
    );
    expect(result[0].movie.release_date).toBe('2026-01-15');
    expect(result[0].movie.rerelease_date).toBe('2026-06-01');
  });

  it('maps VO/VOST/VF versions from showtime groups', () => {
    const result = parseShowtimesJson(
      {
        results: [
          {
            movie: { internalId: 1, title: 'M' },
            showtimes: {
              original: [{ startsAt: '2026-02-22T11:00:00' }],
              original_st: [{ startsAt: '2026-02-22T13:00:00' }],
              multiple: [{ startsAt: '2026-02-22T15:00:00' }],
            },
          },
        ],
      },
      'C0001',
      '2026-02-22'
    );
    const versions = result[0].showtimes.map((s) => s.version);
    expect(versions).toContain('VO');
    expect(versions).toContain('VOST');
    expect(versions).toContain('VF');
  });
});
