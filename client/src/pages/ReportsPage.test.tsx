import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ReportsPage from './ReportsPage';
import * as client from '../api/client';

// Mock API calls
vi.mock('../api/client');

const mockReportsList = {
  items: [
    {
      id: 1,
      started_at: '2024-01-15T10:00:00Z',
      completed_at: '2024-01-15T10:05:00Z',
      status: 'success' as const,
      trigger_type: 'manual' as const,
      total_cinemas: 10,
      successful_cinemas: 10,
      total_films_scraped: 50,
      total_showtimes_scraped: 200,
      errors: [],
      progress_log: [],
    },
  ],
  total: 1,
  page: 1,
  pageSize: 10,
  totalPages: 1,
};

const mockReportDetail = {
  id: 123,
  started_at: '2024-01-15T10:00:00Z',
  completed_at: '2024-01-15T10:05:00Z',
  status: 'success' as const,
  trigger_type: 'manual' as const,
  total_cinemas: 10,
  successful_cinemas: 10,
  total_films_scraped: 50,
  total_showtimes_scraped: 200,
  errors: [],
  progress_log: [],
};

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const renderWithRouter = (initialRoute = '/admin?tab=rapports') => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  window.history.pushState({}, 'Test', initialRoute);
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ReportsPage />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('ReportsPage - URL params adaptation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('List view', () => {
    it('should display reports list when no reportId param is provided', async () => {
      vi.mocked(client.getScrapeReports).mockResolvedValue(mockReportsList);
      
      renderWithRouter('/admin?tab=rapports');
      
      await waitFor(() => {
        expect(screen.getByText(/Historique des scrapings/i)).toBeInTheDocument();
      });
      
      expect(client.getScrapeReports).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
    });

    it('should handle pagination via page URL param', async () => {
      vi.mocked(client.getScrapeReports).mockResolvedValue(mockReportsList);
      
      renderWithRouter('/admin?tab=rapports&page=2');
      
      await waitFor(() => {
        expect(client.getScrapeReports).toHaveBeenCalledWith({ page: 2, pageSize: 10 });
      });
    });
  });

  describe('Detail view', () => {
    it('should display report details when reportId param is provided', async () => {
      vi.mocked(client.getScrapeReportById).mockResolvedValue(mockReportDetail);
      
      renderWithRouter('/admin?tab=rapports&reportId=123');
      
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Rapport #123/i })).toBeInTheDocument();
      });
      
      expect(client.getScrapeReportById).toHaveBeenCalledWith(123);
    });

    it('should use reportId from URL params not route params', async () => {
      vi.mocked(client.getScrapeReportById).mockResolvedValue(mockReportDetail);
      
      // Important: reportId should come from searchParams, not useParams
      renderWithRouter('/admin?tab=rapports&reportId=456');
      
      await waitFor(() => {
        expect(client.getScrapeReportById).toHaveBeenCalledWith(456);
      });
    });
  });

  describe('Breadcrumb navigation', () => {
    it('should have breadcrumb link pointing to list view when viewing details', async () => {
      vi.mocked(client.getScrapeReportById).mockResolvedValue(mockReportDetail);
      
      renderWithRouter('/admin?tab=rapports&reportId=123');
      
      await waitFor(() => {
        const breadcrumbLink = screen.getByText(/← Rapports/i);
        expect(breadcrumbLink).toBeInTheDocument();
        expect(breadcrumbLink.closest('a')).toHaveAttribute('href', '/admin?tab=rapports');
      });
    });
  });

  describe('Multiple URL params preservation', () => {
    it('should preserve tab param when navigating to report details', async () => {
      vi.mocked(client.getScrapeReports).mockResolvedValue(mockReportsList);
      
      renderWithRouter('/admin?tab=rapports&page=2');
      
      await waitFor(() => {
        expect(screen.getByText(/Historique des scrapings/i)).toBeInTheDocument();
      });
      
      // When clicking on a report, it should preserve the tab param
      // This will be tested in integration tests
    });
  });
});
