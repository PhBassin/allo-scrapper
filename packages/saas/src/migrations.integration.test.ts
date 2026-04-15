import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { readFileSync } from 'fs';

describe('SaaS Migrations Integration', () => {
  let pool: Pool;
  
  beforeAll(async () => {
    pool = new Pool({
      host: 'localhost',
      database: 'ics_test',
      user: 'postgres',
      password: 'postgres'
    });
  });
  
  afterAll(async () => {
    await pool.end();
  });
  
  it('should run saas_008 migration successfully', async () => {
    const sql = readFileSync('packages/saas/migrations/saas_008_create_default_ics_org.sql', 'utf-8');
    await pool.query(sql);
    
    // Verify org exists
    const orgResult = await pool.query("SELECT * FROM public.organizations WHERE slug='ics'");
    expect(orgResult.rows).toHaveLength(1);
    
    // Verify schema exists
    const schemaResult = await pool.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name='org_ics'");
    expect(schemaResult.rows).toHaveLength(1);
  });
  
  it('should be idempotent', async () => {
    const sql = readFileSync('packages/saas/migrations/saas_008_create_default_ics_org.sql', 'utf-8');
    await expect(pool.query(sql)).resolves.not.toThrow();
  });
});
