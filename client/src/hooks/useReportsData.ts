import { useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { getScrapeReports, getScrapeReportById, getReportDetails, resumeScrape } from '../api/client.js';
import type { ReportDetails } from '../api/reports.js';
import type { ScrapeReport, PaginatedResponse } from '../types/index.js';

export type { ReportDetails } from '../api/reports.js';

export interface UseReportsDataResult {
  reportId: string | null;
  page: number;
  pageSize: number;
  reports: PaginatedResponse<ScrapeReport> | undefined;
  selectedReport: ScrapeReport | undefined;
  reportDetails: ReportDetails | undefined;
  isLoading: boolean;
  isLoadingDetails: boolean;
  /** Why the report details (attempts, `resumable_count`) could not be loaded. */
  detailsError: string | null;
  error: string | null;
  isResuming: boolean;
  resumeError: Error | null;
  setPage: (page: number) => void;
  resume: (id: number) => void;
}

export function useReportsData(): UseReportsDataResult {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

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
    queryFn: () => getReportDetails(Number(reportId)),
    enabled: !!reportId,
  });

  const resumeMutation = useMutation({
    mutationFn: (id: number) => resumeScrape(id),
    onSuccess: (data: { reportId: number }) => {
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
      void queryClient.invalidateQueries({ queryKey: ['report'] });
      void queryClient.invalidateQueries({ queryKey: ['reportDetails'] });
      // Open the new report, keeping the other params (the admin `tab`).
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('reportId', data.reportId.toString());
        return next;
      });
    },
  });

  // A resume error belongs to the report it was raised on: drop it when the
  // same mounted page switches to another report (e.g. the browser's Back).
  const { reset: resetResume } = resumeMutation;
  useEffect(() => {
    resetResume();
  }, [reportId, resetResume]);

  const activeQuery = reportId ? reportQuery : reportsQuery;
  const isLoading = activeQuery.isLoading;
  const errorMessage = activeQuery.error instanceof Error ? activeQuery.error.message : null;
  const detailsErrorMessage = detailsQuery.error
    ? detailsQuery.error.message || 'Erreur inconnue'
    : null;

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
      detailsError: detailsErrorMessage,
      error: errorMessage,
      isResuming: resumeMutation.isPending,
      resumeError: resumeMutation.error,
      setPage: (next: number) => setSearchParams({ page: next.toString() }),
      resume: (id: number) => resumeMutation.mutate(id),
    }),
    [
      reportId,
      page,
      pageSize,
      reportsQuery.data,
      reportQuery.data,
      detailsQuery.data,
      detailsQuery.isLoading,
      detailsErrorMessage,
      isLoading,
      errorMessage,
      resumeMutation.isPending,
      resumeMutation.error,
      resumeMutation,
      setSearchParams,
    ]
  );
}
