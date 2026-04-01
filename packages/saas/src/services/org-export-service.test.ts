import { describe, it, expect, vi } from 'vitest';
import type { PoolClient } from '../db/types.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeClient(rowsByCall: unknown[][] = [[]]): PoolClient & { query: ReturnType<typeof vi.fn> } {
  let callCount = 0;
  const query = vi.fn().mockImplementation(() => {
    const rows = rowsByCall[callCount] ?? [];
    callCount++;
    return Promise.resolve({ rows, rowCount: rows.length });
  });
  return { query, release: vi.fn() } as unknown as PoolClient & { query: ReturnType<typeof vi.fn> };
}

const CINEMA_ROW = {
  id: 'C0001',
  name: 'Cinema Alpha',
  source: 'allocine',
  created_at: '2026-01-01T00:00:00.000Z',
};

const SHOWTIME_ROW = {
  id: 1,
  cinema_id: 'C0001',
  film_id: 1,
  show_time: '2026-04-01T20:00:00Z',
};

const SETTINGS_ROW = {
  id: 1,
  site_name: 'Cinéma Test',
  color_primary: '#FECC00',
};

const ORG_INFO = {
  id: 'uuid-1',
  slug: 'cinema-test',
  name: 'Cinéma Test',
  schema_name: 'org_cinema_test',
  status: 'active' as const,
  plan: 'starter',
  trial_ends_at: null,
  created_at: new Date('2026-01-01'),
};

// ── OrgExportService ──────────────────────────────────────────────────────────

describe('OrgExportService', async () => {
  const { OrgExportService } = await import('./org-export-service.js');

  it('exportOrg returns org metadata', async () => {
    const client = makeClient([[CINEMA_ROW], [SHOWTIME_ROW], [SETTINGS_ROW]]);
    const svc = new OrgExportService(client);

    const result = await svc.exportOrg(ORG_INFO);

    expect(result.org.slug).toBe('cinema-test');
    expect(result.org.name).toBe('Cinéma Test');
  });

  it('exportOrg returns cinemas from the org schema', async () => {
    const client = makeClient([[CINEMA_ROW], [SHOWTIME_ROW], [SETTINGS_ROW]]);
    const svc = new OrgExportService(client);

    const result = await svc.exportOrg(ORG_INFO);

    expect(result.cinemas).toHaveLength(1);
    expect(result.cinemas[0]).toMatchObject({ id: 'C0001', name: 'Cinema Alpha' });
  });

  it('exportOrg returns showtimes from the org schema', async () => {
    const client = makeClient([[CINEMA_ROW], [SHOWTIME_ROW], [SETTINGS_ROW]]);
    const svc = new OrgExportService(client);

    const result = await svc.exportOrg(ORG_INFO);

    expect(result.showtimes).toHaveLength(1);
    expect(result.showtimes[0]).toMatchObject({ cinema_id: 'C0001' });
  });

  it('exportOrg returns org_settings', async () => {
    const client = makeClient([[CINEMA_ROW], [SHOWTIME_ROW], [SETTINGS_ROW]]);
    const svc = new OrgExportService(client);

    const result = await svc.exportOrg(ORG_INFO);

    expect(result.settings).toBeDefined();
    expect(result.settings.site_name).toBe('Cinéma Test');
  });

  it('exportOrg includes an exported_at ISO timestamp', async () => {
    const client = makeClient([[CINEMA_ROW], [SHOWTIME_ROW], [SETTINGS_ROW]]);
    const svc = new OrgExportService(client);

    const result = await svc.exportOrg(ORG_INFO);

    expect(result.exported_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('exportOrg returns empty arrays when org has no cinemas or showtimes', async () => {
    const client = makeClient([[], [], [SETTINGS_ROW]]);
    const svc = new OrgExportService(client);

    const result = await svc.exportOrg(ORG_INFO);

    expect(result.cinemas).toHaveLength(0);
    expect(result.showtimes).toHaveLength(0);
  });
});
