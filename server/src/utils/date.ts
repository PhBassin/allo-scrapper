import { logger } from '../utils/logger.js';

export function getCurrentWeekStart(): string {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 3 = Wednesday
  
  // Calculate offset to previous or current Wednesday
  let offset = dayOfWeek - 3;
  if (offset < 0) {
    offset += 7;
  }
  
  const wednesday = new Date(today);
  wednesday.setDate(today.getDate() - offset);
  return wednesday.toISOString().split('T')[0];
}

// Alias for getCurrentWeekStart
export const getWeekStart = getCurrentWeekStart;

export function getWeekDates(weekStart?: string, numDays: number = 7): string[] {
  const start = weekStart ? new Date(weekStart) : new Date(getCurrentWeekStart());
  
  // Validation: numDays doit être entre 1 et 14
  const validatedDays = Math.max(1, Math.min(14, numDays));
  
  if (validatedDays !== numDays) {
    logger.warn(`SCRAPE_DAYS value ${numDays} out of range. Using ${validatedDays} instead (valid range: 1-14)`);
  }
  
  const dates: string[] = [];
  for (let i = 0; i < validatedDays; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }
  
  return dates;
}

export function formatDate(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}

export function getTodayDate(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

export type ScrapeMode = 'weekly' | 'from_today' | 'from_today_limited';

/**
 * Get dates to scrape based on mode and number of days.
 * - 'weekly': Start from current Wednesday, 7 days
 * - 'from_today': Start from today's date, n days
 * - 'from_today_limited': Start from today until Tuesday, max 7 days
 */
export function getScrapeDates(
  mode: ScrapeMode = 'weekly',
  numDays?: number
): string[] {
  if (mode === 'from_today_limited') {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday...

    const daysUntilTuesday = (2 - dayOfWeek + 7) % 7;
    const totalDays = daysUntilTuesday === 0 ? 1 : daysUntilTuesday + 1;

    const actualDays = numDays !== undefined ? Math.min(numDays, totalDays) : totalDays;
    return getWeekDates(getTodayDate(), actualDays);
  }

  const startDate = mode === 'from_today'
    ? getTodayDate()
    : getCurrentWeekStart();

  return getWeekDates(startDate, numDays);
}

/**
 * Parse a YYYY-MM-DD string as a local date (not UTC).
 * This prevents timezone issues where dates can be off by one day.
 */
export function parseLocalDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00');
}

/**
 * Return the Wednesday (week start) for a given YYYY-MM-DD date string.
 * Uses local time parsing to avoid timezone off-by-one issues.
 */
export function getWeekStartForDate(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  const dayOfWeek = date.getDay(); // 0 = Sunday, 3 = Wednesday

  let offset = dayOfWeek - 3;
  if (offset < 0) {
    offset += 7;
  }

  const wednesday = new Date(date);
  wednesday.setDate(date.getDate() - offset);

  // Format as YYYY-MM-DD in local time
  const year = wednesday.getFullYear();
  const month = String(wednesday.getMonth() + 1).padStart(2, '0');
  const day = String(wednesday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
