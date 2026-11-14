import { type DB } from './client.js';
import type { Theater, TheaterConfig } from '../types/scraper.js';

// --- Database Row Interfaces ---

interface TheaterRow {
  id: string;
  name: string;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  image_url: string | null;
  url: string | null;
  source: string | null;
}

// Insertion ou mise à jour d'un theater
export async function upsertTheater(db: DB, theater: Theater): Promise<void> {
  await db.query(
    `
      INSERT INTO theaters (id, name, address, postal_code, city, image_url, url, source)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT(id) DO UPDATE SET
        -- An empty scraped value never erases a stored one; a non-empty
        -- one always wins, including over an admin edit (see CONTEXT.md).
        name = COALESCE(NULLIF($2, ''), theaters.name),
        address = COALESCE(NULLIF($3, ''), theaters.address),
        postal_code = COALESCE(NULLIF($4, ''), theaters.postal_code),
        city = COALESCE(NULLIF($5, ''), theaters.city),
        image_url = COALESCE(NULLIF($6, ''), theaters.image_url),
        url = COALESCE($7, theaters.url),
        source = COALESCE($8, theaters.source)
    `,
    [
      theater.id,
      theater.name,
      theater.address ?? null,
      theater.postal_code ?? null,
      theater.city ?? null,
      theater.image_url ?? null,
      theater.url ?? null,
      theater.source ?? null,
    ]
  );
}

// Get all theaters from database
export async function getTheaters(db: DB): Promise<Theater[]> {
  const result = await db.query<TheaterRow>(
    'SELECT * FROM theaters ORDER BY name'
  );

  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    address: row.address ?? undefined,
    postal_code: row.postal_code ?? undefined,
    city: row.city ?? undefined,
    image_url: row.image_url ?? undefined,
    url: row.url ?? undefined,
    source: row.source ?? undefined,
  }));
}


// Get theaters configured for scraping (those with a URL)
export async function getTheaterConfigs(db: DB): Promise<Array<TheaterConfig>> {
  const result = await db.query<{ id: string; name: string; url: string; source: string }>(
    'SELECT id, name, url, source FROM theaters WHERE url IS NOT NULL ORDER BY name'
  );
  return result.rows;
}
