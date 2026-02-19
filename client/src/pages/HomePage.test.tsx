import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import HomePage from './HomePage';
import * as clientApi from '../api/client';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

// Mock the API client
vi.mock('../api/client', () => ({
  getWeeklyFilms: vi.fn(),
  getCinemas: vi.fn(),
  getScrapeStatus: vi.fn(),
  triggerScrape: vi.fn(),
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

vi.mock('../components/AddCinemaModal', () => ({
  default: ({ onClose, onSuccess }: { onClose: () => void; onSuccess: (id: string) => void }) => (
    <div data-testid="add-cinema-modal">
      <button onClick={onClose}>Close Modal</button>
      <button onClick={() => onSuccess('W9999')}>Submit Modal</button>
    </div>
  ),
}));

describe('HomePage', () => {
  let mockGetWeeklyFilms: ReturnType<typeof vi.fn>;
  let mockGetCinemas: ReturnType<typeof vi.fn>;
  let mockGetScrapeStatus: ReturnType<typeof vi.fn>;
  let mockTriggerScrape: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockGetWeeklyFilms = vi.fn();
    mockGetCinemas = vi.fn();
    mockGetScrapeStatus = vi.fn();
    mockTriggerScrape = vi.fn();

    // Re-bind mocks
    (clientApi.getWeeklyFilms as any) = mockGetWeeklyFilms;
    (clientApi.getCinemas as any) = mockGetCinemas;
    (clientApi.getScrapeStatus as any) = mockGetScrapeStatus;
    (clientApi.triggerScrape as any) = mockTriggerScrape;

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

  it('should open AddCinemaModal when button is clicked', async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetCinemas).toHaveBeenCalled());

    expect(screen.queryByTestId('add-cinema-modal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(/Ajouter un cinéma/i));

    expect(screen.getByTestId('add-cinema-modal')).toBeInTheDocument();
  });

  it('should trigger scrape with cinemaId after successful add', async () => {
    mockTriggerScrape.mockResolvedValue({ reportId: 1, message: 'ok' });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetCinemas).toHaveBeenCalled());

    fireEvent.click(screen.getByText(/Ajouter un cinéma/i));
    fireEvent.click(screen.getByText('Submit Modal'));

    await waitFor(() => {
      expect(mockTriggerScrape).toHaveBeenCalledWith(['W9999']);
    });
  });
});
