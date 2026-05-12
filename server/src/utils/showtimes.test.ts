import { describe, it, expect } from 'vitest';
import { groupShowtimesByTheater } from './showtimes.js';
import type { Showtime, Theater } from '../types/scraper.js';

describe('Utils - groupShowtimesByTheater', () => {
  it('should group showtimes by theater correctly', () => {
    const theater1: Theater = { id: 'C1', name: 'Theater 1' } as any;
    const theater2: Theater = { id: 'C2', name: 'Theater 2' } as any;

    const showtimes: Array<Showtime & { theater: Theater }> = [
      { id: 's1', theater_id: 'C1', theater: theater1, time: '14:00' } as any,
      { id: 's2', theater_id: 'C1', theater: theater1, time: '16:00' } as any,
      { id: 's3', theater_id: 'C2', theater: theater2, time: '20:00' } as any,
    ];

    const result = groupShowtimesByTheater(showtimes);

    expect(result).toHaveLength(2);
    
    const resC1 = result.find(c => c.id === 'C1');
    const resC2 = result.find(c => c.id === 'C2');

    expect(resC1?.showtimes).toHaveLength(2);
    expect(resC1?.showtimes[0].id).toBe('s1');
    expect(resC1?.showtimes[1].id).toBe('s2');
    
    expect(resC2?.showtimes).toHaveLength(1);
    expect(resC2?.showtimes[0].id).toBe('s3');
  });

  it('should return empty array for empty input', () => {
    expect(groupShowtimesByTheater([])).toEqual([]);
  });
});
