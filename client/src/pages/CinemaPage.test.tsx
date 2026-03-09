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
    render(
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
    render(
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
    render(
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

    render(
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
