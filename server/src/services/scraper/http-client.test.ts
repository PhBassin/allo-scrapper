import { describe, it, expect, vi, afterEach } from 'vitest';

// fetchTheaterPage now uses Playwright (headless browser) internally and cannot
// be easily unit-tested with a fetch mock. We test the simpler HTTP functions.

describe('fetchShowtimesJson', () => {
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
  });

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
  });
});

describe('fetchFilmPage', () => {
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
  });
});
