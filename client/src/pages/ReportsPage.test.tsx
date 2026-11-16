import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
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
      total_theaters: 10,
      successful_theaters: 10,
      total_movies_scraped: 50,
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
  total_theaters: 10,
  successful_theaters: 10,
  total_movies_scraped: 50,
  total_showtimes_scraped: 200,
  errors: [],
  progress_log: [],
};

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent } from '@testing-library/react';
import { AuthContext } from '../contexts/AuthContext';
import type { PermissionName } from '../types/role';
import type { ReportDetails } from '../api/reports';

const emptyDetails = (reportId: number): ReportDetails => ({
  report: { ...mockReportDetail, id: reportId },
  attempts: {},
  summary: { total_attempts: 0, successful: 0, failed: 0, rate_limited: 0, not_attempted: 0, pending: 0 },
  resumable_count: 0,
});

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
    vi.mocked(client.getReportDetails).mockImplementation(async (id: number) => emptyDetails(id));
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

describe('ReportsPage - resuming a report shaped like #20', () => {
  const report20 = {
    ...mockReportDetail,
    id: 20,
    status: 'partial_success' as const,
    trigger_type: 'cron' as const,
    total_theaters: 3,
    successful_theaters: 2,
    failed_theaters: 1,
  };

  const attempt = (id: number, theater_id: string, theater_name: string, date: string, status: 'success' | 'rate_limited' | 'not_attempted') => ({
    id,
    report_id: 20,
    theater_id,
    theater_name,
    date,
    status,
    error_type: status === 'rate_limited' ? 'http_429' : null,
    error_message: status === 'rate_limited' ? 'HTTP 429 Too Many Requests' : null,
    http_status_code: status === 'rate_limited' ? 429 : null,
    movies_scraped: status === 'success' ? 5 : 0,
    showtimes_scraped: status === 'success' ? 15 : 0,
    attempted_at: '2026-03-10T03:00:00Z',
  });

  const details20: ReportDetails = {
    report: report20,
    attempts: {
      C0001: [attempt(1, 'C0001', 'Le Champo', '2026-03-10', 'success'), attempt(2, 'C0001', 'Le Champo', '2026-03-11', 'success')],
      C0074: [attempt(3, 'C0074', 'Reflet Médicis', '2026-03-10', 'rate_limited'), attempt(4, 'C0074', 'Reflet Médicis', '2026-03-11', 'not_attempted')],
      C0099: [attempt(5, 'C0099', 'Écoles Cinéma Club', '2026-03-10', 'not_attempted'), attempt(6, 'C0099', 'Écoles Cinéma Club', '2026-03-11', 'not_attempted')],
    },
    summary: { total_attempts: 6, successful: 2, failed: 0, rate_limited: 1, not_attempted: 3, pending: 0 },
    resumable_count: 4,
  };

  const renderAs = (permissions: PermissionName[]) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    window.history.pushState({}, 'Test', '/admin?tab=rapports&reportId=20');
    return render(
      <AuthContext.Provider
        value={{
          isAuthenticated: true,
          user: { id: 1, username: 'op', role_id: 2, role_name: 'operator', is_system_role: true, permissions },
          isAdmin: false,
          hasPermission: (p: PermissionName) => permissions.includes(p),
          login: vi.fn(),
          logout: vi.fn(),
        }}
      >
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <ReportsPage />
          </BrowserRouter>
        </QueryClientProvider>
      </AuthContext.Provider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(client.getScrapeReportById).mockImplementation(async (id: number) =>
      id === 20 ? report20 : { ...report20, id, status: 'running' as const }
    );
    vi.mocked(client.getReportDetails).mockImplementation(async (id: number) =>
      id === 20 ? details20 : emptyDetails(id)
    );
  });

  it('offers the resume of the 4 pending dates and shows the details without a toggle', async () => {
    renderAs(['scraper:trigger', 'reports:view']);

    expect(await screen.findByRole('button', { name: 'Reprendre (4 dates)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Détails des tentatives' })).toBeInTheDocument();
    expect(screen.getByText(/Limite de débit \(429\)/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Voir les détails/ })).not.toBeInTheDocument();
  });

  it('resumes the report on click and opens the new report', async () => {
    vi.mocked(client.resumeScrape).mockResolvedValue({ reportId: 21, parentReportId: 20, pendingAttempts: 4, message: 'queued' });
    renderAs(['scraper:trigger', 'reports:view']);

    fireEvent.click(await screen.findByRole('button', { name: 'Reprendre (4 dates)' }));

    await waitFor(() => expect(client.resumeScrape).toHaveBeenCalledWith(20));
    await waitFor(() => expect(screen.getByRole('heading', { name: /Rapport #21/ })).toBeInTheDocument());
    expect(new URLSearchParams(window.location.search).get('tab')).toBe('rapports');
  });

  it('shows the error when the resume request fails', async () => {
    vi.mocked(client.resumeScrape).mockRejectedValue(new Error('Network error'));
    renderAs(['scraper:trigger', 'reports:view']);

    fireEvent.click(await screen.findByRole('button', { name: 'Reprendre (4 dates)' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Network error');
    expect(screen.getByRole('heading', { name: /Rapport #20/ })).toBeInTheDocument();
  });

  it('says the details could not be loaded when their request fails', async () => {
    vi.mocked(client.getReportDetails).mockRejectedValue(new Error('Request failed with status code 500'));
    renderAs(['scraper:trigger', 'reports:view']);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impossible de charger les détails des tentatives : Request failed with status code 500'
    );
    expect(screen.getByRole('heading', { name: /Rapport #20/ })).toBeInTheDocument();
  });

  it("does not carry a failed resume's error over to another report", async () => {
    vi.mocked(client.resumeScrape).mockRejectedValue(new Error('Network error'));
    vi.mocked(client.getScrapeReportById).mockImplementation(async (id: number) => ({ ...report20, id }));
    vi.mocked(client.getReportDetails).mockImplementation(async (id: number) => ({
      ...details20,
      report: { ...report20, id },
    }));
    renderAs(['scraper:trigger', 'reports:view']);

    fireEvent.click(await screen.findByRole('button', { name: 'Reprendre (4 dates)' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Network error');

    // The browser's Back button: same mounted page, another report id.
    act(() => {
      window.history.pushState({}, 'Test', '/admin?tab=rapports&reportId=19');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(await screen.findByRole('heading', { name: /Rapport #19/ })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Reprendre (4 dates)' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not offer the resume without scraper:trigger', async () => {
    renderAs(['reports:view']);

    expect(await screen.findByRole('heading', { name: 'Détails des tentatives' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reprendre/ })).not.toBeInTheDocument();
  });

  it('keeps the 429 notice of a rate_limited report as an explanation only', async () => {
    vi.mocked(client.getScrapeReportById).mockResolvedValue({ ...report20, status: 'rate_limited' });
    renderAs(['scraper:trigger', 'reports:view']);

    const notice = await screen.findByText(/Limitation de débit détectée/);
    const card = notice.closest('div')!;
    expect(card.querySelector('button')).toBeNull();
    expect(await screen.findByRole('button', { name: 'Reprendre (4 dates)' })).toBeInTheDocument();
  });
});
