import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('http-client user-agent randomization', () => {
  let fetchShowtimesJson: (cinemaId: string, date: string) => Promise<unknown>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../../../src/scraper/http-client.js');
    fetchShowtimesJson = mod.fetchShowtimesJson;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should use different User-Agents across multiple requests', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    const userAgents = new Set<string>();
    
    // Call 20 times, should see some variety if randomized
    for (let i = 0; i < 20; i++) {
      await fetchShowtimesJson('C0072', '2024-01-15');
      const lastCallHeaders = mockFetch.mock.calls[i][1].headers;
      userAgents.add(lastCallHeaders['User-Agent']);
    }

    // Currently it's static, so it should be size 1. 
    // We want it to be > 1.
    expect(userAgents.size).toBeGreaterThan(1);
  });
});
