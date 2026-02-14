import { type DB } from './client.js';
import type { Cinema, Film, Showtime, WeeklyProgram } from '../scraper/types.js';

// Helper to handle parameter syntax for LibSQL
// Note: @libsql/client supports named parameters with object if the SQL uses :name or @name
// We will stick to the existing @name syntax which is compatible

// Insertion ou mise à jour d'un cinéma
export async function upsertCinema(db: DB, cinema: Cinema): Promise<void> {
  await db.execute({
    sql: `
      INSERT INTO cinemas (id, name, address, postal_code, city, screen_count, image_url)
      VALUES (:id, :name, :address, :postal_code, :city, :screen_count, :image_url)
      ON CONFLICT(id) DO UPDATE SET
        name = :name,
        address = :address,
        postal_code = :postal_code,
        city = :city,
        screen_count = :screen_count,
        image_url = :image_url
    `,
    args: {
      id: cinema.id,
      name: cinema.name,
      address: cinema.address || null,
      postal_code: cinema.postal_code || null,
      city: cinema.city || null,
      screen_count: cinema.screen_count || null,
      image_url: cinema.image_url || null,
    }
  });
}

// Insertion ou mise à jour d'un film
export async function upsertFilm(db: DB, film: Film): Promise<void> {
  await db.execute({
    sql: `
      INSERT INTO films (
        id, title, original_title, poster_url, duration_minutes,
        release_date, rerelease_date, genres, nationality, director,
        actors, synopsis, certificate, press_rating, audience_rating, allocine_url
      )
      VALUES (
        :id, :title, :original_title, :poster_url, :duration_minutes,
        :release_date, :rerelease_date, :genres, :nationality, :director,
        :actors, :synopsis, :certificate, :press_rating, :audience_rating, :allocine_url
      )
      ON CONFLICT(id) DO UPDATE SET
        title = :title,
        original_title = :original_title,
        poster_url = :poster_url,
        duration_minutes = COALESCE(:duration_minutes, duration_minutes),
        release_date = COALESCE(:release_date, release_date),
        rerelease_date = :rerelease_date,
        genres = :genres,
        nationality = :nationality,
        director = :director,
        actors = :actors,
        synopsis = :synopsis,
        certificate = :certificate,
        press_rating = :press_rating,
        audience_rating = :audience_rating,
        allocine_url = :allocine_url
    `,
    args: {
      id: film.id,
      title: film.title,
      original_title: film.original_title || null,
      poster_url: film.poster_url || null,
      duration_minutes: film.duration_minutes || null,
      release_date: film.release_date || null,
      rerelease_date: film.rerelease_date || null,
      genres: JSON.stringify(film.genres),
      nationality: film.nationality || null,
      director: film.director || null,
      actors: JSON.stringify(film.actors),
      synopsis: film.synopsis || null,
      certificate: film.certificate || null,
      press_rating: film.press_rating || null,
      audience_rating: film.audience_rating || null,
      allocine_url: film.allocine_url,
    }
  });
}

// Insertion ou mise à jour d'une séance
export async function upsertShowtime(db: DB, showtime: Showtime): Promise<void> {
  await db.execute({
    sql: `
      INSERT INTO showtimes (
        id, film_id, cinema_id, date, time, datetime_iso,
        version, format, experiences, week_start
      )
      VALUES (
        :id, :film_id, :cinema_id, :date, :time, :datetime_iso,
        :version, :format, :experiences, :week_start
      )
      ON CONFLICT(id) DO UPDATE SET
        date = :date,
        time = :time,
        datetime_iso = :datetime_iso,
        version = :version,
        format = :format,
        experiences = :experiences,
        week_start = :week_start
    `,
    args: {
      id: showtime.id,
      film_id: showtime.film_id,
      cinema_id: showtime.cinema_id,
      date: showtime.date,
      time: showtime.time,
      datetime_iso: showtime.datetime_iso,
      version: showtime.version || null,
      format: showtime.format || null,
      experiences: JSON.stringify(showtime.experiences),
      week_start: showtime.week_start,
    }
  });
}

// Insertion ou mise à jour d'un programme hebdomadaire
export async function upsertWeeklyProgram(db: DB, program: WeeklyProgram): Promise<void> {
  await db.execute({
    sql: `
      INSERT INTO weekly_programs (cinema_id, film_id, week_start, is_new_this_week, scraped_at)
      VALUES (:cinema_id, :film_id, :week_start, :is_new_this_week, :scraped_at)
      ON CONFLICT(cinema_id, film_id, week_start) DO UPDATE SET
        is_new_this_week = :is_new_this_week,
        scraped_at = :scraped_at
    `,
    args: {
      cinema_id: program.cinema_id,
      film_id: program.film_id,
      week_start: program.week_start,
      is_new_this_week: program.is_new_this_week ? 1 : 0,
      scraped_at: program.scraped_at,
    }
  });
}

// Récupérer tous les cinémas
export async function getCinemas(db: DB): Promise<Cinema[]> {
  const result = await db.execute('SELECT * FROM cinemas ORDER BY name');
  return result.rows as unknown as Cinema[];
}

// Récupérer un film par son ID
export async function getFilm(db: DB, filmId: number): Promise<Film | undefined> {
  const result = await db.execute({
    sql: 'SELECT * FROM films WHERE id = ?',
    args: [filmId]
  });
  
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
  const result = await db.execute({
    sql: `
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
      WHERE s.cinema_id = ? AND s.date = ?
      ORDER BY f.title, s.time
    `,
    args: [cinemaId, date]
  });

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
  const result = await db.execute({
    sql: `
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
      WHERE s.cinema_id = ? AND s.week_start = ?
      ORDER BY s.date, f.title, s.time
    `,
    args: [cinemaId, weekStart]
  });

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
  const result = await db.execute({
    sql: `
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
      WHERE wp.week_start = ?
      ORDER BY f.title
    `,
    args: [weekStart]
  });

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
  const result = await db.execute({
    sql: 'DELETE FROM showtimes WHERE date < ?',
    args: [beforeDate]
  });
  console.log(`🗑️  Supprimé ${result.rowsAffected} séances avant ${beforeDate}`);
}
