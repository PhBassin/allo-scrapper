export const getUniqueDates = (showtimes: { date: string }[]): string[] => {
  const dates = new Set(showtimes.map(s => s.date));
  return Array.from(dates).sort();
};

// ⚡ PERFORMANCE: Cache Intl.DateTimeFormat instances to avoid expensive initialization on every call
const weekdayFormatter = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });
const monthFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
const fullFormatter = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

export const formatDateLabel = (dateStr: string) => {
  const date = new Date(dateStr + 'T00:00:00');
  return {
    weekday: weekdayFormatter.format(date).replace('.', ''),
    day: date.getDate(),
    month: monthFormatter.format(date),
    full: fullFormatter.format(date),
  };
};
