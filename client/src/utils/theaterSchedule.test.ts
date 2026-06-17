import { describe, it, expect } from 'vitest';
import {
  getUniqueDates,
  getInitialSelectedDate,
  groupByMovie,
  createDateLabelFormatter,
  formatDurationShort,
} from './theaterSchedule.js';
import type { ShowtimeWithMovie } from '../types/index.js';

const baseMovie = {
  id: 1,
  title: 'Film A',
  genres: [],
  actors: [],
  source_url: 'https://example.com/a',
};

const baseShowtime = (overrides: Partial<ShowtimeWithMovie> = {}): ShowtimeWithMovie => ({
  id: 'st1',
  movie_id: 1,
  theater_id: 'T1',
  date: '2026-03-15',
  time: '20:00',
  datetime_iso: '2026-03-15T20:00:00',
  version: 'VF',
  experiences: [],
  week_start: '2026-03-11',
  movie: { ...baseMovie },
  ...overrides,
});

describe('getUniqueDates', () => {
  it('returns unique sorted dates', () => {
    const dates = getUniqueDates([
      baseShowtime({ date: '2026-03-15' }),
      baseShowtime({ id: 'st2', date: '2026-03-14' }),
      baseShowtime({ id: 'st3', date: '2026-03-15' }),
    ]);
    expect(dates).toEqual(['2026-03-14', '2026-03-15']);
  });

  it('returns empty for empty input', () => {
    expect(getUniqueDates([])).toEqual([]);
  });
});

describe('getInitialSelectedDate', () => {
  it('returns today when today is in the list', () => {
    const today = new Date().toISOString().split('T')[0];
    const result = getInitialSelectedDate([
      baseShowtime({ date: '2026-03-14' }),
      baseShowtime({ id: 'st2', date: today }),
    ]);
    expect(result).toBe(today);
  });

  it('returns the earliest date when today is missing', () => {
    const result = getInitialSelectedDate([
      baseShowtime({ date: '2026-03-14' }),
      baseShowtime({ id: 'st2', date: '2026-03-15' }),
    ]);
    expect(result).toBe('2026-03-14');
  });

  it('returns empty when no showtimes', () => {
    expect(getInitialSelectedDate([])).toBe('');
  });
});

describe('groupByMovie', () => {
  it('groups showtimes by movie', () => {
    const groups = groupByMovie([
      baseShowtime({ id: 'st1', date: '2026-03-15' }),
      baseShowtime({ id: 'st2', date: '2026-03-15', time: '21:00' }),
      baseShowtime({ id: 'st3', movie_id: 2, movie: { ...baseMovie, id: 2, title: 'Film B' } }),
    ]);
    expect(groups).toHaveLength(2);
    const a = groups.find((g) => g.movie.id === 1)!;
    const b = groups.find((g) => g.movie.id === 2)!;
    expect(a.showtimes).toHaveLength(2);
    expect(b.showtimes).toHaveLength(1);
  });

  it('returns empty for empty input', () => {
    expect(groupByMovie([])).toEqual([]);
  });
});

describe('createDateLabelFormatter', () => {
  const format = createDateLabelFormatter();
  it('returns empty label for empty string', () => {
    expect(format('')).toEqual({ weekday: '', day: 0, month: '' });
  });
  it('returns Invalid label for bad date', () => {
    expect(format('not-a-date')).toEqual({ weekday: 'Invalid', day: 0, month: 'Date' });
  });
  it('returns weekday, day and month for a valid date', () => {
    const out = format('2026-03-15');
    expect(out.day).toBe(15);
    expect(typeof out.weekday).toBe('string');
    expect(typeof out.month).toBe('string');
  });
});

describe('formatDurationShort', () => {
  it('formats exact hours', () => {
    expect(formatDurationShort(60)).toBe('1h');
    expect(formatDurationShort(120)).toBe('2h');
  });

  it('formats hours with minutes', () => {
    expect(formatDurationShort(95)).toBe('1h35');
    expect(formatDurationShort(125)).toBe('2h05');
  });

  it('returns empty for missing or zero duration', () => {
    expect(formatDurationShort(undefined)).toBe('');
    expect(formatDurationShort(0)).toBe('');
  });
});