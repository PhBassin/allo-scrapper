import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import CinemaPage from './CinemaPage';
import * as clientApi from '../api/client';
import type { Cinema } from '../types';

vi.mock('../api/client', () => ({
  getCinemas: vi.fn(),
  getCinemaSchedule: vi.fn(),
  triggerCinemaScrape: vi.fn(),
}));

describe('CinemaPage - Cinema scrape button', () => {
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
    vi.mocked(clientApi.triggerCinemaScrape).mockResolvedValue({ 
      reportId: 1, 
      message: 'ok' 
    });
  });

  it('renders cinema scrape button in sticky position', async () => {
    render(
      <MemoryRouter initialEntries={['/cinema/C0153']}>
        <Routes>
          <Route path="/cinema/:id" element={<CinemaPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: 'UGC Test' });
    
    const button = screen.getByRole('button', { name: /Scraper uniquement ce cinéma/i });
    expect(button).toBeInTheDocument();
  });

  it('triggers cinema scrape when button is clicked', async () => {
    render(
      <MemoryRouter initialEntries={['/cinema/C0153']}>
        <Routes>
          <Route path="/cinema/:id" element={<CinemaPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: 'UGC Test' });
    
    const scrapeButton = screen.getByRole('button', { 
      name: /Scraper uniquement ce cinéma/i 
    });
    fireEvent.click(scrapeButton);

    await waitFor(() => {
      expect(clientApi.triggerCinemaScrape).toHaveBeenCalledWith('C0153');
    });
    
    expect(await screen.findByText(/Scraping démarré/i))
      .toBeInTheDocument();
  });

  it('displays error message when scrape fails', async () => {
    vi.mocked(clientApi.triggerCinemaScrape).mockRejectedValue(
      new Error('A scrape is already in progress')
    );

    render(
      <MemoryRouter initialEntries={['/cinema/C0153']}>
        <Routes>
          <Route path="/cinema/:id" element={<CinemaPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: 'UGC Test' });
    
    fireEvent.click(screen.getByRole('button', { 
      name: /Scraper uniquement ce cinéma/i 
    }));

    expect(await screen.findByText(/A scrape is already in progress/i))
      .toBeInTheDocument();
  });

  it('disables button and shows loading state during scrape', async () => {
    vi.mocked(clientApi.triggerCinemaScrape).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ reportId: 1, message: 'ok' }), 100))
    );

    render(
      <MemoryRouter initialEntries={['/cinema/C0153']}>
        <Routes>
          <Route path="/cinema/:id" element={<CinemaPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: 'UGC Test' });
    
    const button = screen.getByRole('button', { 
      name: /Scraper uniquement ce cinéma/i 
    });
    
    fireEvent.click(button);

    // During scrape: button should be disabled and show loading text
    await waitFor(() => {
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent(/Scraping en cours/i);
    });
  });
});
