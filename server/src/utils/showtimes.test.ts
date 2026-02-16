import { describe, it, expect } from 'vitest';
import { groupShowtimesByCinema } from './showtimes.js';
import type { Showtime, Cinema } from '../types/scraper.js';

describe('Utils - groupShowtimesByCinema', () => {
  it('should group showtimes by cinema correctly', () => {
    const cinema1: Cinema = { id: 'C1', name: 'Cinema 1' } as any;
    const cinema2: Cinema = { id: 'C2', name: 'Cinema 2' } as any;

    const showtimes: Array<Showtime & { cinema: Cinema }> = [
      { id: 's1', cinema_id: 'C1', cinema: cinema1, time: '14:00' } as any,
      { id: 's2', cinema_id: 'C1', cinema: cinema1, time: '16:00' } as any,
      { id: 's3', cinema_id: 'C2', cinema: cinema2, time: '20:00' } as any,
    ];

    const result = groupShowtimesByCinema(showtimes);

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
    expect(groupShowtimesByCinema([])).toEqual([]);
  });
});
