export type Frequency = 'daily' | 'weekly' | 'monthly';

export interface CronParts {
  frequency: Frequency;
  hour: number;
  minute: number;
  weekdays: number[];
  monthDay: number;
}

export const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];

export const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: i.toString().padStart(2, '0'),
}));

export const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => ({
  value: m,
  label: m.toString().padStart(2, '0'),
}));

export const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1}`,
}));

export const CRON_PRESETS = [
  { label: 'Every day at 3am', value: '0 3 * * *' },
  { label: 'Every Wednesday at 3am', value: '0 3 * * 3' },
  { label: 'Every Monday at 3am', value: '0 3 * * 1' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Every 12 hours', value: '0 */12 * * *' },
  { label: '1st of month at 3am', value: '0 3 1 * *' },
];

function parseIntOrZero(s: string): number {
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

export function parseCronToSimple(cron: string): CronParts | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minute, hour, monthDay, , weekdays] = parts;

  const frequency: Frequency = weekdays !== '*' ? 'weekly' : monthDay !== '*' ? 'monthly' : 'daily';

  return {
    frequency,
    hour: hour === '*' ? 0 : parseIntOrZero(hour),
    minute: minute === '*' ? 0 : parseIntOrZero(minute),
    weekdays: weekdays !== '*' ? weekdays.split(',').map(parseIntOrZero) : [],
    monthDay: monthDay !== '*' ? parseIntOrZero(monthDay) : 1,
  };
}

export function buildCron(
  frequency: Frequency,
  hour: number,
  minute: number,
  weekdays: number[],
  monthDay: number
): string {
  const days = weekdays.length > 0 ? weekdays.join(',') : '*';
  switch (frequency) {
    case 'daily':
      return `${minute} ${hour} * * *`;
    case 'weekly':
      return `${minute} ${hour} * * ${days}`;
    case 'monthly':
      return `${minute} ${hour} ${monthDay} * *`;
  }
}

function pad2(n: string | number): string {
  return String(n).padStart(2, '0');
}

export function formatCronDescription(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  const [minute, hour, monthDay, , weekdays] = parts;
  const timeStr = `${pad2(hour)}:${pad2(minute)}`;

  if (weekdays !== '*') {
    const days = weekdays.split(',').map((d) => {
      const dayNum = parseInt(d, 10);
      const day = DAYS_OF_WEEK.find((x) => x.value === dayNum || x.value === (dayNum === 7 ? 0 : dayNum));
      return day?.label || d;
    });
    return `Every ${days.join(', ')} at ${timeStr}`;
  }

  if (monthDay !== '*') {
    return `Monthly on day ${monthDay} at ${timeStr}`;
  }

  return `Daily at ${timeStr}`;
}

export function validateCron(expression: string): string | null {
  if (!expression) return 'Cron expression is required';
  if (expression.trim().split(/\s+/).length !== 5) {
    return 'Cron expression must have 5 parts';
  }
  return null;
}