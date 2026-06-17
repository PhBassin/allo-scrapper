import { describe, it, expect } from 'vitest';
import {
  deriveProgressState,
  selectCurrentTheater,
  selectCurrentMovie,
} from './scrapeProgress.js';
import type { ProgressEvent } from '../types/index.js';

const startedEvent: ProgressEvent = {
  type: 'started',
  total_theaters: 3,
  total_dates: 7,
};
const theaterStarted: ProgressEvent = {
  type: 'theater_started',
  theater_id: 'W1',
  theater_name: 'Cinéma A',
  index: 0,
};
const dateStarted: ProgressEvent = {
  type: 'date_started',
  date: '2026-06-16',
  theater_name: 'Cinéma A',
};
const movieStarted: ProgressEvent = {
  type: 'movie_started',
  movie_id: 1,
  movie_title: 'Film X',
};
const completed: ProgressEvent = {
  type: 'completed',
  summary: {
    total_theaters: 1,
    successful_theaters: 1,
    failed_theaters: 0,
    total_movies: 1,
    total_showtimes: 1,
    total_dates: 1,
    duration_ms: 100,
    errors: [],
  },
};
const failed: ProgressEvent = { type: 'failed', error: 'boom' };

describe('deriveProgressState', () => {
  it('returns running when no event', () => {
    expect(deriveProgressState(undefined)).toBe('running');
  });

  it('returns running for non-terminal events', () => {
    expect(deriveProgressState(startedEvent)).toBe('running');
    expect(deriveProgressState(theaterStarted)).toBe('running');
    expect(deriveProgressState(movieStarted)).toBe('running');
  });

  it('returns completed for completed event', () => {
    expect(deriveProgressState(completed)).toBe('completed');
  });

  it('returns failed for failed event', () => {
    expect(deriveProgressState(failed)).toBe('failed');
  });
});

describe('selectCurrentTheater', () => {
  it('returns undefined when no event', () => {
    expect(selectCurrentTheater(undefined)).toBeUndefined();
  });

  it('returns theater_name for theater_started', () => {
    expect(selectCurrentTheater(theaterStarted)).toBe('Cinéma A');
  });

  it('returns theater_name for date_started', () => {
    expect(selectCurrentTheater(dateStarted)).toBe('Cinéma A');
  });

  it('returns undefined for unrelated events', () => {
    expect(selectCurrentTheater(movieStarted)).toBeUndefined();
    expect(selectCurrentTheater(completed)).toBeUndefined();
    expect(selectCurrentTheater(failed)).toBeUndefined();
  });
});

describe('selectCurrentMovie', () => {
  it('returns undefined when no event', () => {
    expect(selectCurrentMovie(undefined)).toBeUndefined();
  });

  it('returns movie_title for movie_started', () => {
    expect(selectCurrentMovie(movieStarted)).toBe('Film X');
  });

  it('returns undefined for unrelated events', () => {
    expect(selectCurrentMovie(theaterStarted)).toBeUndefined();
    expect(selectCurrentMovie(dateStarted)).toBeUndefined();
    expect(selectCurrentMovie(completed)).toBeUndefined();
    expect(selectCurrentMovie(failed)).toBeUndefined();
  });
});
