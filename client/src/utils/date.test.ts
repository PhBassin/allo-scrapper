import { describe, it, expect } from 'vitest';
import { getUniqueDates, formatDateLabel, toGoogleCalendarFormat } from './date';

describe('Date Utils', () => {
  describe('getUniqueDates', () => {
    it('should extract and sort unique dates', () => {
      const showtimes = [
        { date: '2026-02-20' },
        { date: '2026-02-18' },
        { date: '2026-02-20' },
        { date: '2026-02-19' }
      ];
      
      const result = getUniqueDates(showtimes);
      expect(result).toEqual(['2026-02-18', '2026-02-19', '2026-02-20']);
    });

    it('should handle empty array', () => {
      expect(getUniqueDates([])).toEqual([]);
    });
  });

  describe('formatDateLabel', () => {
    it('should format date correctly in French', () => {
      const date = '2026-02-18'; // This is a Wednesday
      const label = formatDateLabel(date);
      
      expect(label.weekday.toLowerCase()).toContain('mer');
      expect(label.day).toBe(18);
      expect(label.month.toLowerCase()).toContain('févr');
      expect(label.full.toLowerCase()).toContain('mercredi 18 février');
    });
  });

  describe('toGoogleCalendarFormat', () => {
    it('formats an ISO datetime with default 2h duration', () => {
      const result = toGoogleCalendarFormat('2026-02-24T14:30:00.000Z');
      expect(result).toBe('20260224T143000Z/20260224T163000Z');
    });

    it('formats with custom duration', () => {
      const result = toGoogleCalendarFormat('2026-02-24T14:30:00.000Z', 90);
      expect(result).toBe('20260224T143000Z/20260224T160000Z');
    });

    it('handles midnight correctly', () => {
      const result = toGoogleCalendarFormat('2026-12-31T00:00:00.000Z', 60);
      expect(result).toBe('20261231T000000Z/20261231T010000Z');
    });

    it('handles month boundary', () => {
      const result = toGoogleCalendarFormat('2026-01-31T23:30:00.000Z', 60);
      expect(result).toBe('20260131T233000Z/20260201T003000Z');
    });

    it('handles year boundary', () => {
      const result = toGoogleCalendarFormat('2026-12-31T23:45:00.000Z', 30);
      expect(result).toBe('20261231T234500Z/20270101T001500Z');
    });
  });
});
