import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useDateFormatter,
  formatDate,
  formatDuration,
  getStatusColor,
  getStatusLabel,
  getTriggerTypeLabel,
  getFullTriggerTypeLabel,
  getAttemptStatusColor,
} from './reports.js';

describe('useDateFormatter', () => {
  it('returns a stable Intl.DateTimeFormat', () => {
    const { result, rerender } = renderHook(() => useDateFormatter());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});

describe('formatDate', () => {
  const formatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' });

  it('returns empty for null/undefined/empty', () => {
    expect(formatDate(null, formatter)).toBe('');
    expect(formatDate(undefined, formatter)).toBe('');
    expect(formatDate('', formatter)).toBe('');
  });

  it('returns empty for invalid date', () => {
    expect(formatDate('not-a-date', formatter)).toBe('');
  });

  it('formats a valid date', () => {
    const out = formatDate('2024-01-15T10:00:00Z', formatter);
    expect(out).not.toBe('');
  });
});

describe('formatDuration', () => {
  it('formats seconds only', () => {
    expect(formatDuration(5_000)).toBe('5s');
    expect(formatDuration(45_000)).toBe('45s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(60_000)).toBe('1m 0s');
    expect(formatDuration(125_000)).toBe('2m 5s');
  });
});

describe('getStatusColor', () => {
  it('returns the right color for known statuses', () => {
    expect(getStatusColor('success')).toContain('green');
    expect(getStatusColor('failed')).toContain('red');
    expect(getStatusColor('rate_limited')).toContain('orange');
  });

  it('returns gray for unknown', () => {
    expect(getStatusColor('unknown')).toContain('gray');
  });
});

describe('getStatusLabel', () => {
  it('translates known statuses to French', () => {
    expect(getStatusLabel('success')).toBe('Succès');
    expect(getStatusLabel('partial_success')).toBe('Succès partiel');
    expect(getStatusLabel('failed')).toBe('Échec');
    expect(getStatusLabel('running')).toBe('En cours');
    expect(getStatusLabel('rate_limited')).toBe('Rate limité');
  });

  it('falls back to the status key for unknown', () => {
    expect(getStatusLabel('mystery')).toBe('mystery');
  });
});

describe('getTriggerTypeLabel', () => {
  it('returns Manuel for manual', () => {
    expect(getTriggerTypeLabel('manual')).toBe('Manuel');
  });

  it('returns Cron for cron', () => {
    expect(getTriggerTypeLabel('cron')).toBe('Cron');
  });
});

describe('getFullTriggerTypeLabel', () => {
  it('returns Manuel for manual', () => {
    expect(getFullTriggerTypeLabel('manual')).toBe('Manuel');
  });

  it('returns Automatique (cron) for cron', () => {
    expect(getFullTriggerTypeLabel('cron')).toBe('Automatique (cron)');
  });
});

describe('getAttemptStatusColor', () => {
  it('returns the right color for known statuses', () => {
    expect(getAttemptStatusColor('success')).toContain('green');
    expect(getAttemptStatusColor('failed')).toContain('red');
    expect(getAttemptStatusColor('pending')).toContain('blue');
  });

  it('returns gray for unknown', () => {
    expect(getAttemptStatusColor('whatever')).toContain('gray');
  });
});
