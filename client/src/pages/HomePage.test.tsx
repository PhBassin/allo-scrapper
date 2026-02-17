import { render, screen, waitFor } from '@testing-library/react';
import HomePage from './HomePage';
import * as clientApi from '../api/client';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

// Mock the API client
vi.mock('../api/client', () => ({
  getWeeklyFilms: vi.fn(),
  getCinemas: vi.fn(),
  getScrapeStatus: vi.fn(),
}));

// Mock child components to avoid complex rendering and their side effects
vi.mock('../components/ScrapeButton', () => ({
  default: ({ onScrapeStart }: { onScrapeStart: () => void }) => (
    <button onClick={onScrapeStart}>Mock Scrape Button</button>
  ),
}));

vi.mock('../components/ScrapeProgress', () => ({
  default: () => <div data-testid="scrape-progress">Scrape Progress Component</div>,
}));

describe('HomePage', () => {
  let mockGetWeeklyFilms: ReturnType<typeof vi.fn>;
  let mockGetCinemas: ReturnType<typeof vi.fn>;
  let mockGetScrapeStatus: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockGetWeeklyFilms = vi.fn();
    mockGetCinemas = vi.fn();
    mockGetScrapeStatus = vi.fn();

    // Re-bind mocks
    (clientApi.getWeeklyFilms as any) = mockGetWeeklyFilms;
    (clientApi.getCinemas as any) = mockGetCinemas;
    (clientApi.getScrapeStatus as any) = mockGetScrapeStatus;

    // Default successful responses
    mockGetWeeklyFilms.mockResolvedValue({ films: [], weekStart: '2023-01-01' });
    mockGetCinemas.mockResolvedValue([]);
    mockGetScrapeStatus.mockResolvedValue({ isRunning: false });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should load data on mount', async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockGetWeeklyFilms).toHaveBeenCalled();
      expect(mockGetCinemas).toHaveBeenCalled();
      expect(mockGetScrapeStatus).toHaveBeenCalled();
    });
  });

  it('should NOT show ScrapeProgress if no scrape is running', async () => {
    mockGetScrapeStatus.mockResolvedValue({ isRunning: false });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    // Wait for loading to finish
    await waitFor(() => {
        expect(mockGetScrapeStatus).toHaveBeenCalled();
    });

    expect(screen.queryByTestId('scrape-progress')).not.toBeInTheDocument();
  });

  it('should show ScrapeProgress if scrape IS running', async () => {
    mockGetScrapeStatus.mockResolvedValue({ isRunning: true });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    // Wait for loading to finish and component to update
    await waitFor(() => {
      expect(screen.getByTestId('scrape-progress')).toBeInTheDocument();
    });
  });
});
