import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Configuration de la connexion PostgreSQL
const config = {
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'password',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'its',
};

// Si une URL de base de données est fournie (ex: format Heroku ou Docker interne), elle est prioritaire
const connectionString = process.env.DATABASE_URL;

export const pool = new pg.Pool(
  connectionString ? { connectionString } : config
);

export const db = {
  query: <T extends pg.QueryResultRow = any>(text: string, params?: any[]) => pool.query<T>(text, params),
  end: () => pool.end()
};

export type DB = typeof db;
