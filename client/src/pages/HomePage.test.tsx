import { render, screen, waitFor } from '@testing-library/react';
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
