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
      jobs: [],
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
      jobs: [],
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
        { type: 'cinema_started', cinema_id: 'W7504', cinema_name: 'Épée de Bois', index: 0 },
      ],
      jobs: [],
      latestEvent: { type: 'cinema_started', cinema_id: 'W7504', cinema_name: 'Épée de Bois', index: 0 },
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
        { type: 'cinema_completed', cinema_name: 'Épée de Bois', total_films: 10 },
        { type: 'cinema_completed', cinema_name: 'Grand Action', total_films: 15 },
        { type: 'completed', summary: { 
          total_cinemas: 2, 
          successful_cinemas: 2, 
          failed_cinemas: 0, 
          total_films: 25, 
          total_showtimes: 125, 
          total_dates: 7,
          duration_ms: 30000, 
          errors: [] 
        }},
      ],
      jobs: [
        {
          id: 'report:1',
          reportId: 1,
          events: [],
          latestEvent: { type: 'completed', report_id: 1, summary: {
            total_cinemas: 1,
            successful_cinemas: 1,
            failed_cinemas: 0,
            total_films: 10,
            total_showtimes: 50,
            total_dates: 7,
            duration_ms: 1000,
            errors: [],
          } },
          cinemaName: 'Épée de Bois',
          totalCinemas: 1,
          processedCinemas: 1,
          totalFilms: 10,
          processedFilms: 10,
          cinemaProgress: 100,
          filmProgress: 100,
          status: 'completed',
        },
      ],
      latestEvent: { type: 'completed', summary: { 
        total_cinemas: 2, 
        successful_cinemas: 2, 
        failed_cinemas: 0, 
        total_films: 25, 
        total_showtimes: 125, 
        total_dates: 7,
        duration_ms: 30000, 
        errors: [] 
      }},
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
      jobs: [
        {
          id: 'report:2',
          reportId: 2,
          events: [],
          latestEvent: { type: 'failed', report_id: 2, error: 'Network error' },
          cinemaName: 'Test Cinema',
          totalCinemas: 1,
          processedCinemas: 0,
          totalFilms: 0,
          processedFilms: 0,
          cinemaProgress: 0,
          filmProgress: 0,
          status: 'failed',
          error: 'Network error',
        },
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
      jobs: [],
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
      jobs: [],
      latestEvent: undefined,
      error: undefined,
    };
    mockUseScrapeProgress.mockReturnValue({ ...mockState, reset: vi.fn() });

    render(<ScrapeProgress onComplete={onComplete} />);

    // Verify hook was called with the callback
    expect(mockUseScrapeProgress).toHaveBeenCalledWith(onComplete, []);
  });

  it('should show current cinema being processed', () => {
    const mockState: ProgressState = {
      isConnected: true,
      events: [
        { type: 'started', total_cinemas: 3, total_dates: 7 },
        { type: 'cinema_started', cinema_id: 'W7504', cinema_name: 'Épée de Bois', index: 0 },
      ],
      jobs: [],
      latestEvent: { type: 'cinema_started', cinema_id: 'W7504', cinema_name: 'Épée de Bois', index: 0 },
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
      jobs: [],
      latestEvent: { type: 'film_started', film_id: 123, film_title: 'Test Film' },
      error: undefined,
    };
    mockUseScrapeProgress.mockReturnValue({ ...mockState, reset: vi.fn() });

    render(<ScrapeProgress />);

    expect(screen.getByText(/en cours: Test Film/i)).toBeInTheDocument();
  });

  it('should keep showing completed state even after SSE disconnects', () => {
    // This tests the fix: completed state should remain visible even when isConnected = false
    const mockState: ProgressState = {
      isConnected: false, // SSE connection closed
      events: [
        { type: 'started', total_cinemas: 1, total_dates: 7 },
        { type: 'cinema_completed', cinema_name: 'Test Cinema', total_films: 5 },
        { type: 'completed', summary: { 
          total_cinemas: 1, 
          successful_cinemas: 1, 
          failed_cinemas: 0, 
          total_films: 5, 
          total_showtimes: 25, 
          total_dates: 7,
          duration_ms: 10000, 
          errors: [] 
        }},
      ],
      jobs: [
        {
          id: 'report:3',
          reportId: 3,
          events: [],
          latestEvent: { type: 'completed', report_id: 3, summary: {
            total_cinemas: 1,
            successful_cinemas: 1,
            failed_cinemas: 0,
            total_films: 5,
            total_showtimes: 25,
            total_dates: 7,
            duration_ms: 10000,
            errors: [],
          } },
          cinemaName: 'Test Cinema',
          totalCinemas: 1,
          processedCinemas: 1,
          totalFilms: 5,
          processedFilms: 5,
          cinemaProgress: 100,
          filmProgress: 100,
          status: 'completed',
        },
      ],
      latestEvent: { type: 'completed', summary: { 
        total_cinemas: 1, 
        successful_cinemas: 1, 
        failed_cinemas: 0, 
        total_films: 5, 
        total_showtimes: 25, 
        total_dates: 7,
        duration_ms: 10000, 
        errors: [] 
      }},
      error: undefined,
    };
    mockUseScrapeProgress.mockReturnValue({ ...mockState, reset: vi.fn() });

    render(<ScrapeProgress />);

    // Should show completed state, NOT "Connexion en cours..."
    expect(screen.getByText(/scraping terminé/i)).toBeInTheDocument();
    expect(screen.queryByText(/connexion en cours/i)).not.toBeInTheDocument();
    
    // Should show auto-reload message
    expect(screen.getByText(/rechargement de la page/i)).toBeInTheDocument();
  });

  it('should display reload message when scrape completes successfully', () => {
    const mockState: ProgressState = {
      isConnected: true,
      events: [
        {
          type: 'completed',
          summary: {
            total_cinemas: 1,
            successful_cinemas: 1,
            failed_cinemas: 0,
            total_films: 5,
            total_showtimes: 10,
            total_dates: 7,
            duration_ms: 5000,
            errors: [],
          },
        },
      ],
      jobs: [
        {
          id: 'report:4',
          reportId: 4,
          events: [],
          latestEvent: {
            type: 'completed',
            report_id: 4,
            summary: {
              total_cinemas: 1,
              successful_cinemas: 1,
              failed_cinemas: 0,
              total_films: 5,
              total_showtimes: 10,
              total_dates: 7,
              duration_ms: 5000,
              errors: [],
            },
          },
          cinemaName: 'Test Cinema',
          totalCinemas: 1,
          processedCinemas: 1,
          totalFilms: 5,
          processedFilms: 5,
          cinemaProgress: 100,
          filmProgress: 100,
          status: 'completed',
        },
      ],
      latestEvent: {
        type: 'completed',
        summary: {
          total_cinemas: 1,
          successful_cinemas: 1,
          failed_cinemas: 0,
          total_films: 5,
          total_showtimes: 10,
          total_dates: 7,
          duration_ms: 5000,
          errors: [],
        },
      },
    };

    mockUseScrapeProgress.mockReturnValue({
      ...mockState,
      reset: vi.fn(),
    });

    const { getByText } = render(<ScrapeProgress />);

    // Verify completion message is displayed
    expect(getByText(/Scraping terminé/)).toBeInTheDocument();
    
    // Verify reload message is displayed
    expect(getByText(/🔄 Rechargement de la page dans quelques instants/)).toBeInTheDocument();
  });

  it('should keep reload message visible even after SSE disconnects', () => {
    // Simulate state after SSE disconnect (isConnected = false)
    // but with completed event still in events array
    const mockState: ProgressState = {
      isConnected: false, // SSE disconnected
      events: [
        {
          type: 'completed',
          summary: {
            total_cinemas: 1,
            successful_cinemas: 1,
            failed_cinemas: 0,
            total_films: 5,
            total_showtimes: 10,
            total_dates: 7,
            duration_ms: 5000,
            errors: [],
          },
        },
      ],
      jobs: [
        {
          id: 'report:5',
          reportId: 5,
          events: [],
          latestEvent: {
            type: 'completed',
            report_id: 5,
            summary: {
              total_cinemas: 1,
              successful_cinemas: 1,
              failed_cinemas: 0,
              total_films: 5,
              total_showtimes: 10,
              total_dates: 7,
              duration_ms: 5000,
              errors: [],
            },
          },
          cinemaName: 'Test Cinema',
          totalCinemas: 1,
          processedCinemas: 1,
          totalFilms: 5,
          processedFilms: 5,
          cinemaProgress: 100,
          filmProgress: 100,
          status: 'completed',
        },
      ],
      latestEvent: {
        type: 'completed',
        summary: {
          total_cinemas: 1,
          successful_cinemas: 1,
          failed_cinemas: 0,
          total_films: 5,
          total_showtimes: 10,
          total_dates: 7,
          duration_ms: 5000,
          errors: [],
        },
      },
    };

    mockUseScrapeProgress.mockReturnValue({
      ...mockState,
      reset: vi.fn(),
    });

    const { getByText, queryByText } = render(<ScrapeProgress />);

    // Should NOT show "Connexion en cours..." (loading state)
    expect(queryByText(/Connexion en cours/)).not.toBeInTheDocument();
    
    // Should keep showing completed message
    expect(getByText(/Scraping terminé/)).toBeInTheDocument();
    
    // Should keep showing reload message
    expect(getByText(/🔄 Rechargement de la page dans quelques instants/)).toBeInTheDocument();
  });

  it('renders per-job progress cards and completion markers', () => {
    const mockState: ProgressState = {
      isConnected: true,
      events: [
        { type: 'started', total_cinemas: 2, total_dates: 7 },
      ],
      jobs: [
        {
          id: 'report:10',
          reportId: 10,
          events: [],
          latestEvent: { type: 'cinema_started', report_id: 10, cinema_id: 'C1', cinema_name: 'Cinema One', index: 1 },
          cinemaName: 'Cinema One',
          currentFilm: 'Film One',
          totalCinemas: 1,
          processedCinemas: 0,
          totalFilms: 3,
          processedFilms: 1,
          cinemaProgress: 0,
          filmProgress: 33,
          status: 'running',
        },
        {
          id: 'report:11',
          reportId: 11,
          events: [],
          latestEvent: { type: 'completed', report_id: 11, summary: {
            total_cinemas: 1,
            successful_cinemas: 1,
            failed_cinemas: 0,
            total_films: 2,
            total_showtimes: 8,
            total_dates: 7,
            duration_ms: 1000,
            errors: [],
          } },
          cinemaName: 'Cinema Two',
          totalCinemas: 1,
          processedCinemas: 1,
          totalFilms: 2,
          processedFilms: 2,
          cinemaProgress: 100,
          filmProgress: 100,
          status: 'completed',
        },
      ],
      latestEvent: { type: 'cinema_started', report_id: 10, cinema_id: 'C1', cinema_name: 'Cinema One', index: 1 },
      error: undefined,
    };

    mockUseScrapeProgress.mockReturnValue({ ...mockState, reset: vi.fn() });

    render(<ScrapeProgress />);

    expect(screen.getAllByTestId('scrape-progress-card')).toHaveLength(2);
    expect(screen.getByText('Cinema One')).toBeInTheDocument();
    expect(screen.getByText('Cinema Two')).toBeInTheDocument();
    expect(screen.getAllByTestId('scrape-status-completed')).toHaveLength(1);
    expect(screen.getAllByTestId('scrape-progress-percentage').length).toBeGreaterThan(0);
  });

  it('renders pending tracked jobs before first SSE event', () => {
    const mockState: ProgressState = {
      isConnected: true,
      events: [],
      jobs: [
        {
          id: 'report:30',
          reportId: 30,
          events: [],
          cinemaName: 'Cinema Pending',
          totalCinemas: 0,
          processedCinemas: 0,
          totalFilms: 0,
          processedFilms: 0,
          cinemaProgress: 0,
          filmProgress: 0,
          status: 'pending',
        },
      ],
      latestEvent: undefined,
      error: undefined,
    };

    mockUseScrapeProgress.mockReturnValue({ ...mockState, reset: vi.fn() });

    render(<ScrapeProgress trackedJobs={[{ reportId: 30, cinemaName: 'Cinema Pending' }]} />);

    expect(screen.getByText('Cinema Pending')).toBeInTheDocument();
    expect(screen.getByText(/en attente du premier evenement sse/i)).toBeInTheDocument();
    expect(screen.queryByText(/connexion en cours/i)).not.toBeInTheDocument();
  });
});
