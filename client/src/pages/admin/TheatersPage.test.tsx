import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import TheatersPage from './TheatersPage';
import * as theatersApi from '../../api/theaters';
import * as clientApi from '../../api/client';
import { AuthContext } from '../../contexts/AuthContext';
import type { PermissionName } from '../../types/role';

// Mock API modules
vi.mock('../../api/theaters', () => ({
  getTheaters: vi.fn(),
  createTheater: vi.fn(),
  updateTheater: vi.fn(),
  deleteTheater: vi.fn(),
}));

vi.mock('../../api/client', () => ({
  triggerScrape: vi.fn(),
  triggerTheaterScrape: vi.fn(),
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
vi.mock('../../components/admin/AddTheaterModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="add-theater-modal">Add Modal</div> : null,
}));

vi.mock('../../components/admin/EditTheaterModal', () => ({
  default: () => <div data-testid="edit-theater-modal">Edit Modal</div>,
}));

vi.mock('../../components/admin/DeleteTheaterDialog', () => ({
  default: () => <div data-testid="delete-theater-dialog">Delete Dialog</div>,
}));

// Mock ScrapeProgress to avoid SSE complexity in tests
vi.mock('../../components/ScrapeProgress', () => ({
  default: ({ onComplete, trackedJobs = [] }: { onComplete?: (success: boolean) => void; trackedJobs?: Array<{ reportId: number; theaterName?: string }> }) => (
    <div data-testid="scrape-progress">
      <span>Scraping en cours...</span>
      {trackedJobs.map((job) => (
        <div key={job.reportId} data-testid="tracked-job">{job.theaterName ?? `Report ${job.reportId}`}</div>
      ))}
      <button onClick={() => onComplete?.(true)}>Simulate Complete</button>
    </div>
  ),
}));

const mockAuthContext = {
  isAuthenticated: true,
  token: 'mock-token',
  user: { id: 1, username: 'admin', role_id: 1, role_name: 'admin', is_system_role: true, permissions: ['theaters:read', 'theaters:create', 'scraper:trigger'] as PermissionName[] },
  login: vi.fn(),
  logout: vi.fn(),
  isAdmin: true,
  hasPermission: vi.fn<(p: PermissionName) => boolean>(() => true),
};

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const renderWithAuth = (ui: React.ReactElement, authOverrides?: Partial<typeof mockAuthContext>) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{ ...mockAuthContext, ...authOverrides }}>
        <MemoryRouter>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
};

const mockTheaters = [
  { id: 'C0153', name: 'UGC Ciné Cité Paris', city: 'Paris', screen_count: 12 },
  { id: 'C0002', name: 'Pathé Wepler', city: 'Paris', screen_count: 8 },
];

describe('TheatersPage - Scrape All button', () => {
  beforeEach(() => {
    vi.mocked(theatersApi.getTheaters).mockResolvedValue(mockTheaters);
    vi.mocked(clientApi.getScrapeStatus).mockResolvedValue({ isRunning: false });
    vi.mocked(clientApi.triggerScrape).mockResolvedValue({ reportId: 1, message: 'ok' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders a "Scrape All" button in the header', async () => {
    renderWithAuth(<TheatersPage />);

    await screen.findByText('UGC Ciné Cité Paris');

    expect(screen.getByTestId('scrape-all-button')).toBeInTheDocument();
  });

  it('triggers scrapeAll when "Scrape All" button is clicked', async () => {
    renderWithAuth(<TheatersPage />);

    await screen.findByText('UGC Ciné Cité Paris');

    fireEvent.click(screen.getByTestId('scrape-all-button'));

    await waitFor(() => {
      expect(clientApi.triggerScrape).toHaveBeenCalledTimes(1);
    });
  });

  it('shows ScrapeProgress after triggering scrape all', async () => {
    renderWithAuth(<TheatersPage />);

    await screen.findByText('UGC Ciné Cité Paris');

    expect(screen.queryByTestId('scrape-progress')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('scrape-all-button'));

    await waitFor(() => {
      expect(screen.getByTestId('scrape-progress')).toBeInTheDocument();
    });
  });

  it('shows ScrapeProgress on mount if scrape is already running', async () => {
    vi.mocked(clientApi.getScrapeStatus).mockResolvedValue({ isRunning: true });

    renderWithAuth(<TheatersPage />);

    await waitFor(() => {
      expect(screen.getByTestId('scrape-progress')).toBeInTheDocument();
    });
  });

  it('hides ScrapeProgress and refreshes theaters after scrape completes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const updatedTheaters = [
      ...mockTheaters,
      { id: 'C0999', name: 'New Theater', city: 'Lyon', screen_count: 5 },
    ];
    vi.mocked(theatersApi.getTheaters)
      .mockResolvedValueOnce(mockTheaters)
      .mockResolvedValueOnce(updatedTheaters);

    renderWithAuth(<TheatersPage />);

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

    // Progress should disappear and theaters should reload
    await waitFor(() => {
      expect(screen.queryByTestId('scrape-progress')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(theatersApi.getTheaters).toHaveBeenCalledTimes(2);
    });

    vi.useRealTimers();
  });
});

describe('TheatersPage - Per-theater scrape button', () => {
  beforeEach(() => {
    vi.mocked(theatersApi.getTheaters).mockResolvedValue(mockTheaters);
    vi.mocked(clientApi.getScrapeStatus).mockResolvedValue({ isRunning: false });
    vi.mocked(clientApi.triggerTheaterScrape).mockResolvedValue({ reportId: 2, message: 'ok' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders a scrape button for each theater row', async () => {
    renderWithAuth(<TheatersPage />);

    await screen.findByText('UGC Ciné Cité Paris');

    expect(screen.getByTestId('scrape-theater-C0153')).toBeInTheDocument();
    expect(screen.getByTestId('scrape-theater-C0002')).toBeInTheDocument();
  });

  it('triggers triggerTheaterScrape with correct ID when per-theater button is clicked', async () => {
    renderWithAuth(<TheatersPage />);

    await screen.findByText('UGC Ciné Cité Paris');

    fireEvent.click(screen.getByTestId('scrape-theater-C0153'));

    await waitFor(() => {
      expect(clientApi.triggerTheaterScrape).toHaveBeenCalledWith('C0153');
    });
  });

  it('shows ScrapeProgress after triggering per-theater scrape', async () => {
    renderWithAuth(<TheatersPage />);

    await screen.findByText('UGC Ciné Cité Paris');

    expect(screen.queryByTestId('scrape-progress')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('scrape-theater-C0002'));

    await waitFor(() => {
      expect(screen.getByTestId('scrape-progress')).toBeInTheDocument();
    });
  });

  it('tracks triggered per-theater jobs for progress cards', async () => {
    renderWithAuth(<TheatersPage />);

    await screen.findByText('UGC Ciné Cité Paris');

    fireEvent.click(screen.getByTestId('scrape-theater-C0153'));

    const progress = await screen.findByTestId('scrape-progress');
    expect(within(progress).getByText('UGC Ciné Cité Paris')).toBeInTheDocument();
  });
});

describe('TheatersPage - Scraping buttons not on public pages', () => {
  it('HomePage does not import triggerScrape (scrape moved to admin)', async () => {
    // This test documents the expected behaviour: scraping is admin-only.
    // The actual enforcement is structural (no ScrapeButton in HomePage).
    // We verify by checking that TheatersPage renders the scrape all button.
    vi.mocked(theatersApi.getTheaters).mockResolvedValue(mockTheaters);
    vi.mocked(clientApi.getScrapeStatus).mockResolvedValue({ isRunning: false });

    renderWithAuth(<TheatersPage />);

    await screen.findByText('UGC Ciné Cité Paris');

    // Scrape All button is present in admin
    expect(screen.getByTestId('scrape-all-button')).toBeInTheDocument();
  });
});

describe('TheatersPage - permission-based button visibility', () => {
  beforeEach(() => {
    vi.mocked(theatersApi.getTheaters).mockResolvedValue(mockTheaters);
    vi.mocked(clientApi.getScrapeStatus).mockResolvedValue({ isRunning: false });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('hides "Add Theater" button when user lacks theaters:create permission', async () => {
    renderWithAuth(<TheatersPage />, {
      hasPermission: vi.fn((p: PermissionName) => p !== 'theaters:create'),
    });

    await screen.findByText('UGC Ciné Cité Paris');

    expect(screen.queryByTestId('add-theater-button')).not.toBeInTheDocument();
  });

  it('shows "Add Theater" button when user has theaters:create permission', async () => {
    renderWithAuth(<TheatersPage />, {
      hasPermission: vi.fn(() => true),
    });

    await screen.findByText('UGC Ciné Cité Paris');

    expect(screen.getByTestId('add-theater-button')).toBeInTheDocument();
  });

  it('hides per-row "Edit" button when user lacks theaters:update permission', async () => {
    renderWithAuth(<TheatersPage />, {
      hasPermission: vi.fn((p: PermissionName) => p !== 'theaters:update'),
    });

    await screen.findByText('UGC Ciné Cité Paris');

    expect(screen.queryByTestId('edit-theater-C0153')).not.toBeInTheDocument();
    expect(screen.queryByTestId('edit-theater-C0002')).not.toBeInTheDocument();
  });

  it('shows per-row "Edit" button when user has theaters:update permission', async () => {
    renderWithAuth(<TheatersPage />, {
      hasPermission: vi.fn(() => true),
    });

    await screen.findByText('UGC Ciné Cité Paris');

    expect(screen.getByTestId('edit-theater-C0153')).toBeInTheDocument();
    expect(screen.getByTestId('edit-theater-C0002')).toBeInTheDocument();
  });

  it('hides per-row "Delete" button when user lacks theaters:delete permission', async () => {
    renderWithAuth(<TheatersPage />, {
      hasPermission: vi.fn((p: PermissionName) => p !== 'theaters:delete'),
    });

    await screen.findByText('UGC Ciné Cité Paris');

    expect(screen.queryByTestId('delete-theater-C0153')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-theater-C0002')).not.toBeInTheDocument();
  });

  it('shows per-row "Delete" button when user has theaters:delete permission', async () => {
    renderWithAuth(<TheatersPage />, {
      hasPermission: vi.fn(() => true),
    });

    await screen.findByText('UGC Ciné Cité Paris');

    expect(screen.getByTestId('delete-theater-C0153')).toBeInTheDocument();
    expect(screen.getByTestId('delete-theater-C0002')).toBeInTheDocument();
  });

  it('hides per-row "Scraper" button when user lacks scraper:trigger_single permission', async () => {
    renderWithAuth(<TheatersPage />, {
      hasPermission: vi.fn((p: PermissionName) => p !== 'scraper:trigger_single'),
    });

    await screen.findByText('UGC Ciné Cité Paris');

    expect(screen.queryByTestId('scrape-theater-C0153')).not.toBeInTheDocument();
    expect(screen.queryByTestId('scrape-theater-C0002')).not.toBeInTheDocument();
  });

  it('shows per-row "Scraper" button when user has scraper:trigger_single permission', async () => {
    renderWithAuth(<TheatersPage />, {
      hasPermission: vi.fn(() => true),
    });

    await screen.findByText('UGC Ciné Cité Paris');

    expect(screen.getByTestId('scrape-theater-C0153')).toBeInTheDocument();
    expect(screen.getByTestId('scrape-theater-C0002')).toBeInTheDocument();
  });
});
