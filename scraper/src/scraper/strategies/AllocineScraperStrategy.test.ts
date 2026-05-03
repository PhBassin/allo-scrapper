import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ParserStructureError } from '../../utils/parser-errors.js';

const mocks = vi.hoisted(() => ({
  upsertShowtimes: vi.fn(),
  upsertWeeklyPrograms: vi.fn(),
  upsertFilm: vi.fn(),
  getFilm: vi.fn(),
  fetchShowtimesJson: vi.fn(),
  fetchFilmPage: vi.fn(),
  fetchTheaterPage: vi.fn(),
  delay: vi.fn(),
  parseShowtimesJson: vi.fn(),
  parseFilmPage: vi.fn(),
  upsertCinema: vi.fn(),
}));

vi.mock('../../db/cinema-queries.js', () => ({
  upsertCinema: mocks.upsertCinema,
}));

vi.mock('../../db/showtime-queries.js', () => ({
  upsertShowtimes: mocks.upsertShowtimes,
  upsertWeeklyPrograms: mocks.upsertWeeklyPrograms,
}));

vi.mock('../../db/film-queries.js', () => ({
  upsertFilm: mocks.upsertFilm,
  getFilm: mocks.getFilm,
}));

vi.mock('../http-client.js', () => ({
  fetchTheaterPage: mocks.fetchTheaterPage,
  fetchShowtimesJson: mocks.fetchShowtimesJson,
  fetchFilmPage: mocks.fetchFilmPage,
  delay: mocks.delay,
}));

vi.mock('../theater-json-parser.js', () => ({
  parseShowtimesJson: mocks.parseShowtimesJson,
}));

vi.mock('../film-parser.js', () => ({
  parseFilmPage: mocks.parseFilmPage,
}));

import {
  AllocineScraperStrategy,
  shouldRefreshFilmDetails,
} from './AllocineScraperStrategy.js';

describe('shouldRefreshFilmDetails', () => {
  it('returns true when existing film is missing', () => {
    expect(shouldRefreshFilmDetails(null)).toBe(true);
  });

  it('returns true when trailer_url is missing', () => {
    expect(
      shouldRefreshFilmDetails({
        duration_minutes: 120,
        director: 'Director',
        screenwriters: ['Writer'],
      })
    ).toBe(true);
  });

  it('returns false when all required details exist', () => {
    expect(
      shouldRefreshFilmDetails({
        duration_minutes: 120,
        director: 'Director',
        screenwriters: ['Writer'],
        trailer_url: 'https://www.allocine.fr/video/player_gen_cmedia=99&cfilm=123.html',
      })
    ).toBe(false);
  });
});

describe('AllocineScraperStrategy scrapeTheater detail refresh fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.fetchShowtimesJson.mockResolvedValue({});
    mocks.fetchTheaterPage.mockResolvedValue({
      html: '<section id="theaterpage-showtimes-index-ui"><article class="movie-card-theater"></article></section>',
      availableDates: ['2026-03-28'],
    });
    mocks.parseShowtimesJson.mockReturnValue([
      {
        film: {
          id: 123,
          title: 'Test Film',
          genres: [],
          actors: [],
          source_url: 'https://www.allocine.fr/film/fichefilm_gen_cfilm=123.html',
        },
        showtimes: [{ week_start: '2026-03-25' }],
        is_new_this_week: false,
      },
    ]);

    mocks.getFilm.mockResolvedValue({
      duration_minutes: 120,
      director: undefined,
      screenwriters: ['Existing Writer'],
      trailer_url: 'https://www.allocine.fr/video/player_gen_cmedia=99&cfilm=123.html',
    });

    mocks.fetchFilmPage.mockRejectedValue(new Error('Rate limit exceeded for film 123'));
    mocks.parseFilmPage.mockReturnValue({});

    mocks.upsertShowtimes.mockResolvedValue(undefined);
    mocks.upsertFilm.mockResolvedValue(undefined);
    mocks.upsertWeeklyPrograms.mockResolvedValue(undefined);
    mocks.upsertCinema.mockResolvedValue(undefined);
    mocks.delay.mockResolvedValue(undefined);
  });

  it('preserves existing trailer_url when film detail fetch fails', async () => {
    const strategy = new AllocineScraperStrategy();

    await strategy.scrapeTheater(
      {} as any,
      {
        id: 'C0001',
        name: 'Cinema Test',
        url: 'https://www.allocine.fr/seance/salle_gen_csalle=C0001.html',
        source: 'allocine',
      },
      '2026-03-28',
      500
    );

    expect(mocks.upsertFilm).toHaveBeenCalledTimes(1);
    const upsertedFilm = mocks.upsertFilm.mock.calls[0][1];
    expect(upsertedFilm.trailer_url).toBe(
      'https://www.allocine.fr/video/player_gen_cmedia=99&cfilm=123.html'
    );
  });

  it('applies movie delay even when film detail fetch fails', async () => {
    const strategy = new AllocineScraperStrategy();

    await strategy.scrapeTheater(
      {} as any,
      {
        id: 'C0001',
        name: 'Cinema Test',
        url: 'https://www.allocine.fr/seance/salle_gen_csalle=C0001.html',
        source: 'allocine',
      },
      '2026-03-28',
      750
    );

    expect(mocks.delay).toHaveBeenCalledWith(750);
  });

  it('rethrows parser structure failures from film detail parsing', async () => {
    const strategy = new AllocineScraperStrategy();
    mocks.fetchFilmPage.mockResolvedValue('<html><body><h1>broken</h1></body></html>');

    await expect(
      strategy.scrapeTheater(
        {} as any,
        {
          id: 'C0001',
          name: 'Cinema Test',
          url: 'https://www.allocine.fr/seance/salle_gen_csalle=C0001.html',
          source: 'allocine',
        },
        '2026-03-28',
        500
      )
    ).rejects.toThrow(ParserStructureError);

    expect(mocks.upsertFilm).not.toHaveBeenCalled();
  });

  it('fails theater metadata loading when required theater selectors are missing', async () => {
    const strategy = new AllocineScraperStrategy();
    mocks.fetchTheaterPage.mockResolvedValue({
      html: '<html><body><div>No theater page root</div></body></html>',
      availableDates: ['2026-03-28'],
    });

    await expect(
      strategy.loadTheaterMetadata(
        {} as any,
        {
          id: 'C0001',
          name: 'Cinema Test',
          url: 'https://www.allocine.fr/seance/salle_gen_csalle=C0001.html',
          source: 'allocine',
        }
      )
    ).rejects.toThrow(ParserStructureError);

    expect(mocks.upsertCinema).not.toHaveBeenCalled();
  });
});
