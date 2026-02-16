import { describe, it, expect } from 'vitest';
import { getUniqueDates, formatDateLabel } from './date';

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
});
