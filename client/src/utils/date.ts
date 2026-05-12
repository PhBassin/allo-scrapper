export const getUniqueDates = (showtimes: { date: string }[]): string[] => {
  const dates = new Set(showtimes.map(s => s.date));
  return Array.from(dates).sort();
};

// ⚡ PERFORMANCE: Cache Intl.DateTimeFormat instances to prevent expensive
// re-initialization during loops or frequent re-renders
const formatterWeekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });
const formatterMonth = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
const formatterFull = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

export const formatDateLabel = (dateStr: string) => {
  if (!dateStr) return { weekday: '', day: 0, month: '', full: '' };
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return { weekday: 'Invalid', day: 0, month: 'Date', full: 'Invalid Date' };

  return {
    weekday: formatterWeekday.format(date).replace('.', ''),
    day: date.getDate(),
    month: formatterMonth.format(date),
    full: formatterFull.format(date),
  };
};

const pad = (n: number) => String(n).padStart(2, '0');

export const toGoogleCalendarFormat = (datetimeIso: string, durationMinutes = 120): string => {
  const start = new Date(datetimeIso);
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

  return `${fmt(start)}/${fmt(end)}`;
};
