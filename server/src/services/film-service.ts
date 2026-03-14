import type { DB } from '../db/client.js';
import { getShowtimesByDate, getShowtimesByFilmAndWeek, getWeeklyShowtimes } from '../db/showtime-queries.js';
import { getWeeklyFilms, getFilmsByDate, getFilm, searchFilms } from '../db/film-queries.js';
import { groupShowtimesByCinema } from '../utils/showtimes.js';
import type { FilmWithShowtimes, Showtime, Cinema } from '../types/scraper.js';

export class FilmService {
  constructor(private db: DB) {}

  async getFilmsForWeek(weekStart: string): Promise<FilmWithShowtimes[]> {
    const films = await getWeeklyFilms(this.db, weekStart);
    const allShowtimes = await getWeeklyShowtimes(this.db, weekStart);
    return this.mergeFilmsAndShowtimes(films, allShowtimes);
  }

  async getFilmsForDate(dateParam: string, weekStart: string): Promise<FilmWithShowtimes[]> {
    const films = await getFilmsByDate(this.db, dateParam, weekStart);
    const allShowtimes = await getShowtimesByDate(this.db, dateParam, weekStart);
    return this.mergeFilmsAndShowtimes(films, allShowtimes);
  }

  async getFilmById(filmId: number, weekStart: string): Promise<FilmWithShowtimes | null> {
    const [film, showtimes] = await Promise.all([
      getFilm(this.db, filmId),
      getShowtimesByFilmAndWeek(this.db, filmId, weekStart)
    ]);

    if (!film) {
      return null;
    }

    return {
      ...film,
      cinemas: groupShowtimesByCinema(showtimes)
    };
  }

  async search(query: string, limit: number = 10) {
    return searchFilms(this.db, query, limit);
  }

  private mergeFilmsAndShowtimes(films: any[], allShowtimes: any[]): FilmWithShowtimes[] {
    const showtimesByFilm = new Map<number, Array<Showtime & { cinema: Cinema }>>();
    
    for (const s of allShowtimes) {
      if (!showtimesByFilm.has(s.film_id)) {
        showtimesByFilm.set(s.film_id, []);
      }
      showtimesByFilm.get(s.film_id)!.push(s);
    }

    return films.map(f => ({
      ...f,
      cinemas: groupShowtimesByCinema(showtimesByFilm.get(f.id) || [])
    }));
  }
}
