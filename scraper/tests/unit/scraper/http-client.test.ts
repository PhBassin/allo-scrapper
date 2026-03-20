import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test the validation functions and URL construction logic.
// Network calls are mocked to avoid real HTTP requests.

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock puppeteer-core to avoid launching a real browser
const mockPage = {
  goto: vi.fn().mockResolvedValue(null),
  content: vi.fn().mockResolvedValue('<html></html>'),
  evaluate: vi.fn().mockResolvedValue([]),
  close: vi.fn(),
  setUserAgent: vi.fn().mockResolvedValue(undefined),
};

const mockContext = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  close: vi.fn(),
};

vi.mock('puppeteer-core', () => ({
  default: {
    launch: vi.fn().mockResolvedValue({
      isConnected: vi.fn().mockReturnValue(true),
      createBrowserContext: vi.fn().mockResolvedValue(mockContext),
      close: vi.fn(),
    }),
  },
}));

describe('http-client', () => {
  let fetchShowtimesJson: (cinemaId: string, date: string) => Promise<unknown>;
  let fetchFilmPage: (filmId: number) => Promise<string>;
  let fetchTheaterPage: (cinemaBaseUrl: string) => Promise<{ html: string; availableDates: string[] }>;
  let fetchWithRetry: (url: string, options?: RequestInit) => Promise<Response>;

  beforeEach(async () => {
    vi.resetModules();
    // Reset mock call history between tests
    mockPage.goto.mockClear();
    mockPage.content.mockClear();
    mockPage.evaluate.mockClear();
    mockPage.setUserAgent.mockClear();
    mockContext.newPage.mockClear();
    mockContext.close.mockClear();

    const mod = await import('../../../src/scraper/http-client.js');
    fetchShowtimesJson = mod.fetchShowtimesJson;
    fetchFilmPage = mod.fetchFilmPage;
    fetchTheaterPage = mod.fetchTheaterPage;
    fetchWithRetry = mod.fetchWithRetry;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // fetchWithRetry
  // -------------------------------------------------------------------------
  describe('fetchWithRetry', () => {
    it('should return response on successful fetch', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'test' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const response = await fetchWithRetry('https://example.com/api');
      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    it('should pass AbortSignal.timeout to fetch', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      vi.stubGlobal('fetch', mockFetch);

      await fetchWithRetry('https://example.com/api', {
        headers: { Accept: 'application/json' },
      });

      expect(mockFetch).toHaveBeenCalledOnce();
      const calledOptions = mockFetch.mock.calls[0][1];
      expect(calledOptions.signal).toBeDefined();
    });

    it('should retry on HTTP 429 and eventually succeed', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({}),
        });
      vi.stubGlobal('fetch', mockFetch);

      const response = await fetchWithRetry('https://example.com/api');
      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on HTTP 500 server errors', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
        });
      vi.stubGlobal('fetch', mockFetch);

      const response = await fetchWithRetry('https://example.com/api');
      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw immediately on non-retryable HTTP errors (e.g. 404)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(fetchWithRetry('https://example.com/api')).rejects.toThrow(/404/);
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    it('should throw after exhausting all retries on persistent 429', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers(),
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(fetchWithRetry('https://example.com/api')).rejects.toThrow(/429/);
      // initial + 3 retries = 4 calls
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('should respect Retry-After header (seconds)', async () => {
      const headers = new Headers({ 'Retry-After': '2' });
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
        });
      vi.stubGlobal('fetch', mockFetch);

      const start = Date.now();
      await fetchWithRetry('https://example.com/api');
      const elapsed = Date.now() - start;

      // Should have waited approximately 2 seconds
      expect(elapsed).toBeGreaterThanOrEqual(1800);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on network errors (TypeError)', async () => {
      const mockFetch = vi.fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
        });
      vi.stubGlobal('fetch', mockFetch);

      const response = await fetchWithRetry('https://example.com/api');
      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  // validateCinemaId
  // -------------------------------------------------------------------------
  describe('validateCinemaId (via fetchShowtimesJson)', () => {
    it('should accept valid cinema IDs like C0072', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(fetchShowtimesJson('C0072', '2024-01-15')).resolves.toBeDefined();
    });

    it('should accept valid cinema IDs like W7517', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(fetchShowtimesJson('W7517', '2024-01-15')).resolves.toBeDefined();
    });

    it('should reject IDs with path traversal characters (../)', async () => {
      await expect(fetchShowtimesJson('../etc/passwd', '2024-01-15')).rejects.toThrow(
        /Invalid cinema ID format/
      );
    });

    it('should reject IDs with slashes', async () => {
      await expect(fetchShowtimesJson('C0072/evil', '2024-01-15')).rejects.toThrow(
        /Invalid cinema ID format/
      );
    });

    it('should reject empty cinema ID', async () => {
      await expect(fetchShowtimesJson('', '2024-01-15')).rejects.toThrow(
        /Invalid cinema ID format/
      );
    });

    it('should reject cinema ID with lowercase letters', async () => {
      await expect(fetchShowtimesJson('c0072', '2024-01-15')).rejects.toThrow(
        /Invalid cinema ID format/
      );
    });

    it('should reject cinema ID with injection characters', async () => {
      await expect(fetchShowtimesJson('C0072;evil', '2024-01-15')).rejects.toThrow(
        /Invalid cinema ID format/
      );
    });
  });

  // -------------------------------------------------------------------------
  // validateDate
  // -------------------------------------------------------------------------
  describe('validateDate (via fetchShowtimesJson)', () => {
    it('should accept valid dates like 2024-01-15', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(fetchShowtimesJson('C0072', '2024-01-15')).resolves.toBeDefined();
    });

    it('should reject dates without dashes', async () => {
      await expect(fetchShowtimesJson('C0072', '20240115')).rejects.toThrow(
        /Invalid date format/
      );
    });

    it('should reject dates with slashes', async () => {
      await expect(fetchShowtimesJson('C0072', '2024/01/15')).rejects.toThrow(
        /Invalid date format/
      );
    });

    it('should reject empty date', async () => {
      await expect(fetchShowtimesJson('C0072', '')).rejects.toThrow(
        /Invalid date format/
      );
    });

    it('should reject dates with injection characters', async () => {
      await expect(fetchShowtimesJson('C0072', '2024-01-15; DROP TABLE')).rejects.toThrow(
        /Invalid date format/
      );
    });
  });

  // -------------------------------------------------------------------------
  // validateFilmId
  // -------------------------------------------------------------------------
  describe('validateFilmId (via fetchFilmPage)', () => {
    it('should accept positive integer film IDs', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('<html></html>'),
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(fetchFilmPage(12345)).resolves.toBeDefined();
    });

    it('should reject negative film IDs', async () => {
      await expect(fetchFilmPage(-1)).rejects.toThrow(/Invalid film ID/);
    });

    it('should reject zero as film ID', async () => {
      await expect(fetchFilmPage(0)).rejects.toThrow(/Invalid film ID/);
    });

    it('should reject NaN as film ID', async () => {
      await expect(fetchFilmPage(NaN)).rejects.toThrow(/Invalid film ID/);
    });

    it('should reject non-integer film IDs', async () => {
      await expect(fetchFilmPage(1.5)).rejects.toThrow(/Invalid film ID/);
    });
  });

  // -------------------------------------------------------------------------
  // SSRF hostname guard — fetchShowtimesJson
  // -------------------------------------------------------------------------
  describe('SSRF hostname guard in fetchShowtimesJson', () => {
    it('should use new URL() construction and call the correct allocine.fr host', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      });
      vi.stubGlobal('fetch', mockFetch);

      await fetchShowtimesJson('C0072', '2024-01-15');

      expect(mockFetch).toHaveBeenCalledOnce();
      const calledUrl: string = mockFetch.mock.calls[0][0];
      expect(calledUrl).toMatch(/^https:\/\/www\.allocine\.fr\//);
      expect(calledUrl).toContain('theater-C0072');
      expect(calledUrl).toContain('d-2024-01-15');
    });
  });

  // -------------------------------------------------------------------------
  // SSRF hostname guard — fetchFilmPage
  // -------------------------------------------------------------------------
  describe('SSRF hostname guard in fetchFilmPage', () => {
    it('should use new URL() construction and call the correct allocine.fr host', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('<html></html>'),
      });
      vi.stubGlobal('fetch', mockFetch);

      await fetchFilmPage(12345);

      expect(mockFetch).toHaveBeenCalledOnce();
      const calledUrl: string = mockFetch.mock.calls[0][0];
      expect(calledUrl).toMatch(/^https:\/\/www\.allocine\.fr\//);
      expect(calledUrl).toContain('12345');
    });
  });

  // -------------------------------------------------------------------------
  // fetchTheaterPage — Puppeteer-specific behaviour
  // -------------------------------------------------------------------------
  describe('fetchTheaterPage (Puppeteer integration)', () => {
    it('should set user agent on the page before navigation', async () => {
      await fetchTheaterPage('https://www.allocine.fr/seance/salle_gen_csalle=C0072.html');

      expect(mockPage.setUserAgent).toHaveBeenCalledOnce();
      expect(mockPage.setUserAgent).toHaveBeenCalledWith(
        expect.stringContaining('Mozilla/5.0')
      );
    });

    it('should navigate with waitUntil domcontentloaded', async () => {
      await fetchTheaterPage('https://www.allocine.fr/seance/salle_gen_csalle=C0072.html');

      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://www.allocine.fr/seance/salle_gen_csalle=C0072.html',
        expect.objectContaining({ waitUntil: 'domcontentloaded' })
      );
    });

    it('should close context after fetching', async () => {
      await fetchTheaterPage('https://www.allocine.fr/seance/salle_gen_csalle=C0072.html');

      expect(mockContext.close).toHaveBeenCalledOnce();
    });

    it('should return html and availableDates', async () => {
      mockPage.content.mockResolvedValueOnce('<html>theater page</html>');
      mockPage.evaluate.mockResolvedValueOnce(['2026-03-16', '2026-03-17']);

      const result = await fetchTheaterPage('https://www.allocine.fr/seance/salle_gen_csalle=C0072.html');

      expect(result.html).toBe('<html>theater page</html>');
      expect(result.availableDates).toEqual(['2026-03-16', '2026-03-17']);
    });
  });
});
