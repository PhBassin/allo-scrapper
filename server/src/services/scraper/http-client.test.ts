import { describe, it, expect, vi, afterEach } from 'vitest';

// We test that fetchTheaterPage and fetchFilmPage use the correct URLs,
// not the hardcoded placeholder www.example-cinema-site.com

describe('fetchTheaterPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch using the provided cinema base URL, not the placeholder domain', async () => {
    const capturedUrls: string[] = [];

    // Mock global fetch to capture URLs
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

    const { fetchTheaterPage } = await import('./http-client.js');

    const cinemaBaseUrl = 'https://www.allocine.fr/seance/salle_gen_csalle=W7504.html';
    await fetchTheaterPage(cinemaBaseUrl, '2026-02-19');

    expect(capturedUrls).toHaveLength(1);
    expect(capturedUrls[0]).not.toContain('example-cinema-site.com');
    expect(capturedUrls[0]).toContain('allocine.fr');
    expect(capturedUrls[0]).toContain('W7504');
    expect(capturedUrls[0]).toContain('2026-02-19');
  });

  it('should work without a date parameter', async () => {
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

    const { fetchTheaterPage } = await import('./http-client.js');

    const cinemaBaseUrl = 'https://www.allocine.fr/seance/salle_gen_csalle=C0072.html';
    await fetchTheaterPage(cinemaBaseUrl);

    expect(capturedUrls[0]).toBe(cinemaBaseUrl);
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
