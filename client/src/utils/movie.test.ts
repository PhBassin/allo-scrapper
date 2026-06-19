import { describe, it, expect } from 'vitest';
import { hasRating, deriveMovieError } from './movie.js';

describe('hasRating', () => {
  it('returns false for null', () => {
    expect(hasRating(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(hasRating(undefined)).toBe(false);
  });

  it('returns false for 0', () => {
    expect(hasRating(0)).toBe(false);
  });

  it('returns true for positive value', () => {
    expect(hasRating(3.5)).toBe(true);
    expect(hasRating(0.1)).toBe(true);
  });
});

describe('deriveMovieError', () => {
  it('returns Invalid movie ID when id is invalid', () => {
    expect(deriveMovieError(true, null)).toBe('Invalid movie ID');
  });

  it('returns Error message when queryError is an Error', () => {
    expect(deriveMovieError(false, new Error('boom'))).toBe('boom');
  });

  it('returns generic message when queryError is truthy but not Error', () => {
    expect(deriveMovieError(false, 'something')).toBe('Failed to load movie data');
    expect(deriveMovieError(false, { code: 500 })).toBe('Failed to load movie data');
  });

  it('returns null when no error', () => {
    expect(deriveMovieError(false, null)).toBeNull();
    expect(deriveMovieError(false, undefined)).toBeNull();
    expect(deriveMovieError(false, false)).toBeNull();
  });
});
