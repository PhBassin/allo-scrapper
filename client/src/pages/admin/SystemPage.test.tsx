import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import SystemPage from './SystemPage';
import { AuthContext } from '../../contexts/AuthContext';
import * as systemApi from '../../api/system';

// Mock API modules
vi.mock('../../api/system', async () => {
  const actual = await vi.importActual('../../api/system');
  return {
    ...actual,
    getSystemInfo: vi.fn(),
    getMigrations: vi.fn(),
    getSystemHealth: vi.fn(),
  };
});

const mockSystemInfo = {
  app: {
    version: '1.0.0',
    environment: 'test',
    nodeVersion: 'v20.0.0',
    buildDate: '2024-01-01T00:00:00.000Z',
  },
  server: {
    platform: 'linux',
    arch: 'x64',
    uptime: 3600,
    memoryUsage: {
      heapUsed: '100 MB',
      heapTotal: '200 MB',
      rss: '150 MB',
    },
  },
  database: {
    size: '50 MB',
    tables: 10,
    cinemas: 5,
    films: 100,
    showtimes: 500,
  },
};

const mockMigrations = {
  total: 5,
  applied: [
    { version: '001', appliedAt: '2024-01-01T00:00:00.000Z', status: 'applied' },
    { version: '002', appliedAt: '2024-01-02T00:00:00.000Z', status: 'applied' },
  ],
  pending: [],
};

const mockHealth = {
  status: 'healthy' as const,
  checks: {
    database: true,
    migrations: true,
  },
  uptime: 3600,
  scrapers: {
    activeJobs: 0,
    totalCinemas: 5,
  },
};

const mockAuthContext = {
  isAuthenticated: true,
  token: 'mock-token',
  user: {
    id: 1,
    username: 'admin',
    role_id: 1,
    role_name: 'admin',
    is_system_role: true,
    permissions: ['system:info', 'system:health', 'system:migrations'],
  },
  login: vi.fn(),
  logout: vi.fn(),
  isAdmin: true,
  hasPermission: vi.fn<(p: string) => boolean>(() => true),
};

const renderWithAuth = (ui: React.ReactElement, authOverrides?: Partial<typeof mockAuthContext>) =>
  render(
    <AuthContext.Provider value={{ ...mockAuthContext, ...authOverrides }}>
      {ui}
    </AuthContext.Provider>
  );

describe('SystemPage', () => {
  beforeEach(() => {
    vi.mocked(systemApi.getSystemInfo).mockResolvedValue(mockSystemInfo);
    vi.mocked(systemApi.getMigrations).mockResolvedValue(mockMigrations);
    vi.mocked(systemApi.getSystemHealth).mockResolvedValue(mockHealth);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial Rendering', () => {
    it('should render page title', async () => {
      renderWithAuth(<SystemPage />);

      expect(screen.getByRole('heading', { name: /system information/i })).toBeInTheDocument();
    });

    it('should display loading state initially', () => {
      renderWithAuth(<SystemPage />);

      expect(screen.getByText(/loading system information/i)).toBeInTheDocument();
    });

    it('should fetch all data on mount when user has all permissions', async () => {
      renderWithAuth(<SystemPage />);

      await waitFor(() => {
        expect(systemApi.getSystemInfo).toHaveBeenCalled();
        expect(systemApi.getMigrations).toHaveBeenCalled();
        expect(systemApi.getSystemHealth).toHaveBeenCalled();
      });
    });
  });

  describe('permission-based section visibility', () => {
    it('hides System Info grid when user lacks system:info permission', async () => {
      renderWithAuth(<SystemPage />, {
        hasPermission: vi.fn((p: string) => p !== 'system:info'),
      });

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      expect(screen.queryByTestId('system-info-grid')).not.toBeInTheDocument();
    });

    it('shows System Info grid when user has system:info permission', async () => {
      renderWithAuth(<SystemPage />, {
        hasPermission: vi.fn(() => true),
      });

      await waitFor(() => {
        expect(screen.getByTestId('system-info-grid')).toBeInTheDocument();
      });
    });

    it('hides Health Status card when user lacks system:health permission', async () => {
      renderWithAuth(<SystemPage />, {
        hasPermission: vi.fn((p: string) => p !== 'system:health'),
      });

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      expect(screen.queryByTestId('health-status-card')).not.toBeInTheDocument();
    });

    it('shows Health Status card when user has system:health permission', async () => {
      renderWithAuth(<SystemPage />, {
        hasPermission: vi.fn(() => true),
      });

      await waitFor(() => {
        expect(screen.getByTestId('health-status-card')).toBeInTheDocument();
      });
    });

    it('hides Migrations table when user lacks system:migrations permission', async () => {
      renderWithAuth(<SystemPage />, {
        hasPermission: vi.fn((p: string) => p !== 'system:migrations'),
      });

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      expect(screen.queryByTestId('migrations-table')).not.toBeInTheDocument();
    });

    it('shows Migrations table when user has system:migrations permission', async () => {
      renderWithAuth(<SystemPage />, {
        hasPermission: vi.fn(() => true),
      });

      await waitFor(() => {
        expect(screen.getByTestId('migrations-table')).toBeInTheDocument();
      });
    });
  });

  describe('permission-based API calls', () => {
    it('does not call getSystemInfo when user lacks system:info permission', async () => {
      renderWithAuth(<SystemPage />, {
        hasPermission: vi.fn((p: string) => p !== 'system:info'),
      });

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      expect(systemApi.getSystemInfo).not.toHaveBeenCalled();
    });

    it('does not call getSystemHealth when user lacks system:health permission', async () => {
      renderWithAuth(<SystemPage />, {
        hasPermission: vi.fn((p: string) => p !== 'system:health'),
      });

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      expect(systemApi.getSystemHealth).not.toHaveBeenCalled();
    });

    it('does not call getMigrations when user lacks system:migrations permission', async () => {
      renderWithAuth(<SystemPage />, {
        hasPermission: vi.fn((p: string) => p !== 'system:migrations'),
      });

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      expect(systemApi.getMigrations).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should display error message if fetching data fails', async () => {
      vi.mocked(systemApi.getSystemInfo).mockRejectedValue(new Error('Failed to fetch'));

      renderWithAuth(<SystemPage />);

      await waitFor(() => {
        expect(screen.getByText(/failed to fetch/i)).toBeInTheDocument();
      });
    });
  });
});
