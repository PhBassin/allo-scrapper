/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import HomePage from './HomePage';
import * as clientApi from '../api/client';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from '../contexts/AuthContext';

// Mock the API client
const mockAuthContext = {
  isAuthenticated: true,
  user: { id: 1, username: 'testuser', role_id: 1, role_name: 'admin', is_system_role: true, permissions: ['cinemas:create', 'scraper:trigger'] as any[] },
  logout: vi.fn(),
  login: vi.fn(),
  isAdmin: false,
  hasPermission: vi.fn(() => true),
  token: 'mock-token',
};

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={mockAuthContext}>
        {ui}
      </AuthContext.Provider>
    </QueryClientProvider>
  );
};
vi.mock('../api/client', () => ({
  getWeeklyFilms: vi.fn(),
  getFilmsByDate: vi.fn(),
  getCinemas: vi.fn(),
  addCinema: vi.fn(),
}));

describe('HomePage', () => {
  let mockGetWeeklyFilms: ReturnType<typeof vi.fn>;
  let mockGetCinemas: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockGetWeeklyFilms = vi.fn();
    mockGetCinemas = vi.fn();

    // Re-bind mocks
    (clientApi.getWeeklyFilms as any) = mockGetWeeklyFilms;
    (clientApi.getCinemas as any) = mockGetCinemas;

    // Default successful responses
    mockGetWeeklyFilms.mockResolvedValue({ films: [], weekStart: '2023-01-01' });
    mockGetCinemas.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should load data on mount', async () => {
    renderWithClient(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockGetWeeklyFilms).toHaveBeenCalled();
      expect(mockGetCinemas).toHaveBeenCalled();
    });
  });

  it('should NOT show ScrapeProgress on the home page', async () => {
    renderWithClient(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockGetWeeklyFilms).toHaveBeenCalled();
    });

    // Scraping UI has been moved to admin — should never appear on HomePage
    expect(screen.queryByTestId('scrape-progress')).not.toBeInTheDocument();
  });

  it('should NOT show a scrape button on the home page', async () => {
    renderWithClient(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockGetWeeklyFilms).toHaveBeenCalled();
    });

    // Scraping UI has been moved to admin — no scrape button on public pages
    expect(screen.queryByTestId('scrape-all-button')).not.toBeInTheDocument();
  });
});

describe('HomePage — bouton Maintenant', () => {
  // Today is 2026-03-30 (Monday), within a week starting 2026-03-25
  const FIXED_TODAY = '2026-03-30';
  const WEEK_START = '2026-03-25';
  // Current time: 13:00 — showtimes at 12:00 are past, 14:00 is future
  const FIXED_NOW = new Date('2026-03-30T13:00:00');

  const makeFilmsResponse = () => ({
    films: [
      {
        id: 101,
        title: 'Film Passé',
        genres: [],
        actors: [],
        source_url: '',
        cinemas: [
          {
            id: 'C1',
            name: 'Cinema 1',
            address: '',
            city: 'Paris',
            showtimes: [{ id: 's1', date: FIXED_TODAY, time: '12:00', experiences: [] }],
          },
        ],
      },
      {
        id: 102,
        title: 'Film Futur',
        genres: [],
        actors: [],
        source_url: '',
        cinemas: [
          {
            id: 'C1',
            name: 'Cinema 1',
            address: '',
            city: 'Paris',
            showtimes: [{ id: 's2', date: FIXED_TODAY, time: '14:00', experiences: [] }],
          },
        ],
      },
    ],
    weekStart: WEEK_START,
    date: FIXED_TODAY,
  });

  const renderHomePage = () =>
    renderWithClient(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);
    vi.clearAllMocks();
    (clientApi.getWeeklyFilms as any).mockResolvedValue({ films: [], weekStart: WEEK_START });
    (clientApi.getCinemas as any).mockResolvedValue([]);
    (clientApi.getFilmsByDate as any).mockResolvedValue(makeFilmsResponse());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the Maintenant button in the DaySelector', async () => {
    renderHomePage();
    await waitFor(() => expect(screen.queryByRole('button', { name: /maintenant/i })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /maintenant/i })).toBeInTheDocument();
  });

  it('fetches today\'s films when Maintenant is clicked', async () => {
    renderHomePage();
    await waitFor(() => expect(screen.getByRole('button', { name: /maintenant/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /maintenant/i }));

    await waitFor(() => {
      expect(clientApi.getFilmsByDate).toHaveBeenCalledWith(FIXED_TODAY);
    });
  });

  it('hides films with only past showtimes after Maintenant click', async () => {
    renderHomePage();
    await waitFor(() => expect(screen.getByRole('button', { name: /maintenant/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /maintenant/i }));

    await waitFor(() => {
      expect(screen.getByText('Film Futur')).toBeInTheDocument();
    });
    expect(screen.queryByText('Film Passé')).not.toBeInTheDocument();
  });
});
