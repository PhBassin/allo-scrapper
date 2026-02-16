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
    console.warn(`⚠️  SCRAPE_DAYS value ${numDays} out of range. Using ${validatedDays} instead (valid range: 1-14)`);
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
  numDays: number = 7
): string[] {
  if (mode === 'from_today_limited') {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday...
    
    // Calculate days until next Tuesday (end of cinema week)
    // Sunday (0) -> 2 days (Tue)
    // Monday (1) -> 1 day (Tue)
    // Tuesday (2) -> 0 days (wait, if today is Tuesday, we want today, so 1 day total)
    // Wednesday (3) -> 6 days (next Tue)
    // Saturday (6) -> 3 days (next Tue)
    
    // Logic: distance to 2 (Tuesday), if negative add 7
    let daysUntilTuesday = 2 - dayOfWeek;
    if (daysUntilTuesday < 0) {
      daysUntilTuesday += 7;
    }
    
    const actualDays = Math.min(numDays, daysUntilTuesday + 1);
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
