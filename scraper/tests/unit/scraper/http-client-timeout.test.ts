import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('http-client timeouts', () => {
  let fetchShowtimesJson: (cinemaId: string, date: string) => Promise<unknown>;
  let fetchFilmPage: (filmId: number) => Promise<string>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../../../src/scraper/http-client.js');
    fetchShowtimesJson = mod.fetchShowtimesJson;
    fetchFilmPage = mod.fetchFilmPage;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchShowtimesJson should include a timeout signal in fetch options', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    await fetchShowtimesJson('C0072', '2024-01-15');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        signal: expect.any(AbortSignal)
      })
    );
  });

  it('fetchFilmPage should include a timeout signal in fetch options', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('<html></html>'),
    });
    vi.stubGlobal('fetch', mockFetch);

    await fetchFilmPage(12345);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        signal: expect.any(AbortSignal)
      })
    );
  });
});
