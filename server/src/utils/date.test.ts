import { describe, it, expect, vi } from 'vitest';
import { getWeekDates, getCurrentWeekStart, getTodayDate, getScrapeDates } from './date.js';

describe('getScrapeDates', () => {
  it('should return 7 dates starting from Wednesday in weekly mode', () => {
    const dates = getScrapeDates('weekly', 7);
    expect(dates).toHaveLength(7);
    const firstDate = new Date(dates[0] + 'T00:00:00');
    expect(firstDate.getDay()).toBe(3); // Wednesday
  });

  it('should return 3 dates starting from today in from_today mode', () => {
    const today = getTodayDate();
    const dates = getScrapeDates('from_today', 3);
    expect(dates).toHaveLength(3);
    expect(dates[0]).toBe(today);
  });

  it('should default to weekly mode and 7 days', () => {
    const dates = getScrapeDates();
    expect(dates).toHaveLength(7);
    const firstDate = new Date(dates[0] + 'T00:00:00');
    expect(firstDate.getDay()).toBe(3); // Wednesday
  });
});

describe('getWeekDates', () => {
  it('should return exactly 7 dates by default', () => {
    const dates = getWeekDates();
    expect(dates).toHaveLength(7);
  });

  it('should return consecutive dates starting from Wednesday', () => {
    const dates = getWeekDates('2026-02-18'); // Wednesday, Feb 18, 2026
    expect(dates).toEqual([
      '2026-02-18', // Wed
      '2026-02-19', // Thu
      '2026-02-20', // Fri
      '2026-02-21', // Sat
      '2026-02-22', // Sun
      '2026-02-23', // Mon
      '2026-02-24', // Tue
    ]);
  });

  it('should respect custom numDays parameter', () => {
    const dates = getWeekDates('2026-02-18', 3);
    expect(dates).toHaveLength(3);
    expect(dates).toEqual([
      '2026-02-18',
      '2026-02-19',
      '2026-02-20',
    ]);
  });

  it('should handle numDays = 1 (single day)', () => {
    const dates = getWeekDates('2026-02-18', 1);
    expect(dates).toHaveLength(1);
    expect(dates).toEqual(['2026-02-18']);
  });

  it('should clamp numDays to max 14 days', () => {
    const dates = getWeekDates('2026-02-18', 20); // Demande 20 jours
    expect(dates).toHaveLength(14); // Plafonné à 14
  });

  it('should clamp numDays to min 1 day', () => {
    const dates = getWeekDates('2026-02-18', 0); // Demande 0 jours
    expect(dates).toHaveLength(1); // Minimum 1
  });

  it('should return dates in YYYY-MM-DD format', () => {
    const dates = getWeekDates('2026-02-18', 2);
    dates.forEach(date => {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it('should start from current Wednesday when no weekStart provided', () => {
    const dates = getWeekDates();
    const firstDate = new Date(dates[0] + 'T00:00:00');
    expect(firstDate.getDay()).toBe(3); // 3 = Wednesday
  });

  it('should handle month transitions correctly', () => {
    const dates = getWeekDates('2026-02-25', 7); // Crosses into March
    expect(dates).toEqual([
      '2026-02-25',
      '2026-02-26',
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
    ]);
  });

  it('should handle year transitions correctly', () => {
    const dates = getWeekDates('2025-12-29', 7); // Crosses into 2026
    expect(dates).toEqual([
      '2025-12-29',
      '2025-12-30',
      '2025-12-31',
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
    ]);
  });
});

describe('getCurrentWeekStart', () => {
  it('should return a date string in YYYY-MM-DD format', () => {
    const weekStart = getCurrentWeekStart();
    expect(weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should return a Wednesday', () => {
    const weekStart = getCurrentWeekStart();
    const date = new Date(weekStart + 'T00:00:00');
    expect(date.getDay()).toBe(3); // Wednesday
  });
});

describe('getTodayDate', () => {
  it('should return today\'s date in YYYY-MM-DD format', () => {
    const today = getTodayDate();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
