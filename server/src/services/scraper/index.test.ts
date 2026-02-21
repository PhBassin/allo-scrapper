import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addCinemaAndScrape } from './index.js';
import * as httpClient from './http-client.js';
import * as queries from '../../db/queries.js';
import { db } from '../../db/client.js';

// Mock http-client
vi.mock('./http-client.js', () => ({
  fetchTheaterPage: vi.fn(),
  fetchShowtimesJson: vi.fn(),
  fetchFilmPage: vi.fn(),
  delay: vi.fn(),
  closeBrowser: vi.fn(),
}));

// Mock db queries
vi.mock('../../db/queries.js', () => ({
  upsertCinema: vi.fn(),
  upsertFilm: vi.fn(),
  upsertShowtime: vi.fn(),
  upsertWeeklyPrograms: vi.fn(),
  getFilm: vi.fn(),
  getCinemaConfigs: vi.fn(),
}));

// Mock cinema-config
vi.mock('../cinema-config.js', () => ({
  syncCinemasFromDatabase: vi.fn(),
}));

describe('addCinemaAndScrape', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should preserve cinema URL when adding a cinema', async () => {
    const mockUrl = 'https://www.allocine.fr/seance/salle_gen_csalle=W7517.html';
    const mockHtml = '<html><body><div id="theaterpage-showtimes-index-ui" data-theater=\'{"name":"Club de l Etoile"}\' data-showtimes-dates="[]"></div></body></html>';
    
    vi.mocked(httpClient.fetchTheaterPage).mockResolvedValue({
      html: mockHtml,
      availableDates: [],
    });

    const cinema = await addCinemaAndScrape(mockUrl);

    // Verify that upsertCinema was called with the correct URL
    expect(queries.upsertCinema).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: 'W7517',
        name: 'Club de l Etoile',
        url: mockUrl, // This is expected to fail currently
      })
    );

    // Verify the returned cinema object also has the URL
    expect(cinema.url).toBe(mockUrl);
  });
});
