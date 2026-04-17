import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

describe('org-cleanup utilities', () => {
  afterEach(() => {
    delete process.env['ALLO_E2E_ORG_REGISTRY_DIR'];
    vi.resetModules();
  });

  it('dedupes repeated org registrations in per-test cleanup', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'org-cleanup-test-'));
    process.env['ALLO_E2E_ORG_REGISTRY_DIR'] = dir;

    const mod = await import('./org-cleanup');

    await mod.registerTestOrg({ orgId: 101, orgSlug: 'e2e-test-a', testId: 't-1', workerId: '1', createdAt: Date.now() });
    await mod.registerTestOrg({ orgId: 101, orgSlug: 'e2e-test-a', testId: 't-1', workerId: '1', createdAt: Date.now() });

    let calls = 0;
    const summary = await mod.cleanupTestOrgs('t-1', '1', {
      deleteOrg: async () => {
        calls += 1;
        return { ok: true, status: 200 };
      },
    });

    expect(calls).toBe(1);
    expect(summary.deleted).toBe(1);
    expect(summary.failed).toBe(0);

    await rm(dir, { recursive: true, force: true });
  });

  it('global cleanup only deletes eligible test-prefix orgs in time window', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'org-cleanup-test-'));
    process.env['ALLO_E2E_ORG_REGISTRY_DIR'] = dir;

    const mod = await import('./org-cleanup');
    const now = Date.now();

    await mod.registerTestOrg({ orgId: 201, orgSlug: 'e2e-test-good', testId: 't-2', workerId: '2', createdAt: now - 1000 });
    await mod.registerTestOrg({ orgId: 202, orgSlug: 'prod-like-slug', testId: 't-2', workerId: '2', createdAt: now - 1000 });
    await mod.registerTestOrg({ orgId: 203, orgSlug: 'e2e-test-old', testId: 't-2', workerId: '2', createdAt: now - 10_000_000 });

    const deleted: number[] = [];
    const summary = await mod.cleanupAllTrackedOrgs({
      now,
      maxAgeMs: 60_000,
      deleteOrg: async (orgId) => {
        deleted.push(orgId);
        return { ok: true, status: 200 };
      },
    });

    expect(deleted).toEqual([201]);
    expect(summary.deleted).toBe(1);
    expect(summary.failed).toBe(0);

    await rm(dir, { recursive: true, force: true });
  });

  it('continues cleanup on partial failures and aggregates results', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'org-cleanup-test-'));
    process.env['ALLO_E2E_ORG_REGISTRY_DIR'] = dir;

    const mod = await import('./org-cleanup');

    await mod.registerTestOrg({ orgId: 301, orgSlug: 'e2e-test-1', testId: 't-3', workerId: '3', createdAt: Date.now() });
    await mod.registerTestOrg({ orgId: 302, orgSlug: 'e2e-test-2', testId: 't-3', workerId: '3', createdAt: Date.now() });
    await mod.registerTestOrg({ orgId: 303, orgSlug: 'e2e-test-3', testId: 't-3', workerId: '3', createdAt: Date.now() });

    const summary = await mod.cleanupTestOrgs('t-3', '3', {
      deleteOrg: async (orgId) => {
        if (orgId === 301) return { ok: true, status: 200 };
        if (orgId === 302) return { ok: false, status: 500 };
        return { ok: false, status: 404 };
      },
    });

    expect(summary.deleted).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.durationMs).toBeLessThan(500);

    await rm(dir, { recursive: true, force: true });
  });

  it('global cleanup removes orphaned tracked orgs across test ids', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'org-cleanup-test-'));
    process.env['ALLO_E2E_ORG_REGISTRY_DIR'] = dir;

    const mod = await import('./org-cleanup');
    const now = Date.now();

    await mod.registerTestOrg({ orgId: 401, orgSlug: 'e2e-test-orphan-a', testId: 't-4a', workerId: '4', createdAt: now - 500 });
    await mod.registerTestOrg({ orgId: 402, orgSlug: 'e2e-test-orphan-b', testId: 't-4b', workerId: '4', createdAt: now - 500 });

    const deleted: number[] = [];
    const summary = await mod.cleanupAllTrackedOrgs({
      now,
      maxAgeMs: 60_000,
      deleteOrg: async (orgId) => {
        deleted.push(orgId);
        return { ok: true, status: 200 };
      },
    });

    expect(deleted.sort((a, b) => a - b)).toEqual([401, 402]);
    expect(summary.deleted).toBe(2);
    expect(summary.failed).toBe(0);
    expect(summary.durationMs).toBeLessThan(500);

    await rm(dir, { recursive: true, force: true });
  });

  it('global cleanup continues on delete exceptions and reports aggregate failures', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'org-cleanup-test-'));
    process.env['ALLO_E2E_ORG_REGISTRY_DIR'] = dir;

    const mod = await import('./org-cleanup');
    const now = Date.now();

    await mod.registerTestOrg({ orgId: 501, orgSlug: 'e2e-test-global-a', testId: 't-5a', workerId: '5', createdAt: now - 500 });
    await mod.registerTestOrg({ orgId: 502, orgSlug: 'e2e-test-global-b', testId: 't-5b', workerId: '5', createdAt: now - 500 });
    await mod.registerTestOrg({ orgId: 503, orgSlug: 'e2e-test-global-c', testId: 't-5c', workerId: '5', createdAt: now - 500 });

    const summary = await mod.cleanupAllTrackedOrgs({
      now,
      maxAgeMs: 60_000,
      deleteOrg: async (orgId) => {
        if (orgId === 501) {
          return { ok: true, status: 200 };
        }
        if (orgId === 502) {
          throw new Error('network timeout');
        }
        return { ok: false, status: 500 };
      },
    });

    expect(summary.deleted).toBe(1);
    expect(summary.failed).toBe(2);
    expect(summary.skipped).toBe(0);
    expect(summary.durationMs).toBeLessThan(500);

    await rm(dir, { recursive: true, force: true });
  });

  it('global cleanup dedupes org ids across registry files', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'org-cleanup-test-'));
    process.env['ALLO_E2E_ORG_REGISTRY_DIR'] = dir;

    const mod = await import('./org-cleanup');
    const now = Date.now();

    await mod.registerTestOrg({ orgId: 601, orgSlug: 'e2e-test-dupe-a', testId: 't-6a', workerId: '6', createdAt: now - 500 });
    await mod.registerTestOrg({ orgId: 601, orgSlug: 'e2e-test-dupe-a', testId: 't-6b', workerId: '7', createdAt: now - 500 });

    let calls = 0;
    const summary = await mod.cleanupAllTrackedOrgs({
      now,
      maxAgeMs: 60_000,
      deleteOrg: async () => {
        calls += 1;
        return { ok: true, status: 200 };
      },
    });

    expect(calls).toBe(1);
    expect(summary.deleted).toBe(1);
    expect(summary.deduped).toBeGreaterThanOrEqual(1);

    await rm(dir, { recursive: true, force: true });
  });
});
