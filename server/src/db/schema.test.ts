import { describe, it, expect, vi, beforeEach } from 'vitest';
import { seedTheatersIfEmpty } from './schema.js';

// Mock db client
vi.mock('./internal/client.js', () => ({
  db: {
    query: vi.fn(),
  },
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { db } from './internal/client.js';
import { readFile } from 'fs/promises';

describe('seedTheatersIfEmpty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should seed theaters when the table is empty (count = 0)', async () => {
    // Arrange: empty DB
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ count: '0' }], command: '', rowCount: 0, oid: 0, fields: [] } as any) // COUNT query
      .mockResolvedValue({ rows: [], command: '', rowCount: 0, oid: 0, fields: [] } as any);                   // INSERT queries

    vi.mocked(readFile).mockResolvedValue(JSON.stringify([
      { id: 'C0001', name: 'UGC Ciné Cité', url: 'https://www.allocine.fr/salle/cinema-C0001/' },
      { id: 'C0002', name: 'Pathé Wepler', url: 'https://www.allocine.fr/salle/cinema-C0002/' },
    ]));

    // Act
    await seedTheatersIfEmpty();

    // Assert: COUNT was called first
    expect(db.query).toHaveBeenCalledWith(
      'SELECT COUNT(*) as count FROM theaters WHERE url IS NOT NULL'
    );

    // Assert: theaters.json was read
    expect(readFile).toHaveBeenCalled();

    // Assert: INSERT was called for each theater
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO theaters'),
      ['C0001', 'UGC Ciné Cité', 'https://www.allocine.fr/salle/cinema-C0001/']
    );
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO theaters'),
      ['C0002', 'Pathé Wepler', 'https://www.allocine.fr/salle/cinema-C0002/']
    );
  });

  it('should skip seeding when theaters already exist (count > 0)', async () => {
    // Arrange: DB already has theaters
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [{ count: '5' }], command: '', rowCount: 0, oid: 0, fields: [] } as any);

    // Act
    await seedTheatersIfEmpty();

    // Assert: COUNT was called
    expect(db.query).toHaveBeenCalledWith(
      'SELECT COUNT(*) as count FROM theaters WHERE url IS NOT NULL'
    );

    // Assert: readFile was NOT called (seeding skipped)
    expect(readFile).not.toHaveBeenCalled();

    // Assert: only COUNT was executed (no INSERTs)
    expect(db.query).toHaveBeenCalledTimes(1);
  });
});
