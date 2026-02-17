import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ScrapeButton from './ScrapeButton';
import * as clientApi from '../api/client';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock the API client
vi.mock('../api/client', () => ({
  triggerScrape: vi.fn(),
}));

describe('ScrapeButton', () => {
  let mockTriggerScrape: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockTriggerScrape = vi.fn();
    (clientApi.triggerScrape as any) = mockTriggerScrape;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should call triggerScrape when clicked', async () => {
    mockTriggerScrape.mockResolvedValue({});
    render(<ScrapeButton />);

    const button = screen.getByRole('button', { name: /Lancer le scraping manuel/i });
    fireEvent.click(button);

    expect(mockTriggerScrape).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText('Scraping démarré !')).toBeInTheDocument();
    });
  });

  it('should call onScrapeStart on success', async () => {
    mockTriggerScrape.mockResolvedValue({});
    const onScrapeStart = vi.fn();
    render(<ScrapeButton onScrapeStart={onScrapeStart} />);

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
    mockTriggerScrape.mockRejectedValue(error);
    const onScrapeStart = vi.fn();

    render(<ScrapeButton onScrapeStart={onScrapeStart} />);

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
    mockTriggerScrape.mockRejectedValue(error);

    render(<ScrapeButton />);

    const button = screen.getByRole('button', { name: /Lancer le scraping manuel/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Server exploded')).toBeInTheDocument();
    });
  });
});
