import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

vi.mock('./client.js', () => ({
  db: {
    query: mockQuery,
  },
  pool: {},
}));

vi.mock('./migrations.js', () => ({
  runMigrations: vi.fn(),
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { seedSettingsIfEmpty } from './schema.js';

describe('seedSettingsIfEmpty', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: row exists (happy path)
    mockQuery.mockResolvedValue({ rows: [{ id: 1 }] });
  });

  it('skips insert when app_settings row already exists', async () => {
    await seedSettingsIfEmpty();

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT id FROM app_settings WHERE id = 1'
    );
  });

  it('inserts default row when app_settings is missing', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] });

    await seedSettingsIfEmpty();

    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockQuery).toHaveBeenNthCalledWith(1, 'SELECT id FROM app_settings WHERE id = 1');
    expect(mockQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO app_settings (id)')
    );
  });

  it('is idempotent — safe to call multiple times', async () => {
    await seedSettingsIfEmpty();
    expect(mockQuery).toHaveBeenCalledTimes(1);

    vi.resetAllMocks();
    mockQuery.mockResolvedValue({ rows: [{ id: 1 }] });

    await seedSettingsIfEmpty();
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('handles database errors gracefully (non-fatal)', async () => {
    mockQuery.mockRejectedValue(new Error('connection refused'));

    await expect(seedSettingsIfEmpty()).resolves.toBeUndefined();
  });
});
