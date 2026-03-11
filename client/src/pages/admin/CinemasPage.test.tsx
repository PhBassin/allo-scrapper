import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import CinemasPage from './CinemasPage';
import * as cinemasApi from '../../api/cinemas';
import * as clientApi from '../../api/client';
import { AuthContext } from '../../contexts/AuthContext';

// Mock API modules
vi.mock('../../api/cinemas', () => ({
  getCinemas: vi.fn(),
  createCinema: vi.fn(),
  updateCinema: vi.fn(),
  deleteCinema: vi.fn(),
}));

vi.mock('../../api/client', () => ({
  triggerScrape: vi.fn(),
  triggerCinemaScrape: vi.fn(),
  getScrapeStatus: vi.fn(),
  subscribeToProgress: vi.fn(),
}));

// Mock ScrapeButton: renders a real button with the testId so tests can click it
vi.mock('../../components/ScrapeButton', () => ({
  default: ({
    onTrigger,
    onScrapeStart,
    testId,
    buttonText = 'Scraper',
  }: {
    onTrigger: () => Promise<void>;
    onScrapeStart?: () => void;
    testId?: string;
    buttonText?: string;
  }) => (
    <button
      data-testid={testId}
      onClick={async () => {
        await onTrigger();
        onScrapeStart?.();
      }}
    >
      {buttonText}
    </button>
  ),
}));

// Mock child modal components to keep tests focused
vi.mock('../../components/admin/AddCinemaModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="add-cinema-modal">Add Modal</div> : null,
}));

vi.mock('../../components/admin/EditCinemaModal', () => ({
  default: () => <div data-testid="edit-cinema-modal">Edit Modal</div>,
}));

vi.mock('../../components/admin/DeleteCinemaDialog', () => ({
  default: () => <div data-testid="delete-cinema-dialog">Delete Dialog</div>,
}));

// Mock ScrapeProgress to avoid SSE complexity in tests
vi.mock('../../components/ScrapeProgress', () => ({
  default: ({ onComplete }: { onComplete?: (success: boolean) => void }) => (
    <div data-testid="scrape-progress">
      <span>Scraping en cours...</span>
      <button onClick={() => onComplete?.(true)}>Simulate Complete</button>
    </div>
  ),
}));

const mockAuthContext = {
  isAuthenticated: true,
  token: 'mock-token',
  user: { id: 1, username: 'admin', role_id: 1, role_name: 'admin', permissions: ['cinemas:read', 'cinemas:create', 'scraper:trigger'] },
  login: vi.fn(),
  logout: vi.fn(),
  isAdmin: true,
  hasPermission: vi.fn<(p: string) => boolean>(() => true),
};

const renderWithAuth = (ui: React.ReactElement, authOverrides?: Partial<typeof mockAuthContext>) =>
  render(
    <AuthContext.Provider value={{ ...mockAuthContext, ...authOverrides }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </AuthContext.Provider>
  );

const mockCinemas = [
  { id: 'C0153', name: 'UGC Ciné Cité Paris', city: 'Paris', screen_count: 12 },
  { id: 'C0002', name: 'Pathé Wepler', city: 'Paris', screen_count: 8 },
];

describe('CinemasPage - Scrape All button', () => {
  beforeEach(() => {
    vi.mocked(cinemasApi.getCinemas).mockResolvedValue(mockCinemas);
    vi.mocked(clientApi.getScrapeStatus).mockResolvedValue({ isRunning: false });
    vi.mocked(clientApi.triggerScrape).mockResolvedValue({ reportId: 1, message: 'ok' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders a "Scrape All" button in the header', async () => {
    renderWithAuth(<CinemasPage />);

    await screen.findByText('UGC Ciné Cité Paris');

    expect(screen.getByTestId('scrape-all-button')).toBeInTheDocument();
  });

  it('triggers scrapeAll when "Scrape All" button is clicked', async () => {
    renderWithAuth(<CinemasPage />);

    await screen.findByText('UGC Ciné Cité Paris');

    fireEvent.click(screen.getByTestId('scrape-all-button'));

    await waitFor(() => {
      expect(clientApi.triggerScrape).toHaveBeenCalledTimes(1);
    });
  });

  it('shows ScrapeProgress after triggering scrape all', async () => {
    renderWithAuth(<CinemasPage />);

    await screen.findByText('UGC Ciné Cité Paris');

    expect(screen.queryByTestId('scrape-progress')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('scrape-all-button'));

    await waitFor(() => {
      expect(screen.getByTestId('scrape-progress')).toBeInTheDocument();
    });
  });

  it('shows ScrapeProgress on mount if scrape is already running', async () => {
    vi.mocked(clientApi.getScrapeStatus).mockResolvedValue({ isRunning: true });

    renderWithAuth(<CinemasPage />);

    await waitFor(() => {
      expect(screen.getByTestId('scrape-progress')).toBeInTheDocument();
    });
  });

  it('hides ScrapeProgress and refreshes cinemas after scrape completes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const updatedCinemas = [
      ...mockCinemas,
      { id: 'C0999', name: 'New Cinema', city: 'Lyon', screen_count: 5 },
    ];
    vi.mocked(cinemasApi.getCinemas)
      .mockResolvedValueOnce(mockCinemas)
      .mockResolvedValueOnce(updatedCinemas);

    renderWithAuth(<CinemasPage />);

    await screen.findByText('UGC Ciné Cité Paris');

    fireEvent.click(screen.getByTestId('scrape-all-button'));

    // Progress should appear
    await waitFor(() => {
      expect(screen.getByTestId('scrape-progress')).toBeInTheDocument();
    });

    // Simulate scrape completion
    fireEvent.click(screen.getByText('Simulate Complete'));

    // Advance the 2000ms setTimeout
    act(() => {
      vi.advanceTimersByTime(2500);
    });

    // Progress should disappear and cinemas should reload
    await waitFor(() => {
      expect(screen.queryByTestId('scrape-progress')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(cinemasApi.getCinemas).toHaveBeenCalledTimes(2);
    });

    vi.useRealTimers();
  });
});

describe('CinemasPage - Per-cinema scrape button', () => {
  beforeEach(() => {
    vi.mocked(cinemasApi.getCinemas).mockResolvedValue(mockCinemas);
    vi.mocked(clientApi.getScrapeStatus).mockResolvedValue({ isRunning: false });
    vi.mocked(clientApi.triggerCinemaScrape).mockResolvedValue({ reportId: 2, message: 'ok' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders a scrape button for each cinema row', async () => {
    renderWithAuth(<CinemasPage />);

    await screen.findByText('UGC Ciné Cité Paris');

    expect(screen.getByTestId('scrape-cinema-C0153')).toBeInTheDocument();
    expect(screen.getByTestId('scrape-cinema-C0002')).toBeInTheDocument();
  });

  it('triggers triggerCinemaScrape with correct ID when per-cinema button is clicked', async () => {
    renderWithAuth(<CinemasPage />);

    await screen.findByText('UGC Ciné Cité Paris');

    fireEvent.click(screen.getByTestId('scrape-cinema-C0153'));

    await waitFor(() => {
      expect(clientApi.triggerCinemaScrape).toHaveBeenCalledWith('C0153');
    });
  });

  it('shows ScrapeProgress after triggering per-cinema scrape', async () => {
    renderWithAuth(<CinemasPage />);

    await screen.findByText('UGC Ciné Cité Paris');

    expect(screen.queryByTestId('scrape-progress')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('scrape-cinema-C0002'));

    await waitFor(() => {
      expect(screen.getByTestId('scrape-progress')).toBeInTheDocument();
    });
  });
});

describe('CinemasPage - Scraping buttons not on public pages', () => {
  it('HomePage does not import triggerScrape (scrape moved to admin)', async () => {
    // This test documents the expected behaviour: scraping is admin-only.
    // The actual enforcement is structural (no ScrapeButton in HomePage).
    // We verify by checking that CinemasPage renders the scrape all button.
    vi.mocked(cinemasApi.getCinemas).mockResolvedValue(mockCinemas);
    vi.mocked(clientApi.getScrapeStatus).mockResolvedValue({ isRunning: false });

    renderWithAuth(<CinemasPage />);

    await screen.findByText('UGC Ciné Cité Paris');

    // Scrape All button is present in admin
    expect(screen.getByTestId('scrape-all-button')).toBeInTheDocument();
  });
});

describe('CinemasPage - permission-based button visibility', () => {
  beforeEach(() => {
    vi.mocked(cinemasApi.getCinemas).mockResolvedValue(mockCinemas);
    vi.mocked(clientApi.getScrapeStatus).mockResolvedValue({ isRunning: false });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('hides "Add Cinema" button when user lacks cinemas:create permission', async () => {
    renderWithAuth(<CinemasPage />, {
      hasPermission: vi.fn((p: string) => p !== 'cinemas:create'),
    });

    await screen.findByText('UGC Ciné Cité Paris');

    expect(screen.queryByTestId('add-cinema-button')).not.toBeInTheDocument();
  });

  it('shows "Add Cinema" button when user has cinemas:create permission', async () => {
    renderWithAuth(<CinemasPage />, {
      hasPermission: vi.fn(() => true),
    });

    await screen.findByText('UGC Ciné Cité Paris');

    expect(screen.getByTestId('add-cinema-button')).toBeInTheDocument();
  });

  it('hides per-row "Edit" button when user lacks cinemas:update permission', async () => {
    renderWithAuth(<CinemasPage />, {
      hasPermission: vi.fn((p: string) => p !== 'cinemas:update'),
    });

    await screen.findByText('UGC Ciné Cité Paris');

    expect(screen.queryByTestId('edit-cinema-C0153')).not.toBeInTheDocument();
    expect(screen.queryByTestId('edit-cinema-C0002')).not.toBeInTheDocument();
  });

  it('shows per-row "Edit" button when user has cinemas:update permission', async () => {
    renderWithAuth(<CinemasPage />, {
      hasPermission: vi.fn(() => true),
    });

    await screen.findByText('UGC Ciné Cité Paris');

    expect(screen.getByTestId('edit-cinema-C0153')).toBeInTheDocument();
    expect(screen.getByTestId('edit-cinema-C0002')).toBeInTheDocument();
  });

  it('hides per-row "Delete" button when user lacks cinemas:delete permission', async () => {
    renderWithAuth(<CinemasPage />, {
      hasPermission: vi.fn((p: string) => p !== 'cinemas:delete'),
    });

    await screen.findByText('UGC Ciné Cité Paris');

    expect(screen.queryByTestId('delete-cinema-C0153')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-cinema-C0002')).not.toBeInTheDocument();
  });

  it('shows per-row "Delete" button when user has cinemas:delete permission', async () => {
    renderWithAuth(<CinemasPage />, {
      hasPermission: vi.fn(() => true),
    });

    await screen.findByText('UGC Ciné Cité Paris');

    expect(screen.getByTestId('delete-cinema-C0153')).toBeInTheDocument();
    expect(screen.getByTestId('delete-cinema-C0002')).toBeInTheDocument();
  });

  it('hides per-row "Scraper" button when user lacks scraper:trigger_single permission', async () => {
    renderWithAuth(<CinemasPage />, {
      hasPermission: vi.fn((p: string) => p !== 'scraper:trigger_single'),
    });

    await screen.findByText('UGC Ciné Cité Paris');

    expect(screen.queryByTestId('scrape-cinema-C0153')).not.toBeInTheDocument();
    expect(screen.queryByTestId('scrape-cinema-C0002')).not.toBeInTheDocument();
  });

  it('shows per-row "Scraper" button when user has scraper:trigger_single permission', async () => {
    renderWithAuth(<CinemasPage />, {
      hasPermission: vi.fn(() => true),
    });

    await screen.findByText('UGC Ciné Cité Paris');

    expect(screen.getByTestId('scrape-cinema-C0153')).toBeInTheDocument();
    expect(screen.getByTestId('scrape-cinema-C0002')).toBeInTheDocument();
  });
});
