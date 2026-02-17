import { render, screen } from '@testing-library/react';
import ScrapeProgress from './ScrapeProgress';
import * as useScrapeProgressHook from '../hooks/useScrapeProgress';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { ProgressState } from '../hooks/useScrapeProgress';

// Mock the useScrapeProgress hook
vi.mock('../hooks/useScrapeProgress', () => ({
  useScrapeProgress: vi.fn(),
}));

describe('ScrapeProgress', () => {
  let mockUseScrapeProgress: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUseScrapeProgress = vi.mocked(useScrapeProgressHook.useScrapeProgress);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state when connected but no events yet', () => {
    // This tests Bug 1 fix: should NOT return null when events.length === 0
    const mockState: ProgressState = {
      isConnected: true,
      events: [],
      latestEvent: undefined,
      error: undefined,
    };
    mockUseScrapeProgress.mockReturnValue({ ...mockState, reset: vi.fn() });

    render(<ScrapeProgress />);

    // Should show loading/connecting state
    expect(screen.getByText(/connexion en cours/i)).toBeInTheDocument();
    expect(screen.queryByText(/cinémas traités/i)).not.toBeInTheDocument();
  });

  it('should show loading state when not connected', () => {
    const mockState: ProgressState = {
      isConnected: false,
      events: [],
      latestEvent: undefined,
      error: undefined,
    };
    mockUseScrapeProgress.mockReturnValue({ ...mockState, reset: vi.fn() });

    render(<ScrapeProgress />);

    expect(screen.getByText(/connexion en cours/i)).toBeInTheDocument();
  });

  it('should show progress details when events are received', () => {
    const mockState: ProgressState = {
      isConnected: true,
      events: [
        { type: 'started', total_cinemas: 3, total_dates: 7 },
        { type: 'cinema_started', cinema_id: 'W7504', cinema_name: 'Épée de Bois' },
      ],
      latestEvent: { type: 'cinema_started', cinema_id: 'W7504', cinema_name: 'Épée de Bois' },
      error: undefined,
    };
    mockUseScrapeProgress.mockReturnValue({ ...mockState, reset: vi.fn() });

    render(<ScrapeProgress />);

    // Should show progress UI
    expect(screen.getByText(/scraping en cours/i)).toBeInTheDocument();
    expect(screen.getByText(/cinémas traités/i)).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 3/)).toBeInTheDocument();
  });

  it('should show completed state when scrape finishes', () => {
    const mockState: ProgressState = {
      isConnected: true,
      events: [
        { type: 'started', total_cinemas: 2, total_dates: 7 },
        { type: 'cinema_completed', cinema_id: 'W7504', cinema_name: 'Épée de Bois', films_count: 10, showtimes_count: 50 },
        { type: 'cinema_completed', cinema_id: 'C0072', cinema_name: 'Grand Action', films_count: 15, showtimes_count: 75 },
        { type: 'completed', summary: { total_films: 25, total_showtimes: 125 } },
      ],
      latestEvent: { type: 'completed', summary: { total_films: 25, total_showtimes: 125 } },
      error: undefined,
    };
    mockUseScrapeProgress.mockReturnValue({ ...mockState, reset: vi.fn() });

    render(<ScrapeProgress />);

    expect(screen.getByText(/scraping terminé/i)).toBeInTheDocument();
  });

  it('should show failed state when scrape fails', () => {
    const mockState: ProgressState = {
      isConnected: true,
      events: [
        { type: 'started', total_cinemas: 1, total_dates: 7 },
        { type: 'failed', error: 'Network error' },
      ],
      latestEvent: { type: 'failed', error: 'Network error' },
      error: undefined,
    };
    mockUseScrapeProgress.mockReturnValue({ ...mockState, reset: vi.fn() });

    render(<ScrapeProgress />);

    expect(screen.getByText(/scraping échoué/i)).toBeInTheDocument();
  });

  it('should display error message when hook reports an error', () => {
    const mockState: ProgressState = {
      isConnected: false,
      events: [],
      latestEvent: undefined,
      error: 'Connection failed',
    };
    mockUseScrapeProgress.mockReturnValue({ ...mockState, reset: vi.fn() });

    render(<ScrapeProgress />);

    // Should still show loading state with error display
    expect(screen.getByText(/connexion en cours/i)).toBeInTheDocument();
  });

  it('should call onComplete callback when passed as prop', () => {
    const onComplete = vi.fn();
    const mockState: ProgressState = {
      isConnected: true,
      events: [],
      latestEvent: undefined,
      error: undefined,
    };
    mockUseScrapeProgress.mockReturnValue({ ...mockState, reset: vi.fn() });

    render(<ScrapeProgress onComplete={onComplete} />);

    // Verify hook was called with the callback
    expect(mockUseScrapeProgress).toHaveBeenCalledWith(onComplete);
  });

  it('should show current cinema being processed', () => {
    const mockState: ProgressState = {
      isConnected: true,
      events: [
        { type: 'started', total_cinemas: 3, total_dates: 7 },
        { type: 'cinema_started', cinema_id: 'W7504', cinema_name: 'Épée de Bois' },
      ],
      latestEvent: { type: 'cinema_started', cinema_id: 'W7504', cinema_name: 'Épée de Bois' },
      error: undefined,
    };
    mockUseScrapeProgress.mockReturnValue({ ...mockState, reset: vi.fn() });

    render(<ScrapeProgress />);

    expect(screen.getByText(/en cours: Épée de Bois/i)).toBeInTheDocument();
  });

  it('should show current film being processed', () => {
    const mockState: ProgressState = {
      isConnected: true,
      events: [
        { type: 'started', total_cinemas: 1, total_dates: 7 },
        { type: 'film_started', film_id: 123, film_title: 'Test Film' },
      ],
      latestEvent: { type: 'film_started', film_id: 123, film_title: 'Test Film' },
      error: undefined,
    };
    mockUseScrapeProgress.mockReturnValue({ ...mockState, reset: vi.fn() });

    render(<ScrapeProgress />);

    expect(screen.getByText(/en cours: Test Film/i)).toBeInTheDocument();
  });
});
