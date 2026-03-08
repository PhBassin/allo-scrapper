import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ScrapeButton from './ScrapeButton';
import { vi, describe, it, expect, beforeEach, afterEach, type Mock } from 'vitest';
import { AuthContext } from '../contexts/AuthContext';

const mockAuthContext = {
  isAuthenticated: true,
  token: 'mock-token',
  user: { id: 1, username: 'testuser', role: 'user' as const },
  login: vi.fn(),
  logout: vi.fn(),
  isAdmin: false,
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
});
