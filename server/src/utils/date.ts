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

/**
 * Parse a YYYY-MM-DD string as a local date (not UTC).
 * This prevents timezone issues where dates can be off by one day.
 */
export function parseLocalDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00');
}
