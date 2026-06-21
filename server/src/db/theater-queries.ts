// fallow-ignore-file security-sink
import type { DB } from './index.js';
import type { Theater } from '../types/scraper.js';

interface TheaterRow {
  id: string;
  name: string;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  screen_count: number | null;
  image_url: string | null;
  url: string | null;
}

// Récupérer tous les theaters
export async function getTheaters(db: DB): Promise<Theater[]> {
  const result = await db.query<TheaterRow>('SELECT * FROM theaters ORDER BY name');
  
  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    address: row.address ?? undefined,
    postal_code: row.postal_code ?? undefined,
    city: row.city ?? undefined,
    screen_count: row.screen_count ?? undefined,
    image_url: row.image_url ?? undefined,
    url: row.url ?? undefined,
  }));
}

// Insertion ou mise à jour d'un theater
export async function upsertTheater(db: DB, theater: Theater): Promise<void> {
  await db.query(
    `
      INSERT INTO theaters (id, name, address, postal_code, city, screen_count, image_url, url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT(id) DO UPDATE SET
        name = $2,
        address = $3,
        postal_code = $4,
        city = $5,
        screen_count = $6,
        image_url = $7,
        url = COALESCE($8, theaters.url)
    `,
    [
      theater.id,
      theater.name,
      theater.address ?? null,
      theater.postal_code ?? null,
      theater.city ?? null,
      theater.screen_count ?? null,
      theater.image_url ?? null,
      theater.url ?? null,
    ]
  );
}

// Récupérer les theaters configurés pour le scraping (ceux avec une URL)
export async function getTheaterConfigs(db: DB): Promise<Array<{ id: string; name: string; url: string }>> {
  const result = await db.query<{ id: string; name: string; url: string }>(
    'SELECT id, name, url FROM theaters WHERE url IS NOT NULL ORDER BY name'
  );
  return result.rows;
}

// Ajouter un nouveau theater
export async function addTheater(
  db: DB,
  theater: { id: string; name: string; url: string }
): Promise<{ id: string; name: string; url: string }> {
  const result = await db.query<{ id: string; name: string; url: string }>(
    `INSERT INTO theaters (id, name, url) VALUES ($1, $2, $3) RETURNING id, name, url`,
    [theater.id, theater.name, theater.url]
  );
  return result.rows[0];
}

// Mettre à jour la configuration d'un theater
export async function updateTheaterConfig(
  db: DB,
  id: string,
  updates: {
    name?: string;
    url?: string;
    address?: string;
    postal_code?: string;
    city?: string;
    screen_count?: number;
  }
): Promise<Theater | undefined> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.url !== undefined) {
    fields.push(`url = $${paramIndex++}`);
    values.push(updates.url);
  }
  if (updates.address !== undefined) {
    fields.push(`address = $${paramIndex++}`);
    values.push(updates.address);
  }
  if (updates.postal_code !== undefined) {
    fields.push(`postal_code = $${paramIndex++}`);
    values.push(updates.postal_code);
  }
  if (updates.city !== undefined) {
    fields.push(`city = $${paramIndex++}`);
    values.push(updates.city);
  }
  if (updates.screen_count !== undefined) {
    fields.push(`screen_count = $${paramIndex++}`);
    values.push(updates.screen_count);
  }

  values.push(id);
  const result = await db.query<TheaterRow>(
    `UPDATE theaters SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  const row = result.rows[0];
  if (!row) return undefined;

  return {
    id: row.id,
    name: row.name,
    address: row.address ?? undefined,
    postal_code: row.postal_code ?? undefined,
    city: row.city ?? undefined,
    screen_count: row.screen_count ?? undefined,
    image_url: row.image_url ?? undefined,
    url: row.url ?? undefined,
  };
}

// Supprimer un theater (et ses séances via CASCADE)
export async function deleteTheater(db: DB, id: string): Promise<boolean> {
  const result = await db.query('DELETE FROM theaters WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
