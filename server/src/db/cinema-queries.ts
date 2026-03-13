import type { DB } from './client.js';
import type { Cinema } from '../types/scraper.js';

interface CinemaRow {
  id: string;
  name: string;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  screen_count: number | null;
  image_url: string | null;
  url: string | null;
}

// Récupérer tous les cinémas
export async function getCinemas(db: DB): Promise<Cinema[]> {
  const result = await db.query<CinemaRow>('SELECT * FROM cinemas ORDER BY name');
  
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

// Insertion ou mise à jour d'un cinéma
export async function upsertCinema(db: DB, cinema: Cinema): Promise<void> {
  await db.query(
    `
      INSERT INTO cinemas (id, name, address, postal_code, city, screen_count, image_url, url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT(id) DO UPDATE SET
        name = $2,
        address = $3,
        postal_code = $4,
        city = $5,
        screen_count = $6,
        image_url = $7,
        url = COALESCE($8, cinemas.url)
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
    ]
  );
}

// Récupérer les cinémas configurés pour le scraping (ceux avec une URL)
export async function getCinemaConfigs(db: DB): Promise<Array<{ id: string; name: string; url: string }>> {
  const result = await db.query<{ id: string; name: string; url: string }>(
    'SELECT id, name, url FROM cinemas WHERE url IS NOT NULL ORDER BY name'
  );
  return result.rows;
}

// Ajouter un nouveau cinéma
export async function addCinema(
  db: DB,
  cinema: { id: string; name: string; url: string }
): Promise<{ id: string; name: string; url: string }> {
  const result = await db.query<{ id: string; name: string; url: string }>(
    `INSERT INTO cinemas (id, name, url) VALUES ($1, $2, $3) RETURNING id, name, url`,
    [cinema.id, cinema.name, cinema.url]
  );
  return result.rows[0];
}

// Mettre à jour la configuration d'un cinéma
export async function updateCinemaConfig(
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
): Promise<Cinema | undefined> {
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
  const result = await db.query<CinemaRow>(
    `UPDATE cinemas SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
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

// Supprimer un cinéma (et ses séances via CASCADE)
export async function deleteCinema(db: DB, id: string): Promise<boolean> {
  const result = await db.query('DELETE FROM cinemas WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
