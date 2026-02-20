import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Metrics module tests
// ---------------------------------------------------------------------------

describe('metrics', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('exports a registry instance', async () => {
    const { registry } = await import('../../src/utils/metrics.js');
    expect(registry).toBeDefined();
    expect(typeof registry.metrics).toBe('function');
  });

  it('exports scrape counter and duration histogram', async () => {
    const { scrapeJobsTotal, scrapeDurationSeconds } = await import('../../src/utils/metrics.js');
    expect(scrapeJobsTotal).toBeDefined();
    expect(scrapeDurationSeconds).toBeDefined();
  });

  it('scrapeJobsTotal.inc does not throw', async () => {
    const { scrapeJobsTotal } = await import('../../src/utils/metrics.js');
    expect(() => scrapeJobsTotal.inc({ status: 'success', trigger: 'manual' })).not.toThrow();
  });

  it('scrapeDurationSeconds.observe does not throw', async () => {
    const { scrapeDurationSeconds } = await import('../../src/utils/metrics.js');
    expect(() => scrapeDurationSeconds.observe({ cinema: 'test' }, 1.5)).not.toThrow();
  });

  it('filmsScrapedTotal.inc does not throw', async () => {
    const { filmsScrapedTotal } = await import('../../src/utils/metrics.js');
    expect(() => filmsScrapedTotal.inc({ cinema: 'test' }, 5)).not.toThrow();
  });

  it('showtimesScrapedTotal.inc does not throw', async () => {
    const { showtimesScrapedTotal } = await import('../../src/utils/metrics.js');
    expect(() => showtimesScrapedTotal.inc({ cinema: 'test' }, 10)).not.toThrow();
  });

  it('registry.metrics returns a string with metric names', async () => {
    const { registry } = await import('../../src/utils/metrics.js');
    const output = await registry.metrics();
    expect(typeof output).toBe('string');
    expect(output).toContain('scrape_jobs_total');
  });
});
