/**
 * Behaviour tests for upsertTheater against a real PostgreSQL.
 *
 * They run only when SCRAPER_TEST_DATABASE_URL points at a database the test
 * may write to. CI sets it and starts a postgres service (.github/workflows/ci.yml).
 * Locally, for example:
 *
 *   docker run -d --rm --name pg-test -e POSTGRES_PASSWORD=x -p 55432:5432 postgres:15-alpine
 *   SCRAPER_TEST_DATABASE_URL=postgres://postgres:x@localhost:55432/postgres \
 *     npx vitest run tests/unit/db/theater-queries.pg.test.ts
 *
 * Each run works in its own throwaway schema, dropped afterwards.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import pg from 'pg';
import type { DB } from '../../../src/db/client.js';
import { upsertTheater } from '../../../src/db/theater-queries.js';

const databaseUrl = process.env.SCRAPER_TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)('upsertTheater (PostgreSQL)', () => {
  const schema = `test_theaters_${process.pid}_${Date.now()}`;
  let client: pg.Client;
  let db: DB;

  async function stored(id: string) {
    const result = await client.query('SELECT * FROM theaters WHERE id = $1', [id]);
    return result.rows[0];
  }

  beforeAll(async () => {
    client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
    // Same columns as the theaters table (docker/init.sql + migrations).
    await client.query(`
      CREATE TABLE theaters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT,
        postal_code TEXT,
        city TEXT,
        image_url TEXT,
        url TEXT,
        source TEXT DEFAULT 'allocine'
      )
    `);
    db = { query: (text: string, params?: any[]) => client.query(text, params) } as unknown as DB;
  });

  afterAll(async () => {
    await client?.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client?.end();
  });

  beforeEach(async () => {
    await client.query('TRUNCATE theaters');
    await client.query(
      `INSERT INTO theaters (id, name, address, postal_code, city, image_url, url, source)
       VALUES ('C0072', 'Typed by admin', '1 rue Admin', '75001', 'Paris', 'https://img/old.jpg', 'https://example.com/c0072', 'allocine')`
    );
  });

  it('keeps every stored value when the scraped values are empty', async () => {
    await upsertTheater(db, { id: 'C0072', name: '', address: '', postal_code: '', city: '', image_url: '' });

    expect(await stored('C0072')).toEqual({
      id: 'C0072',
      name: 'Typed by admin',
      address: '1 rue Admin',
      postal_code: '75001',
      city: 'Paris',
      image_url: 'https://img/old.jpg',
      url: 'https://example.com/c0072',
      source: 'allocine',
    });
  });

  it('keeps every stored value when the scraped values are missing', async () => {
    await upsertTheater(db, { id: 'C0072', name: '' });

    expect(await stored('C0072')).toMatchObject({
      name: 'Typed by admin',
      address: '1 rue Admin',
      postal_code: '75001',
      city: 'Paris',
      image_url: 'https://img/old.jpg',
    });
  });

  it('replaces stored values, including admin edits, with non-empty scraped values', async () => {
    await upsertTheater(db, {
      id: 'C0072',
      name: 'Le Grand Action',
      address: '5 Rue des Écoles',
      postal_code: '75005',
      city: 'Paris 5e arrondissement',
      image_url: 'https://img/new.jpg',
    });

    expect(await stored('C0072')).toMatchObject({
      name: 'Le Grand Action',
      address: '5 Rue des Écoles',
      postal_code: '75005',
      city: 'Paris 5e arrondissement',
      image_url: 'https://img/new.jpg',
      url: 'https://example.com/c0072',
    });
  });

  it('inserts a new theater even when its scraped values are empty', async () => {
    await upsertTheater(db, { id: 'W7504', name: 'Epée de bois', address: '', postal_code: '', city: '' });

    expect(await stored('W7504')).toMatchObject({ name: 'Epée de bois', address: '', postal_code: '', city: '' });
  });
});
