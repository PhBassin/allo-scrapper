/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest';
import CinemaPage from './CinemaPage';
import * as clientApi from '../api/client';
import type { Cinema } from '../types';

vi.mock('../api/client', () => ({
  getCinemas: vi.fn(),
  getCinemaSchedule: vi.fn(),
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from '../contexts/AuthContext';

const mockAuthContext = {
  isAuthenticated: true,
  user: { id: 1, username: 'testuser', role_id: 1, role_name: 'admin', is_system_role: true, permissions: ['cinemas:create', 'scraper:trigger'] as any[] },
  logout: vi.fn(),
  login: vi.fn(),
  isAdmin: false,
  isSuperadmin: false,
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

describe('CinemaPage - renders cinema details', () => {
  const mockCinema: Cinema = {
    id: 'C0153',
    name: 'UGC Test',
    city: 'Paris',
    address: '1 rue Test',
    postal_code: '75001',
    screen_count: 10,
  };

  const mockSchedule = { showtimes: [], weekStart: '2026-02-23' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clientApi.getCinemas).mockResolvedValue([mockCinema]);
    vi.mocked(clientApi.getCinemaSchedule).mockResolvedValue(mockSchedule);
  });

  it('renders the cinema name heading', async () => {
    renderWithClient(
      <MemoryRouter initialEntries={['/cinema/C0153']}>
        <Routes>
          <Route path="/cinema/:id" element={<CinemaPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: 'UGC Test' });
    expect(screen.getByRole('heading', { name: 'UGC Test' })).toBeInTheDocument();
  });

  it('does NOT render a scrape button (scraping moved to admin)', async () => {
    renderWithClient(
      <MemoryRouter initialEntries={['/cinema/C0153']}>
        <Routes>
          <Route path="/cinema/:id" element={<CinemaPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: 'UGC Test' });

    // Scraping controls have been moved to admin CinemasPage
    expect(screen.queryByText(/Scraper uniquement ce cinéma/i)).not.toBeInTheDocument();
  });

  it('calls getCinemas and getCinemaSchedule on mount', async () => {
    renderWithClient(
      <MemoryRouter initialEntries={['/cinema/C0153']}>
        <Routes>
          <Route path="/cinema/:id" element={<CinemaPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: 'UGC Test' });

    expect(clientApi.getCinemas).toHaveBeenCalledTimes(1);
    expect(clientApi.getCinemaSchedule).toHaveBeenCalledWith('C0153');
  });

  it('shows error message when cinema is not found', async () => {
    vi.mocked(clientApi.getCinemas).mockResolvedValue([]);

    renderWithClient(
      <MemoryRouter initialEntries={['/cinema/C0153']}>
        <Routes>
          <Route path="/cinema/:id" element={<CinemaPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Cinema not found/i)).toBeInTheDocument();
    });
  });

  it('shows first available showtimes when no showtimes exist for today', async () => {
    vi.mocked(clientApi.getCinemaSchedule).mockResolvedValue({
      weekStart: '2026-02-23',
      showtimes: [
        {
          id: 'st-1',
          film_id: 101,
          cinema_id: 'C0153',
          date: '2026-02-24',
          time: '14:30',
          datetime_iso: '2026-02-24T14:30:00.000Z',
          version: 'VF',
          format: '2D',
          experiences: [],
          week_start: '2026-02-23',
          film: {
            id: 101,
            title: 'Film Test',
            genres: ['Drame'],
            actors: ['Acteur Test'],
            source_url: 'https://www.allocine.fr/film/fichefilm_gen_cfilm=101.html',
          },
        },
      ],
    });

    renderWithClient(
      <MemoryRouter initialEntries={['/cinema/C0153']}>
        <Routes>
          <Route path="/cinema/:id" element={<CinemaPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Film Test')).toBeInTheDocument();
    expect(screen.getByText('14:30')).toBeInTheDocument();
    expect(screen.queryByText(/Aucune séance programmée ce jour-là/i)).not.toBeInTheDocument();
  });
});

describe('CinemaPage — bouton Maintenant', () => {
  const FIXED_TODAY = '2026-03-30';
  // Current time set to 13:00 so that showtimes at 12:00 are past and 14:00 is future
  const FIXED_NOW = new Date('2026-03-30T13:00:00');

  const mockCinema: Cinema = {
    id: 'C0153',
    name: 'UGC Test',
    city: 'Paris',
    address: '1 rue Test',
    postal_code: '75001',
    screen_count: 10,
  };

  const makeSchedule = () => ({
    weekStart: '2026-03-25',
    showtimes: [
      {
        id: 'st-past',
        film_id: 101,
        cinema_id: 'C0153',
        date: FIXED_TODAY,
        time: '12:00',
        datetime_iso: `${FIXED_TODAY}T12:00:00.000Z`,
        version: 'VF',
        format: '2D',
        experiences: [],
        week_start: '2026-03-25',
        film: { id: 101, title: 'Film Passé', genres: [], actors: [], source_url: '' },
      },
      {
        id: 'st-future',
        film_id: 102,
        cinema_id: 'C0153',
        date: FIXED_TODAY,
        time: '14:00',
        datetime_iso: `${FIXED_TODAY}T14:00:00.000Z`,
        version: 'VF',
        format: '2D',
        experiences: [],
        week_start: '2026-03-25',
        film: { id: 102, title: 'Film Futur', genres: [], actors: [], source_url: '' },
      },
    ],
  });

  beforeEach(() => {
    // Only fake the Date object — faking all timers would block React Query's async internals
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);
    vi.clearAllMocks();
    vi.mocked(clientApi.getCinemas).mockResolvedValue([mockCinema]);
    vi.mocked(clientApi.getCinemaSchedule).mockResolvedValue(makeSchedule());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderCinemaPage = () =>
    renderWithClient(
      <MemoryRouter initialEntries={['/cinema/C0153']}>
        <Routes>
          <Route path="/cinema/:id" element={<CinemaPage />} />
        </Routes>
      </MemoryRouter>
    );

  it('renders the Maintenant button in the date selector', async () => {
    renderCinemaPage();
    await screen.findByRole('heading', { name: 'UGC Test' });
    expect(screen.getByRole('button', { name: /maintenant/i })).toBeInTheDocument();
  });

  it('filters out past showtimes when Maintenant is clicked', async () => {
    renderCinemaPage();
    await screen.findByText('Film Passé');

    // Both films visible initially
    expect(screen.getByText('Film Passé')).toBeInTheDocument();
    expect(screen.getByText('Film Futur')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /maintenant/i }));

    // Past showtime (12:00) should disappear, future (14:00) should remain
    await waitFor(() => {
      expect(screen.queryByText('Film Passé')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Film Futur')).toBeInTheDocument();
  });

  it('resets the time filter when another date is clicked', async () => {
    vi.mocked(clientApi.getCinemaSchedule).mockResolvedValue({
      ...makeSchedule(),
      showtimes: [
        ...makeSchedule().showtimes,
        {
          id: 'st-tomorrow',
          film_id: 103,
          cinema_id: 'C0153',
          date: '2026-03-31',
          time: '10:00',
          datetime_iso: '2026-03-31T10:00:00.000Z',
          version: 'VF',
          format: '2D',
          experiences: [],
          week_start: '2026-03-25',
          film: { id: 103, title: 'Film Demain', genres: [], actors: [], source_url: '' },
        },
      ],
    });

    renderCinemaPage();
    await screen.findByText('Film Passé');

    // Activate "Now" mode
    fireEvent.click(screen.getByRole('button', { name: /maintenant/i }));
    await waitFor(() => {
      expect(screen.queryByText('Film Passé')).not.toBeInTheDocument();
    });

    // Click another date button (31)
    const dateBtn = screen.getByText('31').closest('button');
    fireEvent.click(dateBtn!);

    await waitFor(() => {
      expect(screen.getByText('Film Demain')).toBeInTheDocument();
    });
  });
});
