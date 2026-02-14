import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

export const db = createClient({
  url,
  authToken,
});

export type DB = typeof db;
