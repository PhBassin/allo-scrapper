import { type DB } from './client.js';
import type { Cinema } from '../types/scraper.js';

// --- Database Row Interfaces ---

export interface CinemaRow {
  id: string;
  name: string;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  screen_count: number | null;
  image_url: string | null;
  url: string | null;
  source: string | null;
}

// Insertion ou mise à jour d'un cinéma
export async function upsertCinema(db: DB, cinema: Cinema): Promise<void> {
  await db.query(
    `
      INSERT INTO cinemas (id, name, address, postal_code, city, screen_count, image_url, url, source)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT(id) DO UPDATE SET
        name = $2,
        address = $3,
        postal_code = $4,
        city = $5,
        screen_count = $6,
        image_url = $7,
        url = COALESCE($8, cinemas.url),
        source = COALESCE($9, cinemas.source)
    `,
    [
      cinema.id,
      cinema.name,
      cinema.address ?? null,
      cinema.postal_code ?? null,
      cinema.city ?? null,
      cinema.screen_count ?? null,
      cinema.image_url ?? null,
      cinema.url ?? null,
      cinema.source ?? null,
    ]
  );
}

// Get all cinemas from database
export async function getCinemas(db: DB): Promise<Cinema[]> {
  const result = await db.query<CinemaRow>(
    'SELECT * FROM cinemas ORDER BY name'
  );

  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    address: row.address ?? undefined,
    postal_code: row.postal_code ?? undefined,
    city: row.city ?? undefined,
    screen_count: row.screen_count ?? undefined,
    image_url: row.image_url ?? undefined,
    url: row.url ?? undefined,
    source: row.source ?? undefined,
  }));
}


// Get cinemas configured for scraping (those with a URL)
export async function getCinemaConfigs(db: DB): Promise<Array<CinemaConfig>> {
  const result = await db.query<{ id: string; name: string; url: string; source: string }>(
    'SELECT id, name, url, source FROM cinemas WHERE url IS NOT NULL ORDER BY name'
  );
  return result.rows;
}
