import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HomePage from '../pages/HomePage';
import CinemaPage from '../pages/CinemaPage';
import { AuthContext } from '../contexts/AuthContext';
import * as clientApi from '../api/client';

// Mock API
vi.mock('../api/client', () => ({
  getWeeklyFilms: vi.fn(),
  getFilmsByDate: vi.fn(),
  getCinemas: vi.fn(),
  getCinemaSchedule: vi.fn(),
}));

const mockAuthContext = {
  isAuthenticated: true,
  user: { 
    id: 1, 
    username: 'testuser', 
    role_id: 1, 
    role_name: 'admin', 
    is_system_role: true, 
    permissions: ['cinemas:create', 'scraper:trigger'] as any[] 
  },
  logout: vi.fn(),
  login: vi.fn(),
  isAdmin: false,
  hasPermission: vi.fn(() => true),
  token: 'mock-token',
};

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn(),
  };
});

import { useParams, MemoryRouter } from 'react-router-dom';

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          {ui}
        </AuthContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Sticky Elements Stickiness', () => {
  it('HomePage search/date container should be sticky with offset', async () => {
    (clientApi.getCinemas as any).mockResolvedValue([]);
    (clientApi.getWeeklyFilms as any).mockResolvedValue({ films: [], weekStart: '2024-01-01' });

    renderWithProviders(<HomePage />);

    const stickySection = await screen.findByTestId('sticky-search-date-container');
    expect(stickySection).toBeInTheDocument();
    expect(stickySection).toHaveClass('sticky');
    expect(stickySection).toHaveClass('top-[64px]');
    expect(stickySection).toHaveClass('z-40');
  });

  it('CinemaPage date selector should be sticky with offset', async () => {
    (clientApi.getCinemas as any).mockResolvedValue([{ id: '1', name: 'Test Cinema' }]);
    (clientApi.getCinemaSchedule as any).mockResolvedValue({ showtimes: [] });
    
    (useParams as any).mockReturnValue({ id: '1' });

    renderWithProviders(<CinemaPage />);

    const dateSelectorContainer = await screen.findByTestId('sticky-date-selector-container');
    expect(dateSelectorContainer).toBeInTheDocument();
    expect(dateSelectorContainer).toHaveClass('sticky');
    expect(dateSelectorContainer).toHaveClass('top-[64px]');
    expect(dateSelectorContainer).toHaveClass('z-40');
  });
});
