import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

const mockUpsertCinema = vi.fn().mockResolvedValue(undefined);
const mockFetchTheaterPage = vi.fn();
const mockFetchShowtimesJson = vi.fn();
const mockParseTheaterPage = vi.fn();
const mockParseShowtimesJson = vi.fn().mockReturnValue([]);

vi.mock('../../../src/db/film-queries.js', () => ({
  upsertFilm: vi.fn(),
  getFilm: vi.fn(),
}));

vi.mock('../../../src/db/showtime-queries.js', () => ({
  upsertShowtimes: vi.fn(),
  upsertWeeklyPrograms: vi.fn(),
}));

vi.mock('../../../src/db/cinema-queries.js', () => ({
  upsertCinema: (...args: any[]) => mockUpsertCinema(...args),
  getCinemas: vi.fn(),
  getCinemaConfigs: vi.fn(),
}));

vi.mock('../../../src/scraper/http-client.js', () => ({
  fetchTheaterPage: mockFetchTheaterPage,
  fetchShowtimesJson: mockFetchShowtimesJson,
  fetchFilmPage: vi.fn(),
  delay: vi.fn(),
  closeBrowser: vi.fn(),
}));

vi.mock('../../../src/scraper/theater-parser.js', () => ({
  parseTheaterPage: mockParseTheaterPage,
}));

vi.mock('../../../src/scraper/theater-json-parser.js', () => ({
  parseShowtimesJson: mockParseShowtimesJson,
}));

vi.mock('../../../src/scraper/film-parser.js', () => ({
  parseFilmPage: vi.fn(),
}));

vi.mock('../../../src/db/client.js', () => ({
  db: {},
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/utils/date.js', () => ({
  getScrapeDates: vi.fn().mockReturnValue([]),
  getWeekStartForDate: vi.fn().mockReturnValue('2026-03-09'),
}));

// --- Tests ---

describe('loadTheaterMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves the cinema URL from the config when upserting', async () => {
    const cinemaConfig = {
      id: 'C0072',
      name: 'Test Cinema',
      url: 'https://www.allocine.fr/seance/salle_gen_csalle=C0072.html',
    };

    const parsedCinema = {
      id: 'C0072',
      name: 'Test Cinema From HTML',
      address: '1 rue de la Paix',
      city: 'Paris',
      // url is NOT present — parser does not extract it
    };

    mockFetchTheaterPage.mockResolvedValue({
      html: '<html></html>',
      availableDates: ['2026-03-10'],
    });

    mockParseTheaterPage.mockReturnValue({
      cinema: parsedCinema,
      films: [],
    });

    // Dynamically import to pick up mocks
    const { loadTheaterMetadata } = await import('../../../src/scraper/index.js');

    await loadTheaterMetadata({} as any, cinemaConfig);

    // upsertCinema must be called with the URL merged in from the config
    expect(mockUpsertCinema).toHaveBeenCalledOnce();
    const upsertedCinema = mockUpsertCinema.mock.calls[0][1];
    expect(upsertedCinema.url).toBe(cinemaConfig.url);
  });

  it('returns the merged cinema object (with url) not just the parsed cinema', async () => {
    const cinemaConfig = {
      id: 'C0072',
      name: 'Test Cinema',
      url: 'https://www.allocine.fr/seance/salle_gen_csalle=C0072.html',
    };

    const parsedCinema = {
      id: 'C0072',
      name: 'Test Cinema From HTML',
    };

    mockFetchTheaterPage.mockResolvedValue({
      html: '<html></html>',
      availableDates: ['2026-03-10', '2026-03-11'],
    });

    mockParseTheaterPage.mockReturnValue({
      cinema: parsedCinema,
      films: [],
    });

    const { loadTheaterMetadata } = await import('../../../src/scraper/index.js');

    const result = await loadTheaterMetadata({} as any, cinemaConfig);

    expect(result.cinema.url).toBe(cinemaConfig.url);
    expect(result.availableDates).toEqual(['2026-03-10', '2026-03-11']);
  });
});

describe('addCinemaAndScrape', () => {
  const VALID_URL = 'https://www.allocine.fr/seance/salle_gen_csalle=C0072.html';

  const parsedCinema = {
    id: 'C0072',
    name: 'Cinéma Test',
    address: '1 rue de la Paix',
    city: 'Paris',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchTheaterPage.mockResolvedValue({
      html: '<html></html>',
      availableDates: [],
    });
    mockParseTheaterPage.mockReturnValue({ cinema: parsedCinema, films: [] });
    mockFetchShowtimesJson.mockResolvedValue({});
    mockParseShowtimesJson.mockReturnValue([]);
  });

  it('should reject invalid Allociné URLs', async () => {
    const { addCinemaAndScrape } = await import('../../../src/scraper/index.js');

    await expect(addCinemaAndScrape({} as any, 'not-a-url')).rejects.toThrow(
      /invalid allociné url/i
    );
    await expect(addCinemaAndScrape({} as any, 'https://www.google.com/path')).rejects.toThrow(
      /invalid allociné url/i
    );
  });

  it('should reject URLs from non-allocine domains', async () => {
    const { addCinemaAndScrape } = await import('../../../src/scraper/index.js');

    await expect(
      addCinemaAndScrape({} as any, 'https://evil.com/seance/salle_gen_csalle=C0072.html')
    ).rejects.toThrow(/invalid allociné url/i);
  });

  it('should reject valid-looking URLs without a cinema ID', async () => {
    const { addCinemaAndScrape } = await import('../../../src/scraper/index.js');

    await expect(
      addCinemaAndScrape({} as any, 'https://www.allocine.fr/seance/salle_gen_csalle=.html')
    ).rejects.toThrow(/cinema id/i);
  });

  it('should call loadTheaterMetadata with cleaned URL and extracted cinema ID', async () => {
    const { addCinemaAndScrape } = await import('../../../src/scraper/index.js');

    const dirtyUrl = 'https://www.allocine.fr/seance/salle_gen_csalle=C0072.html?utm_source=test';

    await addCinemaAndScrape({} as any, dirtyUrl);

    expect(mockFetchTheaterPage).toHaveBeenCalledOnce();
    const calledUrl: string = mockFetchTheaterPage.mock.calls[0][0];
    // URL should be cleaned (no query params)
    expect(calledUrl).not.toContain('utm_source');
    expect(calledUrl).toContain('C0072');
  });

  it('should scrape all available dates', async () => {
    const { addCinemaAndScrape } = await import('../../../src/scraper/index.js');

    mockFetchTheaterPage.mockResolvedValue({
      html: '<html></html>',
      availableDates: ['2026-03-10', '2026-03-11', '2026-03-12'],
    });

    await addCinemaAndScrape({} as any, VALID_URL);

    // fetchShowtimesJson called once per date
    expect(mockFetchShowtimesJson).toHaveBeenCalledTimes(3);
  });

  it('should return the upserted cinema data with URL', async () => {
    const { addCinemaAndScrape } = await import('../../../src/scraper/index.js');

    const result = await addCinemaAndScrape({} as any, VALID_URL);

    expect(result).toMatchObject({ id: 'C0072', name: 'Cinéma Test' });
    expect(result.url).toBe(VALID_URL);
  });

  it('should emit progress events when publisher provided', async () => {
    const { addCinemaAndScrape } = await import('../../../src/scraper/index.js');

    mockFetchTheaterPage.mockResolvedValue({
      html: '<html></html>',
      availableDates: ['2026-03-10'],
    });

    const mockPublisher = { emit: vi.fn().mockResolvedValue(undefined) };

    await addCinemaAndScrape({} as any, VALID_URL, mockPublisher);

    expect(mockPublisher.emit).toHaveBeenCalled();
  });

  it('should continue scraping remaining dates even if one date fails', async () => {
    const { addCinemaAndScrape } = await import('../../../src/scraper/index.js');

    mockFetchTheaterPage.mockResolvedValue({
      html: '<html></html>',
      availableDates: ['2026-03-10', '2026-03-11'],
    });

    // First date fails, second succeeds
    mockFetchShowtimesJson
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({});

    // Should not throw — errors on individual dates are swallowed
    await expect(addCinemaAndScrape({} as any, VALID_URL)).resolves.toBeDefined();
    expect(mockFetchShowtimesJson).toHaveBeenCalledTimes(2);
  });
});
