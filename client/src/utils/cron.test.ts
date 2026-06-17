import { describe, it, expect } from 'vitest';
import {
  parseCronToSimple,
  buildCron,
  formatCronDescription,
  validateCron,
} from './cron.js';

describe('parseCronToSimple', () => {
  it('parses daily cron', () => {
    expect(parseCronToSimple('0 3 * * *')).toEqual({
      frequency: 'daily',
      hour: 3,
      minute: 0,
      weekdays: [],
      monthDay: 1,
    });
  });

  it('parses weekly cron', () => {
    expect(parseCronToSimple('0 3 * * 1,3,5')).toEqual({
      frequency: 'weekly',
      hour: 3,
      minute: 0,
      weekdays: [1, 3, 5],
      monthDay: 1,
    });
  });

  it('parses monthly cron', () => {
    expect(parseCronToSimple('0 3 15 * *')).toEqual({
      frequency: 'monthly',
      hour: 3,
      minute: 0,
      weekdays: [],
      monthDay: 15,
    });
  });

  it('returns null for invalid cron', () => {
    expect(parseCronToSimple('0 3 * *')).toBeNull();
    expect(parseCronToSimple('')).toBeNull();
  });

  it('treats wildcard hour/minute as 0', () => {
    expect(parseCronToSimple('* * * * *')).toEqual({
      frequency: 'daily',
      hour: 0,
      minute: 0,
      weekdays: [],
      monthDay: 1,
    });
  });
});

describe('buildCron', () => {
  it('builds daily cron', () => {
    expect(buildCron('daily', 3, 0, [], 1)).toBe('0 3 * * *');
  });

  it('builds weekly cron', () => {
    expect(buildCron('weekly', 3, 0, [1, 3, 5], 1)).toBe('0 3 * * 1,3,5');
  });

  it('builds weekly with empty weekdays as wildcard', () => {
    expect(buildCron('weekly', 3, 0, [], 1)).toBe('0 3 * * *');
  });

  it('builds monthly cron', () => {
    expect(buildCron('monthly', 3, 0, [], 15)).toBe('0 3 15 * *');
  });
});

describe('formatCronDescription', () => {
  it('describes daily', () => {
    expect(formatCronDescription('0 3 * * *')).toBe('Daily at 03:00');
  });

  it('describes weekly', () => {
    expect(formatCronDescription('0 3 * * 3')).toBe('Every Wed at 03:00');
  });

  it('describes monthly', () => {
    expect(formatCronDescription('0 3 15 * *')).toBe('Monthly on day 15 at 03:00');
  });

  it('falls back to raw cron for invalid input', () => {
    expect(formatCronDescription('garbage')).toBe('garbage');
  });
});

describe('validateCron', () => {
  it('rejects empty', () => {
    expect(validateCron('')).toBe('Cron expression is required');
  });

  it('rejects wrong number of parts', () => {
    expect(validateCron('0 3 * *')).toBe('Cron expression must have 5 parts');
  });

  it('accepts valid 5-part cron', () => {
    expect(validateCron('0 3 * * *')).toBeNull();
  });
});