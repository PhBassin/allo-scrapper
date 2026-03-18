import { type DB } from './client.js';

export interface ScrapeSchedule {
  id: number;
  name: string;
  description: string | null;
  cron_expression: string;
  enabled: boolean;
  target_cinemas: string[] | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  last_run_status: string | null;
}

export interface ScrapeScheduleCreate {
  name: string;
  description?: string | null;
  cron_expression: string;
  enabled?: boolean;
  target_cinemas?: string[] | null;
}

export interface ScrapeScheduleUpdate {
  name?: string;
  description?: string | null;
  cron_expression?: string;
  enabled?: boolean;
  target_cinemas?: string[] | null;
}

function rowToSchedule(row: any): ScrapeSchedule {
  return {
    ...row,
    target_cinemas: typeof row.target_cinemas === 'string' 
      ? JSON.parse(row.target_cinemas) 
      : row.target_cinemas,
  };
}

export async function getAllSchedules(db: DB): Promise<ScrapeSchedule[]> {
  const result = await db.query(
    'SELECT * FROM scrape_schedules ORDER BY name ASC'
  );
  return result.rows.map(rowToSchedule);
}

export async function getScheduleById(db: DB, id: number): Promise<ScrapeSchedule | null> {
  const result = await db.query(
    'SELECT * FROM scrape_schedules WHERE id = $1',
    [id]
  );
  if (result.rows.length === 0) {
    return null;
  }
  return rowToSchedule(result.rows[0]);
}

export async function getEnabledSchedules(db: DB): Promise<ScrapeSchedule[]> {
  const result = await db.query(
    'SELECT * FROM scrape_schedules WHERE enabled = true ORDER BY name ASC'
  );
  return result.rows.map(rowToSchedule);
}

export async function createSchedule(
  db: DB,
  data: ScrapeScheduleCreate,
  userId: number
): Promise<ScrapeSchedule> {
  const targetCinemasJson = data.target_cinemas 
    ? JSON.stringify(data.target_cinemas) 
    : null;

  const result = await db.query(
    `INSERT INTO scrape_schedules (name, description, cron_expression, enabled, target_cinemas, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      data.name,
      data.description ?? null,
      data.cron_expression,
      data.enabled ?? true,
      targetCinemasJson,
      userId,
    ]
  );

  return rowToSchedule(result.rows[0]);
}

export async function updateSchedule(
  db: DB,
  id: number,
  data: ScrapeScheduleUpdate,
  userId: number
): Promise<ScrapeSchedule | null> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.description !== undefined) {
    fields.push(`description = $${paramIndex++}`);
    values.push(data.description);
  }
  if (data.cron_expression !== undefined) {
    fields.push(`cron_expression = $${paramIndex++}`);
    values.push(data.cron_expression);
  }
  if (data.enabled !== undefined) {
    fields.push(`enabled = $${paramIndex++}`);
    values.push(data.enabled);
  }
  if (data.target_cinemas !== undefined) {
    fields.push(`target_cinemas = $${paramIndex++}::jsonb`);
    values.push(data.target_cinemas ? JSON.stringify(data.target_cinemas) : null);
  }

  if (fields.length === 0) {
    return getScheduleById(db, id);
  }

  fields.push(`updated_by = $${paramIndex++}`);
  values.push(userId);
  values.push(id);

  const result = await db.query(
    `UPDATE scrape_schedules 
     SET ${fields.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return null;
  }

  return rowToSchedule(result.rows[0]);
}

export async function deleteSchedule(db: DB, id: number): Promise<boolean> {
  const result = await db.query(
    'DELETE FROM scrape_schedules WHERE id = $1 RETURNING id',
    [id]
  );
  return result.rows.length > 0;
}

export async function updateScheduleRunStatus(
  db: DB,
  id: number,
  status: 'success' | 'failed' | 'partial_success'
): Promise<void> {
  await db.query(
    `UPDATE scrape_schedules 
     SET last_run_at = NOW(), last_run_status = $1
     WHERE id = $2`,
    [status, id]
  );
}
