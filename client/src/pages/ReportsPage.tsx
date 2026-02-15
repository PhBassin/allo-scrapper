import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getScrapeReports, getScrapeReportById } from '../api/client';
import type { ScrapeReport, PaginatedResponse } from '../types';

export default function ReportsPage() {
  const { reportId } = useParams<{ reportId?: string }>();
  const [reports, setReports] = useState<PaginatedResponse<ScrapeReport> | null>(null);
  const [selectedReport, setSelectedReport] = useState<ScrapeReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const loadReports = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        if (reportId) {
          // Load specific report
          const report = await getScrapeReportById(Number(reportId));
          setSelectedReport(report);
        } else {
          // Load reports list
          const data = await getScrapeReports({ page, pageSize });
          setReports(data);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load reports');
      } finally {
        setIsLoading(false);
      }
    };

    loadReports();
  }, [reportId, page]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'partial_success':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'running':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'success':
        return 'Succès';
      case 'partial_success':
        return 'Succès partiel';
      case 'failed':
        return 'Échec';
      case 'running':
        return 'En cours';
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 className="text-xl font-bold text-red-800 mb-2">Erreur</h2>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  // Detail View
  if (selectedReport) {
    return (
      <div>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <Link to="/reports" className="hover:text-primary hover:underline">← Rapports</Link>
          <span>/</span>
          <span>Rapport #{selectedReport.id}</span>
        </div>

        {/* Report Header */}
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Rapport #{selectedReport.id}</h1>
          <p className="text-gray-600">
            {formatDate(selectedReport.started_at)}
          </p>
        </div>

        {/* Report Summary Card */}
        <div className="card p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Statut</p>
              <span className={`inline-block px-3 py-1 rounded border font-semibold text-sm ${getStatusColor(selectedReport.status)}`}>
                {getStatusLabel(selectedReport.status)}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Type</p>
              <p className="font-semibold">{selectedReport.trigger_type === 'manual' ? 'Manuel' : 'Automatique (cron)'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Durée</p>
              <p className="font-semibold">
                {selectedReport.completed_at ? formatDuration(new Date(selectedReport.completed_at).getTime() - new Date(selectedReport.started_at).getTime()) : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Cinémas traités</p>
              <p className="font-semibold">
                {selectedReport.successful_cinemas} / {selectedReport.total_cinemas}
              </p>
            </div>
          </div>

          {selectedReport.total_films_scraped !== undefined && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600 mb-2">Statistiques</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Films</p>
                  <p className="text-xl font-bold text-primary">{selectedReport.total_films_scraped}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Séances</p>
                  <p className="text-xl font-bold text-primary">{selectedReport.total_showtimes_scraped}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Errors Section */}
        {selectedReport.errors && selectedReport.errors.length > 0 && (
          <div className="card p-6 mb-6 border-red-200">
            <h2 className="text-xl font-bold mb-4 text-red-800">Erreurs ({selectedReport.errors.length})</h2>
            <div className="space-y-3">
              {selectedReport.errors.map((err, index) => (
                <div key={index} className="bg-red-50 border border-red-200 rounded p-3">
                  <p className="font-semibold text-red-900">{err.cinema_name}</p>
                  <p className="text-sm text-red-700 mt-1">{err.error}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress Log */}
        {selectedReport.progress_log && selectedReport.progress_log.length > 0 && (
          <div className="card p-6">
            <h2 className="text-xl font-bold mb-4">Journal de progression</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {selectedReport.progress_log.map((log, index) => (
                <div key={index} className="text-sm bg-gray-50 p-2 rounded font-mono">
                  <span className="text-gray-500">[{log.type}]</span> {JSON.stringify(log)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // List View
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold">Historique des scrapings</h1>
        <p className="text-gray-600 mt-2">
          Consultez l'historique complet de tous les scrapings effectués
        </p>
      </div>

      {reports && reports.items.length > 0 ? (
        <>
          <div className="space-y-4">
            {reports.items.map((report: ScrapeReport) => (
              <Link
                key={report.id}
                to={`/reports/${report.id}`}
                className="card p-5 block hover:shadow-lg transition border border-gray-100"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-grow">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold">Rapport #{report.id}</h3>
                      <span className={`px-2 py-1 rounded border text-xs font-semibold ${getStatusColor(report.status)}`}>
                        {getStatusLabel(report.status)}
                      </span>
                      <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
                        {report.trigger_type === 'manual' ? 'Manuel' : 'Cron'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {formatDate(report.started_at)}
                      {report.completed_at && ` • Durée: ${formatDuration(new Date(report.completed_at).getTime() - new Date(report.started_at).getTime())}`}
                    </p>
                  </div>
                  <div className="flex gap-6 text-sm">
                    <div>
                      <p className="text-gray-500">Cinémas</p>
                      <p className="font-bold text-primary">
                        {report.successful_cinemas}/{report.total_cinemas}
                      </p>
                    </div>
                    {report.total_films_scraped !== undefined && (
                      <>
                        <div>
                          <p className="text-gray-500">Films</p>
                          <p className="font-bold text-primary">{report.total_films_scraped}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Séances</p>
                          <p className="font-bold text-primary">{report.total_showtimes_scraped}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {report.errors && report.errors.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-sm text-red-600">
                      ⚠️ {report.errors.length} erreur(s) détectée(s)
                    </p>
                  </div>
                )}
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {reports.totalPages > 1 && (
            <div className="mt-8 flex justify-center items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Précédent
              </button>
              <span className="px-4 py-2 text-gray-600">
                Page {page} sur {reports.totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(reports.totalPages, page + 1))}
                disabled={page === reports.totalPages}
                className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Suivant
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="card p-8 text-center">
          <p className="text-gray-600 text-lg">Aucun rapport disponible</p>
          <p className="text-sm text-gray-500 mt-2">
            Les rapports apparaîtront ici après avoir effectué un scraping
          </p>
        </div>
      )}
    </div>
  );
}
