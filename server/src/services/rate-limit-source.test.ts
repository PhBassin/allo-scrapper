import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { DB } from '../db/index.js';

const RATE_LIMIT_ENV_KEYS = [
  'RATE_LIMIT_WINDOW_MS',
  'RATE_LIMIT_GENERAL_MAX',
  'RATE_LIMIT_AUTH_MAX',
  'RATE_LIMIT_REGISTER_MAX',
  'RATE_LIMIT_REGISTER_WINDOW_MS',
  'RATE_LIMIT_PROTECTED_MAX',
  'RATE_LIMIT_SCRAPER_MAX',
  'RATE_LIMIT_PUBLIC_MAX',
  'RATE_LIMIT_HEALTH_MAX',
  'RATE_LIMIT_HEALTH_WINDOW_MS',
] as const;

function clearRateLimitEnv(): void {
  for (const key of RATE_LIMIT_ENV_KEYS) {
    delete process.env[key];
  }
}

describe('RateLimitSource — env-loaded initial config (consolidation target)', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of RATE_LIMIT_ENV_KEYS) {
      savedEnv[key] = process.env[key];
    }
    clearRateLimitEnv();
  });

  afterEach(() => {
    for (const key of RATE_LIMIT_ENV_KEYS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
    vi.resetModules();
  });

  it('returns the built-in defaults when no env vars are set', async () => {
    vi.resetModules();
    const { getCurrentConfig } = await import('./rate-limit-source.js');

    const config = getCurrentConfig();

    expect(config).toEqual({
      windowMs: 15 * 60 * 1000,
      generalMax: 100,
      authMax: 5,
      registerMax: 3,
      registerWindowMs: 60 * 60 * 1000,
      protectedMax: 60,
      scraperMax: 10,
      publicMax: 100,
      healthMax: 10,
      healthWindowMs: 60 * 1000,
    });
  });

  it('reads RATE_LIMIT_GENERAL_MAX env var at module load', async () => {
    process.env.RATE_LIMIT_GENERAL_MAX = '250';
    vi.resetModules();
    const { getCurrentConfig } = await import('./rate-limit-source.js');

    expect(getCurrentConfig().generalMax).toBe(250);
  });

  it('reads all RATE_LIMIT_* env vars at module load', async () => {
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    process.env.RATE_LIMIT_GENERAL_MAX = '200';
    process.env.RATE_LIMIT_AUTH_MAX = '10';
    process.env.RATE_LIMIT_REGISTER_MAX = '7';
    process.env.RATE_LIMIT_REGISTER_WINDOW_MS = '1800000';
    process.env.RATE_LIMIT_PROTECTED_MAX = '80';
    process.env.RATE_LIMIT_SCRAPER_MAX = '20';
    process.env.RATE_LIMIT_PUBLIC_MAX = '300';
    process.env.RATE_LIMIT_HEALTH_MAX = '40';
    process.env.RATE_LIMIT_HEALTH_WINDOW_MS = '120000';
    vi.resetModules();
    const { getCurrentConfig } = await import('./rate-limit-source.js');

    const config = getCurrentConfig();
    expect(config.windowMs).toBe(60000);
    expect(config.generalMax).toBe(200);
    expect(config.authMax).toBe(10);
    expect(config.registerMax).toBe(7);
    expect(config.registerWindowMs).toBe(1800000);
    expect(config.protectedMax).toBe(80);
    expect(config.scraperMax).toBe(20);
    expect(config.publicMax).toBe(300);
    expect(config.healthMax).toBe(40);
    expect(config.healthWindowMs).toBe(120000);
  });

  it('falls back to default for an env var that is empty', async () => {
    process.env.RATE_LIMIT_GENERAL_MAX = '';
    vi.resetModules();
    const { getCurrentConfig } = await import('./rate-limit-source.js');

    expect(getCurrentConfig().generalMax).toBe(100);
  });
});

function makeDbRow(overrides: Partial<{
  window_ms: number;
  general_max: number;
  auth_max: number;
  register_max: number;
  register_window_ms: number;
  protected_max: number;
  scraper_max: number;
  public_max: number;
  health_max: number;
  health_window_ms: number;
  updated_at: string;
  updated_by: number | null;
  environment: string;
}> = {}) {
  return {
    window_ms: 900000,
    general_max: 100,
    auth_max: 5,
    register_max: 3,
    register_window_ms: 3600000,
    protected_max: 60,
    scraper_max: 10,
    public_max: 100,
    health_max: 10,
    health_window_ms: 60000,
    updated_at: '2026-03-25T10:00:00.000Z',
    updated_by: null,
    environment: 'production',
    ...overrides,
  };
}

function makeDb(rows: any[] | Error): DB {
  if (rows instanceof Error) {
    return {
      query: vi.fn().mockRejectedValue(rows),
    } as unknown as DB;
  }
  return {
    query: vi.fn().mockResolvedValue({ rows }),
  } as unknown as DB;
}

describe('RateLimitSource — loadFromDb (boot-time DB load with env fallback)', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of RATE_LIMIT_ENV_KEYS) {
      savedEnv[key] = process.env[key];
    }
    clearRateLimitEnv();
  });

  afterEach(() => {
    for (const key of RATE_LIMIT_ENV_KEYS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
    vi.resetModules();
  });

  it('loads config from DB when a row exists', async () => {
    vi.resetModules();
    const { loadFromDb, getCurrentConfig } = await import('./rate-limit-source.js');

    const db = makeDb([makeDbRow({ general_max: 300, auth_max: 9 })]);
    await loadFromDb(db);

    const config = getCurrentConfig();
    expect(config.generalMax).toBe(300);
    expect(config.authMax).toBe(9);
    expect(config.scraperMax).toBe(10); // rest came from DB row's defaults
  });

  it('keeps the env-derived config when DB query throws', async () => {
    process.env.RATE_LIMIT_GENERAL_MAX = '222';
    vi.resetModules();
    const { loadFromDb, getCurrentConfig } = await import('./rate-limit-source.js');

    const db = makeDb(new Error('DB unavailable'));
    await loadFromDb(db);

    expect(getCurrentConfig().generalMax).toBe(222);
  });

  it('keeps the env-derived config when DB returns no row', async () => {
    process.env.RATE_LIMIT_GENERAL_MAX = '222';
    vi.resetModules();
    const { loadFromDb, getCurrentConfig } = await import('./rate-limit-source.js');

    const db = makeDb([]);
    await loadFromDb(db);

    expect(getCurrentConfig().generalMax).toBe(222);
  });

  it('keeps the built-in defaults when DB fails and no env vars are set', async () => {
    vi.resetModules();
    const { loadFromDb, getCurrentConfig } = await import('./rate-limit-source.js');

    const db = makeDb(new Error('boom'));
    await loadFromDb(db);

    expect(getCurrentConfig().generalMax).toBe(100);
  });

  it('queries the rate_limit_configs table by id=1', async () => {
    vi.resetModules();
    const { loadFromDb } = await import('./rate-limit-source.js');

    const db = makeDb([makeDbRow()]);
    await loadFromDb(db);

    expect(db.query).toHaveBeenCalledWith('SELECT * FROM rate_limit_configs WHERE id = 1');
  });

  it('is callable repeatedly — second successful load replaces state', async () => {
    vi.resetModules();
    const { loadFromDb, getCurrentConfig } = await import('./rate-limit-source.js');

    await loadFromDb(makeDb([makeDbRow({ general_max: 100 })]));
    expect(getCurrentConfig().generalMax).toBe(100);

    await loadFromDb(makeDb([makeDbRow({ general_max: 500 })]));
    expect(getCurrentConfig().generalMax).toBe(500);
  });
});

describe('RateLimitSource — subscriber invalidation hook', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of RATE_LIMIT_ENV_KEYS) {
      savedEnv[key] = process.env[key];
    }
    clearRateLimitEnv();
  });

  afterEach(() => {
    for (const key of RATE_LIMIT_ENV_KEYS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
    vi.resetModules();
  });

  it('notifies subscribers after a successful loadFromDb', async () => {
    vi.resetModules();
    const { loadFromDb, subscribe } = await import('./rate-limit-source.js');

    const sub = vi.fn();
    subscribe(sub);

    await loadFromDb(makeDb([makeDbRow({ general_max: 321 })]));

    expect(sub).toHaveBeenCalledTimes(1);
  });

  it('does not notify subscribers when loadFromDb finds no row', async () => {
    vi.resetModules();
    const { loadFromDb, subscribe } = await import('./rate-limit-source.js');

    const sub = vi.fn();
    subscribe(sub);

    await loadFromDb(makeDb([]));

    expect(sub).not.toHaveBeenCalled();
  });

  it('does not notify subscribers when loadFromDb throws', async () => {
    vi.resetModules();
    const { loadFromDb, subscribe } = await import('./rate-limit-source.js');

    const sub = vi.fn();
    subscribe(sub);

    await loadFromDb(makeDb(new Error('boom')));

    expect(sub).not.toHaveBeenCalled();
  });

  it('returned unsubscribe function stops further notifications', async () => {
    vi.resetModules();
    const { loadFromDb, subscribe } = await import('./rate-limit-source.js');

    const sub = vi.fn();
    const unsubscribe = subscribe(sub);

    await loadFromDb(makeDb([makeDbRow({ general_max: 321 })]));
    expect(sub).toHaveBeenCalledTimes(1);

    unsubscribe();

    await loadFromDb(makeDb([makeDbRow({ general_max: 654 })]));
    expect(sub).toHaveBeenCalledTimes(1);
  });

  it('notifies all subscribers, in registration order', async () => {
    vi.resetModules();
    const { loadFromDb, subscribe } = await import('./rate-limit-source.js');

    const calls: string[] = [];
    subscribe(() => calls.push('a'));
    subscribe(() => calls.push('b'));
    subscribe(() => calls.push('c'));

    await loadFromDb(makeDb([makeDbRow({ general_max: 321 })]));

    expect(calls).toEqual(['a', 'b', 'c']);
  });

  it('isolates subscriber failures — one throwing does not break the others', async () => {
    vi.resetModules();
    const { loadFromDb, subscribe } = await import('./rate-limit-source.js');

    const calls: string[] = [];
    subscribe(() => { throw new Error('subscriber boom'); });
    subscribe(() => calls.push('survivor'));

    await expect(loadFromDb(makeDb([makeDbRow({ general_max: 321 })]))).resolves.toBe(true);
    expect(calls).toEqual(['survivor']);
  });

  it('does not notify subscribers when the DB row matches the config already loaded', async () => {
    vi.resetModules();
    const { loadFromDb, subscribe } = await import('./rate-limit-source.js');

    const sub = vi.fn();
    subscribe(sub);

    // makeDbRow() holds the built-in defaults, which is what the env-less module starts with
    await expect(loadFromDb(makeDb([makeDbRow()]))).resolves.toBe(true);

    expect(sub).not.toHaveBeenCalled();
  });

  it('does not notify subscribers again when the same row is reloaded (poller tick)', async () => {
    vi.resetModules();
    const { loadFromDb, subscribe } = await import('./rate-limit-source.js');

    const sub = vi.fn();
    subscribe(sub);

    await loadFromDb(makeDb([makeDbRow({ general_max: 321 })]));
    await loadFromDb(makeDb([makeDbRow({ general_max: 321 })]));
    await loadFromDb(makeDb([makeDbRow({ general_max: 321 })]));

    expect(sub).toHaveBeenCalledTimes(1);
  });

  it('does not notify subscribers when only the audit metadata of the row changed', async () => {
    vi.resetModules();
    const { loadFromDb, subscribe } = await import('./rate-limit-source.js');

    const sub = vi.fn();
    subscribe(sub);

    await loadFromDb(makeDb([makeDbRow({ general_max: 321 })]));
    await loadFromDb(makeDb([makeDbRow({
      general_max: 321,
      updated_at: '2026-05-01T00:00:00.000Z',
      updated_by: 7,
      environment: 'staging',
    })]));

    expect(sub).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['window_ms', 'windowMs'],
    ['general_max', 'generalMax'],
    ['auth_max', 'authMax'],
    ['register_max', 'registerMax'],
    ['register_window_ms', 'registerWindowMs'],
    ['protected_max', 'protectedMax'],
    ['scraper_max', 'scraperMax'],
    ['public_max', 'publicMax'],
    ['health_max', 'healthMax'],
    ['health_window_ms', 'healthWindowMs'],
  ] as const)('notifies subscribers again when %s changes after a load', async (column, configKey) => {
    vi.resetModules();
    const { loadFromDb, subscribe, getCurrentConfig } = await import('./rate-limit-source.js');

    const sub = vi.fn();
    subscribe(sub);

    await loadFromDb(makeDb([makeDbRow({ general_max: 321 })]));
    expect(sub).toHaveBeenCalledTimes(1);

    const changed = makeDbRow({ general_max: 321 })[column] + 1;
    await loadFromDb(makeDb([makeDbRow({ general_max: 321, [column]: changed })]));

    expect(sub).toHaveBeenCalledTimes(2);
    expect(getCurrentConfig()[configKey]).toBe(changed);
  });
});

describe('RateLimitSource — getAuditInfo (admin display only)', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of RATE_LIMIT_ENV_KEYS) {
      savedEnv[key] = process.env[key];
    }
    clearRateLimitEnv();
  });

  afterEach(() => {
    for (const key of RATE_LIMIT_ENV_KEYS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
    vi.resetModules();
  });

  it('returns the wrapped config plus audit metadata when DB row exists', async () => {
    vi.resetModules();
    const { getAuditInfo } = await import('./rate-limit-source.js');

    const db = makeDb([makeDbRow({
      general_max: 150,
      updated_at: '2026-04-01T12:00:00.000Z',
      updated_by: 7,
      environment: 'production',
    })]);
    const info = await getAuditInfo(db);

    expect(info.config.generalMax).toBe(150);
    expect(info.source).toBe('database');
    expect(info.updatedAt).toBe('2026-04-01T12:00:00.000Z');
    expect(info.updatedBy).toEqual({ id: 7, username: '' });
    expect(info.environment).toBe('production');
  });

  it('resolves username for updatedBy when one exists in users table', async () => {
    vi.resetModules();
    const { getAuditInfo } = await import('./rate-limit-source.js');

    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [makeDbRow({ updated_by: 11, environment: 'production' })] })
      .mockResolvedValueOnce({ rows: [{ username: 'alice' }] });
    const db = { query } as unknown as DB;

    const info = await getAuditInfo(db);
    expect(info.updatedBy).toEqual({ id: 11, username: 'alice' });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenNthCalledWith(2, 'SELECT username FROM users WHERE id = $1', [11]);
  });

  it('leaves updatedBy username empty when user is not found', async () => {
    vi.resetModules();
    const { getAuditInfo } = await import('./rate-limit-source.js');

    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [makeDbRow({ updated_by: 11 })] })
      .mockResolvedValueOnce({ rows: [] });
    const db = { query } as unknown as DB;

    const info = await getAuditInfo(db);
    expect(info.updatedBy).toEqual({ id: 11, username: '' });
  });

  it('keeps source as "database" when the username lookup throws', async () => {
    vi.resetModules();
    const { getAuditInfo } = await import('./rate-limit-source.js');

    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [makeDbRow({ updated_by: 11, environment: 'production' })] })
      .mockRejectedValueOnce(new Error('users table unavailable'));
    const db = { query } as unknown as DB;

    const info = await getAuditInfo(db);
    expect(info.source).toBe('database');
    expect(info.updatedBy).toEqual({ id: 11, username: '' });
    expect(info.environment).toBe('production');
  });

  it('reports source as "env" when DB has no row and at least one env var is set', async () => {
    process.env.RATE_LIMIT_GENERAL_MAX = '300';
    vi.resetModules();
    const { getAuditInfo } = await import('./rate-limit-source.js');

    const info = await getAuditInfo(makeDb([]));
    expect(info.source).toBe('env');
    expect(info.config.generalMax).toBe(300);
    expect(info.updatedAt).toBeNull();
    expect(info.updatedBy).toBeNull();
    expect(info.environment).toBeNull();
  });

  it('reports source as "default" when DB has no row and no env vars are set', async () => {
    vi.resetModules();
    const { getAuditInfo } = await import('./rate-limit-source.js');

    const info = await getAuditInfo(makeDb([]));
    expect(info.source).toBe('default');
    expect(info.config.generalMax).toBe(100);
    expect(info.updatedAt).toBeNull();
  });

  it('reports source as "database" when DB query succeeds even if values happen to match defaults', async () => {
    vi.resetModules();
    const { getAuditInfo } = await import('./rate-limit-source.js');

    const info = await getAuditInfo(makeDb([makeDbRow()]));
    expect(info.source).toBe('database');
  });

  it('does not throw when DB query fails — falls back gracefully', async () => {
    vi.resetModules();
    const { getAuditInfo } = await import('./rate-limit-source.js');

    const info = await getAuditInfo(makeDb(new Error('DB boom')));
    expect(info.source).toMatch(/^(env|default)$/);
    expect(info.config).toBeDefined();
    expect(info.updatedAt).toBeNull();
  });
});
