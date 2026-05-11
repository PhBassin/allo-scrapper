import type { DB } from '../db/client.js';
import { getShowtimesByDate, getShowtimesByMovieAndWeek, getWeeklyShowtimes } from '../db/showtime-queries.js';
import { getWeeklyMovies, getMoviesByDate, getMovie, searchMovies } from '../db/movie-queries.js';
import { groupShowtimesByCinema } from '../utils/showtimes.js';
import type { MovieWithShowtimes, Showtime, Cinema } from '../types/scraper.js';

export class MovieService {
  constructor(private db: DB) {}

  async getMoviesForWeek(weekStart: string): Promise<MovieWithShowtimes[]> {
    // ⚡ PERFORMANCE: Run independent DB queries concurrently to reduce total response time
    const [movies, allShowtimes] = await Promise.all([
      getWeeklyMovies(this.db, weekStart),
      getWeeklyShowtimes(this.db, weekStart)
    ]);
    return this.mergeMoviesAndShowtimes(movies, allShowtimes);
  }

  async getMoviesForDate(dateParam: string, weekStart: string): Promise<MovieWithShowtimes[]> {
    // ⚡ PERFORMANCE: Run independent DB queries concurrently to reduce total response time
    const [movies, allShowtimes] = await Promise.all([
      getMoviesByDate(this.db, dateParam, weekStart),
      getShowtimesByDate(this.db, dateParam, weekStart)
    ]);
    return this.mergeMoviesAndShowtimes(movies, allShowtimes);
  }

  async getMovieById(movieId: number, weekStart: string): Promise<MovieWithShowtimes | null> {
    const [movie, showtimes] = await Promise.all([
      getMovie(this.db, movieId),
      getShowtimesByMovieAndWeek(this.db, movieId, weekStart)
    ]);

    if (!movie) {
      return null;
    }

    return {
      ...movie,
      cinemas: groupShowtimesByCinema(showtimes)
    };
  }

  async search(query: string, limit: number = 10) {
    return searchMovies(this.db, query, limit);
  }

  private mergeMoviesAndShowtimes(movies: any[], allShowtimes: any[]): MovieWithShowtimes[] {
    const showtimesByMovie = new Map<number, Array<Showtime & { cinema: Cinema }>>();
    
    for (const s of allShowtimes) {
      if (!showtimesByMovie.has(s.movie_id)) {
        showtimesByMovie.set(s.movie_id, []);
      }
      showtimesByMovie.get(s.movie_id)!.push(s);
    }

    return movies.map(f => ({
      ...f,
      cinemas: groupShowtimesByCinema(showtimesByMovie.get(f.id) || [])
    }));
  }
}
