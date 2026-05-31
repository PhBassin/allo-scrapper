import type { DB } from '../db/client.js';
import { getShowtimesByDate, getShowtimesByMovieAndWeek, getWeeklyShowtimes } from '../db/showtime-queries.js';
import { getWeeklyMovies, getMoviesByDate, getMovie, searchMovies } from '../db/movie-queries.js';
import { groupShowtimesByTheater } from '../utils/showtimes.js';
import type { MovieWithShowtimes, Showtime, Theater } from '../types/scraper.js';

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
      theaters: groupShowtimesByTheater(showtimes)
    };
  }

  async search(query: string, limit: number = 10) {
    return searchMovies(this.db, query, limit);
  }

  private mergeMoviesAndShowtimes(movies: any[], allShowtimes: any[]): MovieWithShowtimes[] {
    // ⚡ PERFORMANCE: Use Object.create(null) instead of Map for O(1) lookups without prototype overhead.
    // Classic for-loop avoids iterator allocations. Avoid array spread operations.
    const showtimesByMovie: Record<number, Array<Showtime & { theater: Theater }>> = Object.create(null);
    
    for (let i = 0; i < allShowtimes.length; i++) {
      const s = allShowtimes[i];
      if (!showtimesByMovie[s.movie_id]) {
        showtimesByMovie[s.movie_id] = [];
      }
      showtimesByMovie[s.movie_id].push(s);
    }

    const result = new Array(movies.length);
    for (let i = 0; i < movies.length; i++) {
      const f = movies[i];
      const merged = Object.assign({}, f);
      merged.theaters = groupShowtimesByTheater(showtimesByMovie[f.id] || []);
      result[i] = merged;
    }

    return result;
  }
}
