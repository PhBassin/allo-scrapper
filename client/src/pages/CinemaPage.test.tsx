/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, beforeEach, expect } from 'vitest';
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
});
