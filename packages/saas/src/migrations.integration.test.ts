/**
 * Integration tests for SaaS migration files.
 * 
 * These tests run actual migrations against a test PostgreSQL database
 * to verify SQL syntax correctness and expected schema state.
 * 
 * Prerequisites:
 * - PostgreSQL test database running (docker-compose up -d ics-db)
 * - Test database created: CREATE DATABASE ics_test
 * 
 * Environment variables (optional):
 * - TEST_DB_HOST (default: localhost)
 * - TEST_DB_PORT (default: 5432)
 * - TEST_DB_NAME (default: ics_test)
 * - TEST_DB_USER (default: postgres)
 * - TEST_DB_PASSWORD (default: postgres)
 * - RUN_INTEGRATION_TESTS=1 (required to enable tests)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Skip integration tests unless explicitly enabled
const shouldRun = process.env.RUN_INTEGRATION_TESTS === '1';

describe.skipIf(!shouldRun)('SaaS Migrations Integration', () => {
  let pool: pg.Pool;
  
  beforeAll(async () => {
    pool = new Pool({
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5432', 10),
      database: process.env.TEST_DB_NAME || 'ics_test',
      user: process.env.TEST_DB_USER || 'postgres',
      password: process.env.TEST_DB_PASSWORD || 'postgres',
    });
    
    // Verify connection
    await pool.query('SELECT 1');
    
    // Clean up test database
    await pool.query('DROP SCHEMA IF EXISTS org_ics CASCADE');
    await pool.query('DELETE FROM organizations WHERE slug = $1', ['ics']);
  });
  
  afterAll(async () => {
    // Clean up test data
    await pool.query('DROP SCHEMA IF EXISTS org_ics CASCADE');
    await pool.query('DELETE FROM organizations WHERE slug = $1', ['ics']);
    await pool.end();
  });
  
  describe('saas_008_create_default_ics_org', () => {
    it('should create ICS organization successfully', async () => {
      const sql = readFileSync(
        path.join(__dirname, './migrations/saas_008_create_default_ics_org.sql'),
        'utf-8'
      );
      
      await pool.query(sql);
      
      // Verify org exists
      const orgResult = await pool.query(
        "SELECT * FROM organizations WHERE slug = 'ics'"
      );
      expect(orgResult.rows).toHaveLength(1);
      expect(orgResult.rows[0].name).toBe('Internal Cinema System');
      expect(orgResult.rows[0].slug).toBe('ics');
      
      // Verify schema exists
      const schemaResult = await pool.query(
        "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'org_ics'"
      );
      expect(schemaResult.rows).toHaveLength(1);
      
      // Verify roles table exists and is populated
      const rolesResult = await pool.query(
        "SELECT * FROM org_ics.roles ORDER BY name"
      );
      expect(rolesResult.rows.length).toBeGreaterThanOrEqual(3);
      const roleNames = rolesResult.rows.map((r: any) => r.name);
      expect(roleNames).toContain('admin');
      expect(roleNames).toContain('editor');
      expect(roleNames).toContain('viewer');
      
      // Verify admin user associated
      const userResult = await pool.query(
        "SELECT * FROM org_ics.users"
      );
      expect(userResult.rows.length).toBeGreaterThan(0);
      
      // Verify quota initialized
      const quotaResult = await pool.query(
        "SELECT * FROM org_ics.api_usage_quota"
      );
      expect(quotaResult.rows).toHaveLength(1);
      expect(quotaResult.rows[0].requests_used).toBe(0);
    });
    
    it('should be idempotent (safe to re-run)', async () => {
      const sql = readFileSync(
        path.join(__dirname, './migrations/saas_008_create_default_ics_org.sql'),
        'utf-8'
      );
      
      // Should not throw on second run
      await expect(pool.query(sql)).resolves.not.toThrow();
      
      // Verify org still exists (not duplicated)
      const orgResult = await pool.query(
        "SELECT * FROM organizations WHERE slug = 'ics'"
      );
      expect(orgResult.rows).toHaveLength(1);
    });
    
    it('should migrate data from public schema to org_ics schema', async () => {
      // Verify cinemas migrated
      const cinemasResult = await pool.query(
        "SELECT COUNT(*) FROM org_ics.cinemas"
      );
      const cinemaCount = parseInt(cinemasResult.rows[0].count, 10);
      
      // Should match public schema (if any data existed)
      const publicCinemasResult = await pool.query(
        "SELECT COUNT(*) FROM public.cinemas"
      );
      const publicCinemaCount = parseInt(publicCinemasResult.rows[0].count, 10);
      
      expect(cinemaCount).toBe(publicCinemaCount);
      
      // Verify films migrated
      const filmsResult = await pool.query(
        "SELECT COUNT(*) FROM org_ics.films"
      );
      const filmCount = parseInt(filmsResult.rows[0].count, 10);
      
      const publicFilmsResult = await pool.query(
        "SELECT COUNT(*) FROM public.films"
      );
      const publicFilmCount = parseInt(publicFilmsResult.rows[0].count, 10);
      
      expect(filmCount).toBe(publicFilmCount);
    });
  });
  
  describe('saas_009_fix_org_settings_fk_cascade', () => {
    it('should add ON DELETE SET NULL to org_settings.updated_by FK', async () => {
      const sql = readFileSync(
        path.join(__dirname, './migrations/saas_009_fix_org_settings_fk_cascade.sql'),
        'utf-8'
      );
      
      await pool.query(sql);
      
      // Verify FK constraint exists with ON DELETE SET NULL
      const fkResult = await pool.query(`
        SELECT
          con.conname,
          con.confdeltype
        FROM pg_constraint con
        JOIN pg_namespace nsp ON nsp.oid = con.connamespace
        WHERE nsp.nspname = 'org_ics'
          AND con.conrelid = 'org_ics.org_settings'::regclass
          AND con.contype = 'f'
          AND con.conkey @> ARRAY[(
            SELECT attnum 
            FROM pg_attribute 
            WHERE attrelid = 'org_ics.org_settings'::regclass 
              AND attname = 'updated_by'
          )]
      `);
      
      expect(fkResult.rows).toHaveLength(1);
      expect(fkResult.rows[0].confdeltype).toBe('n'); // 'n' = SET NULL
    });
    
    it('should be idempotent (safe to re-run)', async () => {
      const sql = readFileSync(
        path.join(__dirname, './migrations/saas_009_fix_org_settings_fk_cascade.sql'),
        'utf-8'
      );
      
      // Should not throw on second run
      await expect(pool.query(sql)).resolves.not.toThrow();
    });
  });
  
  describe('saas_010_add_fk_indexes', () => {
    it('should add indexes to all FK columns', async () => {
      const sql = readFileSync(
        path.join(__dirname, './migrations/saas_010_add_fk_indexes.sql'),
        'utf-8'
      );
      
      await pool.query(sql);
      
      // Verify indexes exist
      const indexResult = await pool.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'org_ics'
          AND indexname IN (
            'idx_users_role_id',
            'idx_invitations_role_id',
            'idx_invitations_created_by',
            'idx_org_settings_updated_by'
          )
        ORDER BY indexname
      `);
      
      expect(indexResult.rows).toHaveLength(4);
      expect(indexResult.rows.map((r: any) => r.indexname)).toEqual([
        'idx_invitations_created_by',
        'idx_invitations_role_id',
        'idx_org_settings_updated_by',
        'idx_users_role_id',
      ]);
    });
    
    it('should be idempotent (safe to re-run)', async () => {
      const sql = readFileSync(
        path.join(__dirname, './migrations/saas_010_add_fk_indexes.sql'),
        'utf-8'
      );
      
      // Should not throw on second run
      await expect(pool.query(sql)).resolves.not.toThrow();
      
      // Verify indexes still exist (not duplicated)
      const indexResult = await pool.query(`
        SELECT COUNT(*) FROM pg_indexes
        WHERE schemaname = 'org_ics'
          AND indexname IN (
            'idx_users_role_id',
            'idx_invitations_role_id',
            'idx_invitations_created_by',
            'idx_org_settings_updated_by'
          )
      `);
      
      expect(parseInt(indexResult.rows[0].count, 10)).toBe(4);
    });
  });
});

// Informational test that always runs
describe('Integration Tests Setup', () => {
  it('should inform about integration test requirements', () => {
    if (!shouldRun) {
      console.log('\n⚠️  Integration tests skipped. To enable:');
      console.log('   1. Start database: docker-compose up -d ics-db');
      console.log('   2. Create test DB: docker-compose exec ics-db psql -U postgres -c "CREATE DATABASE ics_test"');
      console.log('   3. Run with: RUN_INTEGRATION_TESTS=1 npm test -- migrations.integration.test.ts\n');
    }
    expect(true).toBe(true);
  });
});
