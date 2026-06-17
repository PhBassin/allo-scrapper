import { describe, it, expect } from 'vitest';
import { formatDuration } from './duration.js';

describe('formatDuration', () => {
  it('returns empty string for undefined', () => {
    expect(formatDuration(undefined)).toBe('');
  });

  it('returns empty string for 0', () => {
    expect(formatDuration(0)).toBe('');
  });

  it('formats exact hours without minutes', () => {
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(120)).toBe('2h');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(125)).toBe('2h 5min');
    expect(formatDuration(90)).toBe('1h 30min');
  });
});
