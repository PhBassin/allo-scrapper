import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ScrapeButton from './ScrapeButton';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('ScrapeButton', () => {
  let mockOnTrigger: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnTrigger = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should call onTrigger when clicked', async () => {
    mockOnTrigger.mockResolvedValue(undefined);
    render(<ScrapeButton onTrigger={mockOnTrigger} />);

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
    render(<ScrapeButton onTrigger={mockOnTrigger} onScrapeStart={onScrapeStart} />);

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

    render(<ScrapeButton onTrigger={mockOnTrigger} onScrapeStart={onScrapeStart} />);

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

    render(<ScrapeButton onTrigger={mockOnTrigger} />);

    const button = screen.getByRole('button', { name: /Lancer le scraping manuel/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Server exploded')).toBeInTheDocument();
    });
  });
});
