import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

const mockUpsertCinema = vi.fn().mockResolvedValue(undefined);
const mockFetchTheaterPage = vi.fn();
const mockParseTheaterPage = vi.fn();

vi.mock('../../../src/db/queries.js', () => ({
  upsertCinema: mockUpsertCinema,
  upsertFilm: vi.fn(),
  upsertShowtimes: vi.fn(),
  upsertWeeklyPrograms: vi.fn(),
  getFilm: vi.fn(),
  getCinemaConfigs: vi.fn(),
  getCinemas: vi.fn(),
}));

vi.mock('../../../src/scraper/http-client.js', () => ({
  fetchTheaterPage: mockFetchTheaterPage,
  fetchShowtimesJson: vi.fn(),
  fetchFilmPage: vi.fn(),
  delay: vi.fn(),
  closeBrowser: vi.fn(),
}));

vi.mock('../../../src/scraper/theater-parser.js', () => ({
  parseTheaterPage: mockParseTheaterPage,
}));

vi.mock('../../../src/scraper/theater-json-parser.js', () => ({
  parseShowtimesJson: vi.fn().mockReturnValue([]),
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
