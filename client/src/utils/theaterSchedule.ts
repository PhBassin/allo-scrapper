import type { Movie, ShowtimeWithMovie } from '../types/index.js';

export interface MovieGroup {
  movie: Movie;
  showtimes: ShowtimeWithMovie[];
}

export function getUniqueDates(showtimes: ShowtimeWithMovie[]): string[] {
  return Array.from(new Set(showtimes.map((s) => s.date))).sort();
}

export function getInitialSelectedDate(showtimes: ShowtimeWithMovie[]): string {
  if (showtimes.length === 0) return '';
  const today = new Date().toISOString().split('T')[0];
  const uniqueDates = getUniqueDates(showtimes);
  return uniqueDates.includes(today) ? today : uniqueDates[0];
}

export function groupByMovie(showtimes: ShowtimeWithMovie[]): MovieGroup[] {
  const movieMap = new Map<number, MovieGroup>();
  for (const showtime of showtimes) {
    const existing = movieMap.get(showtime.movie.id);
    if (existing) {
      existing.showtimes.push(showtime);
    } else {
      movieMap.set(showtime.movie.id, { movie: showtime.movie, showtimes: [showtime] });
    }
  }
  return Array.from(movieMap.values());
}

interface DateLabel {
  weekday: string;
  day: number;
  month: string;
}

export function createDateLabelFormatter() {
  const formatterWeekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });
  const formatterMonth = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
  return (dateStr: string): DateLabel => {
    if (!dateStr) return { weekday: '', day: 0, month: '' };
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) return { weekday: 'Invalid', day: 0, month: 'Date' };
    return {
      weekday: formatterWeekday.format(date).replace('.', ''),
      day: date.getDate(),
      month: formatterMonth.format(date),
    };
  };
}

export function formatDurationShort(minutes?: number): string {
  if (!minutes) return '';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h${remainder > 0 ? String(remainder).padStart(2, '0') : ''}`;
}