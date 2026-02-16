export const getUniqueDates = (showtimes: { date: string }[]): string[] => {
  const dates = new Set(showtimes.map(s => s.date));
  return Array.from(dates).sort();
};

export const formatDateLabel = (dateStr: string) => {
  const date = new Date(dateStr + 'T00:00:00');
  return {
    weekday: date.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''),
    day: date.getDate(),
    month: date.toLocaleDateString('fr-FR', { month: 'short' }),
    full: date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
  };
};
