import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { getScrapeReports, getScrapeReportById, getReportDetails, resumeScrape } from '../api/client.js';
import type { ScrapeReport, PaginatedResponse } from '../types/index.js';

export interface ReportDetails {
  summary: {
    total_attempts: number;
    successful: number;
    failed: number;
    rate_limited: number;
    not_attempted: number;
  };
  attempts: Record<string, Array<{
    id: string | number;
    theater_id?: string;
    date: string;
    status: 'success' | 'failed' | 'rate_limited' | 'not_attempted' | 'pending';
    movies_scraped?: number;
    showtimes_scraped?: number;
  }>>;
}

export interface UseReportsDataResult {
  reportId: string | null;
  page: number;
  pageSize: number;
  reports: PaginatedResponse<ScrapeReport> | undefined;
  selectedReport: ScrapeReport | undefined;
  reportDetails: ReportDetails | undefined;
  isLoading: boolean;
  isLoadingDetails: boolean;
  error: string | null;
  isResuming: boolean;
  resumeError: Error | null;
  setPage: (page: number) => void;
  resume: (id: number) => void;
  showDetails: boolean;
  toggleShowDetails: () => void;
}

export function useReportsData(): UseReportsDataResult {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [showDetails, setShowDetails] = useState(false);

  const reportId = searchParams.get('reportId');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = 10;

  const reportsQuery = useQuery({
    queryKey: ['reports', page],
    queryFn: () => getScrapeReports({ page, pageSize }),
    enabled: !reportId,
  });

  const reportQuery = useQuery({
    queryKey: ['report', reportId],
    queryFn: () => getScrapeReportById(Number(reportId)),
    enabled: !!reportId,
  });

  const detailsQuery = useQuery({
    queryKey: ['reportDetails', reportId],
    queryFn: () => getReportDetails(Number(reportId)) as Promise<ReportDetails>,
    enabled: !!reportId && showDetails,
  });

  const resumeMutation = useMutation({
    mutationFn: (id: number) => resumeScrape(id),
    onSuccess: (data: { reportId: number }) => {
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
      void queryClient.invalidateQueries({ queryKey: ['report'] });
      setSearchParams({ reportId: data.reportId.toString() });
    },
  });

  const activeQuery = reportId ? reportQuery : reportsQuery;
  const isLoading = activeQuery.isLoading;
  const errorMessage = activeQuery.error instanceof Error ? activeQuery.error.message : null;

  return useMemo(
    () => ({
      reportId,
      page,
      pageSize,
      reports: reportsQuery.data,
      selectedReport: reportQuery.data,
      reportDetails: detailsQuery.data,
      isLoading,
      isLoadingDetails: detailsQuery.isLoading,
      error: errorMessage,
      isResuming: resumeMutation.isPending,
      resumeError: resumeMutation.error,
      setPage: (next: number) => setSearchParams({ page: next.toString() }),
      resume: (id: number) => resumeMutation.mutate(id),
      showDetails,
      toggleShowDetails: () => setShowDetails((prev) => !prev),
    }),
    [
      reportId,
      page,
      pageSize,
      reportsQuery.data,
      reportQuery.data,
      detailsQuery.data,
      detailsQuery.isLoading,
      isLoading,
      errorMessage,
      resumeMutation.isPending,
      resumeMutation.error,
      resumeMutation,
      setSearchParams,
      showDetails,
    ]
  );
}
