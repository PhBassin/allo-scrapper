import { describe, it, expect } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('SaaS Migrations', () => {
  it('should have a migration to seed the superadmin from the admin user', async () => {
    const migrationDir = path.resolve(__dirname, '../migrations');
    const files = await fs.readdir(migrationDir);
    
    expect(files).toContain('saas_007_seed_superadmin.sql');
    
    const content = await fs.readFile(
      path.join(migrationDir, 'saas_007_seed_superadmin.sql'),
      'utf-8'
    );
    
    // Should copy 'admin' from public.users to superadmins
    expect(content).toMatch(/INSERT\s+INTO\s+superadmins/i);
    expect(content).toMatch(/FROM\s+users/i);
    expect(content).toMatch(/WHERE\s+username\s+=\s+'admin'/i);
  });
});
