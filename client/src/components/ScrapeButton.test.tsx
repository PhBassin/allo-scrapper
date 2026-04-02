import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ScrapeButton from './ScrapeButton';
import { vi, describe, it, expect, beforeEach, afterEach, type Mock } from 'vitest';
import { AuthContext } from '../contexts/AuthContext';
import type { PermissionName } from '../types/role';

const mockAuthContext = {
  isAuthenticated: true,
  token: 'mock-token',
  user: { id: 1, username: 'testuser', role_id: 2, role_name: 'operator', is_system_role: true, permissions: ['scraper:trigger'] as PermissionName[] },
  login: vi.fn(),
  logout: vi.fn(),
  isAdmin: false,
  isSuperadmin: false,
  hasPermission: vi.fn((p: PermissionName) => p === 'scraper:trigger'),
};

const renderWithAuth = (ui: React.ReactElement) => {
  return render(
    <AuthContext.Provider value={mockAuthContext}>
      {ui}
    </AuthContext.Provider>
  );
};


describe('ScrapeButton', () => {
  let mockOnTrigger: Mock<() => Promise<void>>;

  beforeEach(() => {
    mockOnTrigger = vi.fn<() => Promise<void>>();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should call onTrigger when clicked', async () => {
    mockOnTrigger.mockResolvedValue(undefined);
    renderWithAuth(<ScrapeButton onTrigger={mockOnTrigger} />);

    const button = screen.getByRole('button', { name: /Lancer le scraping manuel/i });
    fireEvent.click(button);

    expect(mockOnTrigger).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText('Scraping démarré !')).toBeInTheDocument();
    });
  });

  it('should call onScrapeStart on success', async () => {
    mockOnTrigger.mockResolvedValue(undefined);
    const onScrapeStart = vi.fn();
    renderWithAuth(<ScrapeButton onTrigger={mockOnTrigger} onScrapeStart={onScrapeStart} />);

    const button = screen.getByRole('button', { name: /Lancer le scraping manuel/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(onScrapeStart).toHaveBeenCalled();
    });
  });

  it('should handle 409 Conflict by calling onScrapeStart (resuming)', async () => {
    const error = {
      response: {
        status: 409,
        data: { error: 'Already running' }
      }
    };
    mockOnTrigger.mockRejectedValue(error);
    const onScrapeStart = vi.fn();

    renderWithAuth(<ScrapeButton onTrigger={mockOnTrigger} onScrapeStart={onScrapeStart} />);

    const button = screen.getByRole('button', { name: /Lancer le scraping manuel/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(onScrapeStart).toHaveBeenCalled();
    });
    // Should NOT show error message
    expect(screen.queryByText('Un scraping est déjà en cours')).not.toBeInTheDocument();
  });

  it('should show error message for other errors', async () => {
    const error = {
      response: {
        status: 500,
        data: { error: 'Server exploded' }
      }
    };
    mockOnTrigger.mockRejectedValue(error);

    renderWithAuth(<ScrapeButton onTrigger={mockOnTrigger} />);

    const button = screen.getByRole('button', { name: /Lancer le scraping manuel/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Server exploded')).toBeInTheDocument();
    });
  });

  it('should have cursor-pointer class when enabled', () => {
    mockOnTrigger.mockResolvedValue(undefined);
    renderWithAuth(<ScrapeButton onTrigger={mockOnTrigger} testId="scrape-button" />);

    const button = screen.getByTestId('scrape-button');
    expect(button).toHaveClass('cursor-pointer');
  });

  it('should have cursor-not-allowed class when loading', async () => {
    mockOnTrigger.mockImplementation(() => new Promise(() => {})); // Never resolves
    renderWithAuth(<ScrapeButton onTrigger={mockOnTrigger} testId="scrape-button" />);

    const button = screen.getByTestId('scrape-button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toHaveClass('cursor-not-allowed');
    });
  });

  it('should NOT render when user lacks scraper:trigger permission', () => {
    const noPermContext = {
      ...mockAuthContext,
      hasPermission: vi.fn(() => false),
    };

    render(
      <AuthContext.Provider value={noPermContext}>
        <ScrapeButton onTrigger={mockOnTrigger} testId="scrape-button" />
      </AuthContext.Provider>
    );

    expect(screen.queryByTestId('scrape-button')).not.toBeInTheDocument();
  });

  it('should render when user has scraper:trigger permission', () => {
    mockOnTrigger.mockResolvedValue(undefined);
    renderWithAuth(<ScrapeButton onTrigger={mockOnTrigger} testId="scrape-button" />);

    expect(screen.getByTestId('scrape-button')).toBeInTheDocument();
  });

  it('should NOT render when user is unauthenticated', () => {
    const unauthContext = {
      ...mockAuthContext,
      isAuthenticated: false,
      hasPermission: vi.fn(() => false),
    };

    render(
      <AuthContext.Provider value={unauthContext}>
        <ScrapeButton onTrigger={mockOnTrigger} testId="scrape-button" />
      </AuthContext.Provider>
    );

    expect(screen.queryByTestId('scrape-button')).not.toBeInTheDocument();
  });
});
