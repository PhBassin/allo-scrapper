import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

// fetchTheaterPage now uses Playwright (headless browser) internally and cannot
// be easily unit-tested with a fetch mock. We test the simpler HTTP functions.

describe('fetchShowtimesJson', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call the correct Allociné internal API URL', async () => {
    const capturedUrls: string[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        capturedUrls.push(url);
        return {
          ok: true,
          json: async () => ({ error: false, results: [] }),
        } as unknown as Response;
      })
    );

    const { fetchShowtimesJson } = await import('./http-client.js');

    await fetchShowtimesJson('C0072', '2026-02-22');

    expect(capturedUrls).toHaveLength(1);
    expect(capturedUrls[0]).toContain('allocine.fr');
    expect(capturedUrls[0]).toContain('C0072');
    expect(capturedUrls[0]).toContain('2026-02-22');
    expect(capturedUrls[0]).not.toContain('example-cinema-site.com');
  }, 15000);

  it('should throw on non-OK response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }) as unknown as Response)
    );

    const { fetchShowtimesJson } = await import('./http-client.js');

    await expect(fetchShowtimesJson('C9999', '2026-02-22')).rejects.toThrow('404');
  }, 15000);
});

describe('fetchFilmPage', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch film page from allocine.fr, not the placeholder domain', async () => {
    const capturedUrls: string[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        capturedUrls.push(url);
        return {
          ok: true,
          text: async () => '<html></html>',
        } as unknown as Response;
      })
    );

    const { fetchFilmPage } = await import('./http-client.js');

    await fetchFilmPage(12345);

    expect(capturedUrls).toHaveLength(1);
    expect(capturedUrls[0]).not.toContain('example-cinema-site.com');
    expect(capturedUrls[0]).toContain('allocine.fr');
    expect(capturedUrls[0]).toContain('12345');
  }, 15000);
});

describe('Input validation (SSRF prevention)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('cinema ID validation', () => {
    it('should reject cinema ID with path traversal attempt', async () => {
      const { fetchShowtimesJson } = await import('./http-client.js');
      await expect(fetchShowtimesJson('../../etc/passwd', '2026-03-01')).rejects.toThrow('Invalid cinema ID format');
    });

    it('should reject cinema ID with special characters', async () => {
      const { fetchShowtimesJson } = await import('./http-client.js');
      await expect(fetchShowtimesJson('C00<script>', '2026-03-01')).rejects.toThrow('Invalid cinema ID format');
    });

    it('should reject cinema ID with lowercase letters', async () => {
      const { fetchShowtimesJson } = await import('./http-client.js');
      await expect(fetchShowtimesJson('c0072', '2026-03-01')).rejects.toThrow('Invalid cinema ID format');
    });

    it('should accept valid cinema ID formats', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) }) as unknown as Response));
      const { fetchShowtimesJson } = await import('./http-client.js');
      
      await expect(fetchShowtimesJson('C0072', '2026-03-01')).resolves.not.toThrow();
      await expect(fetchShowtimesJson('W7517', '2026-03-01')).resolves.not.toThrow();
      await expect(fetchShowtimesJson('P12345', '2026-03-01')).resolves.not.toThrow();
    });
  });

  describe('date validation', () => {
    it('should reject invalid date format', async () => {
      const { fetchShowtimesJson } = await import('./http-client.js');
      await expect(fetchShowtimesJson('C0072', 'invalid-date')).rejects.toThrow('Invalid date format');
    });

    it('should reject SQL injection attempt in date', async () => {
      const { fetchShowtimesJson } = await import('./http-client.js');
      await expect(fetchShowtimesJson('C0072', "2026-03-01'; DROP TABLE--")).rejects.toThrow('Invalid date format');
    });

    it('should reject invalid calendar date', async () => {
      const { fetchShowtimesJson } = await import('./http-client.js');
      await expect(fetchShowtimesJson('C0072', '2026-13-45')).rejects.toThrow('Invalid date');
    });

    it('should accept valid date formats', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) }) as unknown as Response));
      const { fetchShowtimesJson } = await import('./http-client.js');
      
      await expect(fetchShowtimesJson('C0072', '2026-03-01')).resolves.not.toThrow();
      await expect(fetchShowtimesJson('C0072', '2026-12-31')).resolves.not.toThrow();
    });
  });

  describe('film ID validation', () => {
    it('should reject negative film ID', async () => {
      const { fetchFilmPage } = await import('./http-client.js');
      await expect(fetchFilmPage(-1)).rejects.toThrow('Invalid film ID');
    });

    it('should reject zero film ID', async () => {
      const { fetchFilmPage } = await import('./http-client.js');
      await expect(fetchFilmPage(0)).rejects.toThrow('Invalid film ID');
    });

    it('should reject non-integer film ID', async () => {
      const { fetchFilmPage } = await import('./http-client.js');
      await expect(fetchFilmPage(12.34)).rejects.toThrow('Invalid film ID');
    });

    it('should accept valid positive film IDs', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => '<html></html>' }) as unknown as Response));
      const { fetchFilmPage } = await import('./http-client.js');
      
      await expect(fetchFilmPage(1)).resolves.not.toThrow();
      await expect(fetchFilmPage(12345)).resolves.not.toThrow();
      await expect(fetchFilmPage(999999)).resolves.not.toThrow();
    });
  });
});
