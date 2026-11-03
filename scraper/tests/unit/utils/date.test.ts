import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { getScrapeDates, getWeekStartForDate } from '../../../src/utils/date.js';

// The helpers mix UTC and local-time arithmetic, so pin the timezone.
const originalTz = process.env.TZ;

beforeAll(() => {
  process.env.TZ = 'UTC';
});

afterAll(() => {
  process.env.TZ = originalTz;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function setToday(isoDate: string): void {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${isoDate}T12:00:00Z`));
}

describe('getScrapeDates', () => {
  it('weekly mode starts on the current Wednesday and spans 7 days', () => {
    setToday('2026-11-02'); // Monday

    expect(getScrapeDates('weekly')).toEqual([
      '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31',
      '2026-11-01', '2026-11-02', '2026-11-03',
    ]);
  });

  it('weekly mode starts today when today is Wednesday', () => {
    setToday('2026-11-04'); // Wednesday

    expect(getScrapeDates()[0]).toBe('2026-11-04');
  });

  it('from_today mode starts today for the requested number of days', () => {
    setToday('2026-11-02');

    expect(getScrapeDates('from_today', 3)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04']);
  });

  it('from_today_limited mode stops on Tuesday', () => {
    setToday('2026-11-02'); // Monday

    expect(getScrapeDates('from_today_limited')).toEqual(['2026-11-02', '2026-11-03']);
  });

  it('from_today_limited mode scrapes a single day on Tuesday', () => {
    setToday('2026-11-03'); // Tuesday

    expect(getScrapeDates('from_today_limited')).toEqual(['2026-11-03']);
  });

  it('from_today_limited mode honors a smaller numDays', () => {
    setToday('2026-11-04'); // Wednesday: 7 days until Tuesday

    expect(getScrapeDates('from_today_limited', 2)).toEqual(['2026-11-04', '2026-11-05']);
  });

  it('clamps numDays above 14 and warns', () => {
    setToday('2026-11-02');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(getScrapeDates('from_today', 30)).toHaveLength(14);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('clamps numDays below 1 and warns', () => {
    setToday('2026-11-02');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(getScrapeDates('from_today', 0)).toEqual(['2026-11-02']);
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe('getWeekStartForDate', () => {
  it('returns the previous Wednesday for a Monday', () => {
    expect(getWeekStartForDate('2026-11-02')).toBe('2026-10-28');
  });

  it('returns the same day for a Wednesday', () => {
    expect(getWeekStartForDate('2026-11-04')).toBe('2026-11-04');
  });

  it('returns the Wednesday of the same week for a Saturday', () => {
    expect(getWeekStartForDate('2026-11-07')).toBe('2026-11-04');
  });

  it('crosses month and year boundaries', () => {
    expect(getWeekStartForDate('2027-01-01')).toBe('2026-12-30');
  });
});
