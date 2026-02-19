import { describe, it, expect, vi, bench } from 'vitest';
import { upsertWeeklyProgram, upsertWeeklyPrograms, type WeeklyProgram } from './queries.js';
import { type DB } from './client.js';

// Mock DB with simulated latency
const LATENCY_MS = 2; // Simulated round-trip time

const mockDb = {
  query: vi.fn().mockImplementation(async () => {
    await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
    return { rows: [], rowCount: 1 };
  }),
  end: vi.fn(),
} as unknown as DB;

// Generate test data
const generatePrograms = (count: number): WeeklyProgram[] => {
  return Array.from({ length: count }, (_, i) => ({
    cinema_id: 'C0001',
    film_id: i + 1,
    week_start: '2023-10-25',
    is_new_this_week: i % 2 === 0,
    scraped_at: new Date().toISOString(),
  }));
};

describe('Performance Benchmark: Weekly Program Insertion', () => {
  const RECORD_COUNT = 100;
  const programs = generatePrograms(RECORD_COUNT);

  it('Baseline: N+1 Loop', async () => {
    vi.clearAllMocks();
    const start = performance.now();

    for (const program of programs) {
      await upsertWeeklyProgram(mockDb, program);
    }

    const end = performance.now();
    const duration = end - start;

    console.log(`\n📊 Baseline (Loop): Inserted ${RECORD_COUNT} records in ${duration.toFixed(2)}ms`);
    console.log(`   Average per record: ${(duration / RECORD_COUNT).toFixed(2)}ms`);

    expect(mockDb.query).toHaveBeenCalledTimes(RECORD_COUNT);
  });

  it('Optimized: Batch Insert', async () => {
    vi.clearAllMocks();
    const start = performance.now();

    await upsertWeeklyPrograms(mockDb, programs);

    const end = performance.now();
    const duration = end - start;

    console.log(`\n🚀 Optimized (Batch): Inserted ${RECORD_COUNT} records in ${duration.toFixed(2)}ms`);
    console.log(`   Average per record: ${(duration / RECORD_COUNT).toFixed(2)}ms`);

    // Should be called once
    expect(mockDb.query).toHaveBeenCalledTimes(1);
  });
});
