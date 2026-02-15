import { type DB } from './client.js';
import type { Cinema, Film, Showtime, WeeklyProgram } from '../scraper/types.js';

// Helper to handle parameter syntax for PostgreSQL
// We convert from named parameters (conceptually) to numbered parameters ($1, $2, etc.)

// Insertion ou mise à jour d'un cinéma
export async function upsertCinema(db: DB, cinema: Cinema): Promise<void> {
  await db.query(
    `
      INSERT INTO cinemas (id, name, address, postal_code, city, screen_count, image_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT(id) DO UPDATE SET
        name = $2,
        address = $3,
        postal_code = $4,
        city = $5,
        screen_count = $6,
        image_url = $7
    `,
    [
      cinema.id,
      cinema.name,
      cinema.address || null,
      cinema.postal_code || null,
      cinema.city || null,
      cinema.screen_count || null,
      cinema.image_url || null,
    ]
  );
}

// Insertion ou mise à jour d'un film
export async function upsertFilm(db: DB, film: Film): Promise<void> {
  await db.query(
    `
      INSERT INTO films (
        id, title, original_title, poster_url, duration_minutes,
        release_date, rerelease_date, genres, nationality, director,
        actors, synopsis, certificate, press_rating, audience_rating, allocine_url
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16
      )
      ON CONFLICT(id) DO UPDATE SET
        title = $2,
        original_title = $3,
        poster_url = $4,
        duration_minutes = COALESCE($5, films.duration_minutes),
        release_date = COALESCE($6, films.release_date),
        rerelease_date = $7,
        genres = $8,
        nationality = $9,
        director = $10,
        actors = $11,
        synopsis = $12,
        certificate = $13,
        press_rating = $14,
        audience_rating = $15,
        allocine_url = $16
    `,
    [
      film.id,
      film.title,
      film.original_title || null,
      film.poster_url || null,
      film.duration_minutes || null,
      film.release_date || null,
      film.rerelease_date || null,
      JSON.stringify(film.genres),
      film.nationality || null,
      film.director || null,
      JSON.stringify(film.actors),
      film.synopsis || null,
      film.certificate || null,
      film.press_rating || null,
      film.audience_rating || null,
      film.allocine_url,
    ]
  );
}

// Insertion ou mise à jour d'une séance
export async function upsertShowtime(db: DB, showtime: Showtime): Promise<void> {
  await db.query(
    `
      INSERT INTO showtimes (
        id, film_id, cinema_id, date, time, datetime_iso,
        version, format, experiences, week_start
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10
      )
      ON CONFLICT(id) DO UPDATE SET
        date = $4,
        time = $5,
        datetime_iso = $6,
        version = $7,
        format = $8,
        experiences = $9,
        week_start = $10
    `,
    [
      showtime.id,
      showtime.film_id,
      showtime.cinema_id,
      showtime.date,
      showtime.time,
      showtime.datetime_iso,
      showtime.version || null,
      showtime.format || null,
      JSON.stringify(showtime.experiences),
      showtime.week_start,
    ]
  );
}

// Insertion ou mise à jour d'un programme hebdomadaire
export async function upsertWeeklyProgram(db: DB, program: WeeklyProgram): Promise<void> {
  await db.query(
    `
      INSERT INTO weekly_programs (cinema_id, film_id, week_start, is_new_this_week, scraped_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT(cinema_id, film_id, week_start) DO UPDATE SET
        is_new_this_week = $4,
        scraped_at = $5
    `,
    [
      program.cinema_id,
      program.film_id,
      program.week_start,
      program.is_new_this_week ? 1 : 0,
      program.scraped_at,
    ]
  );
}

// Récupérer tous les cinémas
export async function getCinemas(db: DB): Promise<Cinema[]> {
  const result = await db.query('SELECT * FROM cinemas ORDER BY name');
  return result.rows as unknown as Cinema[];
}

// Récupérer un film par son ID
export async function getFilm(db: DB, filmId: number): Promise<Film | undefined> {
  const result = await db.query(
    'SELECT * FROM films WHERE id = $1',
    [filmId]
  );
  
  const row = result.rows[0] as any;
  if (!row) return undefined;

  return {
    ...row,
    genres: JSON.parse(row.genres || '[]'),
    actors: JSON.parse(row.actors || '[]'),
  };
}

// Récupérer les séances d'un cinéma pour une date
export async function getShowtimesByCinema(
  db: DB,
  cinemaId: string,
  date: string
): Promise<Array<Showtime & { film: Film }>> {
  const result = await db.query(
    `
      SELECT 
        s.*,
        f.id as film_id,
        f.title as film_title,
        f.original_title,
        f.poster_url,
        f.duration_minutes,
        f.release_date,
        f.rerelease_date,
        f.genres,
        f.nationality,
        f.director,
        f.actors,
        f.synopsis,
        f.certificate,
        f.press_rating,
        f.audience_rating,
        f.allocine_url
      FROM showtimes s
      JOIN films f ON s.film_id = f.id
      WHERE s.cinema_id = $1 AND s.date = $2
      ORDER BY f.title, s.time
    `,
    [cinemaId, date]
  );

  return result.rows.map((row: any) => ({
    id: row.id,
    film_id: row.film_id,
    cinema_id: row.cinema_id,
    date: row.date,
    time: row.time,
    datetime_iso: row.datetime_iso,
    version: row.version,
    format: row.format,
    experiences: JSON.parse(row.experiences || '[]'),
    week_start: row.week_start,
    film: {
      id: row.film_id,
      title: row.film_title,
      original_title: row.original_title,
      poster_url: row.poster_url,
      duration_minutes: row.duration_minutes,
      release_date: row.release_date,
      rerelease_date: row.rerelease_date,
      genres: JSON.parse(row.genres || '[]'),
      nationality: row.nationality,
      director: row.director,
      actors: JSON.parse(row.actors || '[]'),
      synopsis: row.synopsis,
      certificate: row.certificate,
      press_rating: row.press_rating,
      audience_rating: row.audience_rating,
      allocine_url: row.allocine_url,
    },
  }));
}

// Récupérer les séances d'un cinéma pour une semaine donnée
export async function getShowtimesByCinemaAndWeek(
  db: DB,
  cinemaId: string,
  weekStart: string
): Promise<Array<Showtime & { film: Film }>> {
  const result = await db.query(
    `
      SELECT 
        s.*,
        f.id as film_id,
        f.title as film_title,
        f.original_title,
        f.poster_url,
        f.duration_minutes,
        f.release_date,
        f.rerelease_date,
        f.genres,
        f.nationality,
        f.director,
        f.actors,
        f.synopsis,
        f.certificate,
        f.press_rating,
        f.audience_rating,
        f.allocine_url
      FROM showtimes s
      JOIN films f ON s.film_id = f.id
      WHERE s.cinema_id = $1 AND s.week_start = $2
      ORDER BY s.date, f.title, s.time
    `,
    [cinemaId, weekStart]
  );

  return result.rows.map((row: any) => ({
    id: row.id,
    film_id: row.film_id,
    cinema_id: row.cinema_id,
    date: row.date,
    time: row.time,
    datetime_iso: row.datetime_iso,
    version: row.version,
    format: row.format,
    experiences: JSON.parse(row.experiences || '[]'),
    week_start: row.week_start,
    film: {
      id: row.film_id,
      title: row.film_title,
      original_title: row.original_title,
      poster_url: row.poster_url,
      duration_minutes: row.duration_minutes,
      release_date: row.release_date,
      rerelease_date: row.rerelease_date,
      genres: JSON.parse(row.genres || '[]'),
      nationality: row.nationality,
      director: row.director,
      actors: JSON.parse(row.actors || '[]'),
      synopsis: row.synopsis,
      certificate: row.certificate,
      press_rating: row.press_rating,
      audience_rating: row.audience_rating,
      allocine_url: row.allocine_url,
    },
  }));
}

// Récupérer les films programmés dans la semaine en cours
export async function getWeeklyFilms(
  db: DB,
  weekStart: string
): Promise<Array<Film & { cinemas: Cinema[] }>> {
  const result = await db.query(
    `
      SELECT DISTINCT
        f.*,
        c.id as cinema_id,
        c.name as cinema_name,
        c.address as cinema_address,
        c.postal_code,
        c.city,
        c.screen_count,
        c.image_url as cinema_image_url
      FROM weekly_programs wp
      JOIN films f ON wp.film_id = f.id
      JOIN cinemas c ON wp.cinema_id = c.id
      WHERE wp.week_start = $1
      ORDER BY f.title
    `,
    [weekStart]
  );

  // Regrouper par film
  const filmsMap = new Map<number, Film & { cinemas: Cinema[] }>();

  for (const row of (result.rows as any[])) {
    if (!filmsMap.has(row.id)) {
      filmsMap.set(row.id, {
        id: row.id,
        title: row.title,
        original_title: row.original_title,
        poster_url: row.poster_url,
        duration_minutes: row.duration_minutes,
        release_date: row.release_date,
        rerelease_date: row.rerelease_date,
        genres: JSON.parse(row.genres || '[]'),
        nationality: row.nationality,
        director: row.director,
        actors: JSON.parse(row.actors || '[]'),
        synopsis: row.synopsis,
        certificate: row.certificate,
        press_rating: row.press_rating,
        audience_rating: row.audience_rating,
        allocine_url: row.allocine_url,
        cinemas: [],
      });
    }

    const film = filmsMap.get(row.id)!;
    film.cinemas.push({
      id: row.cinema_id,
      name: row.cinema_name,
      address: row.cinema_address,
      postal_code: row.postal_code,
      city: row.city,
      screen_count: row.screen_count,
      image_url: row.cinema_image_url,
    });
  }

  return Array.from(filmsMap.values());
}

// Supprimer les séances passées (optionnel, pour cleanup)
export async function deleteOldShowtimes(db: DB, beforeDate: string): Promise<void> {
  const result = await db.query(
    'DELETE FROM showtimes WHERE date < $1',
    [beforeDate]
  );
  console.log(`🗑️  Supprimé ${result.rowCount} séances avant ${beforeDate}`);
}
