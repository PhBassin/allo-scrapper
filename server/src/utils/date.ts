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
  numDays?: number
): string[] {
  if (mode === 'from_today_limited') {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday...
    
    // Calculate days until next Wednesday (start of next cinema week)
    // Wednesday (3) -> 7 days until next Wednesday -> 8 days total (includes both Wednesdays)
    // Thursday  (4) -> 6 days until next Wednesday -> 7 days total
    // Friday    (5) -> 5 days until next Wednesday -> 6 days total
    // Saturday  (6) -> 4 days until next Wednesday -> 5 days total
    // Sunday    (0) -> 3 days until next Wednesday -> 4 days total
    // Monday    (1) -> 2 days until next Wednesday -> 3 days total
    // Tuesday   (2) -> 1 day  until next Wednesday -> 2 days total
    //
    // Formula: ((3 - dayOfWeek + 7) % 7) gives 0 when today is Wednesday,
    // so we use || 7 to map Wednesday to 7 (next Wednesday, not today).
    const daysUntilNextWednesday = ((3 - dayOfWeek + 7) % 7) || 7;
    const naturalDays = daysUntilNextWednesday + 1;
    
    const actualDays = numDays !== undefined ? Math.min(numDays, naturalDays) : naturalDays;
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
