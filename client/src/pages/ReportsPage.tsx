import { Link } from 'react-router-dom';
import type { ScrapeReport } from '../types/index.js';
import { useReportsData } from '../hooks/useReportsData.js';
import { useDateFormatter, formatDate } from '../utils/reports.js';
import { LoadingSpinner, ErrorMessage } from '../components/ui/PageStates.js';
import { ReportListItem } from './ReportsPage/ReportListItem.js';
import { ReportSummary } from './ReportsPage/ReportSummary.js';
import { ReportRateLimitedNotice } from './ReportsPage/ReportRateLimitedNotice.js';
import { ReportDetailsSection } from './ReportsPage/ReportDetailsSection.js';
import { ReportErrorsSection, ReportProgressLog } from './ReportsPage/ReportExtras.js';

function ReportsBreadcrumb({ reportId }: { reportId: number }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
      <Link to="/admin?tab=rapports" className="hover:text-primary hover:underline">← Rapports</Link>
      <span>/</span>
      <span>Rapport #{reportId}</span>
    </div>
  );
}

function ReportsListView() {
  const { reports, page, isLoading, error, setPage } = useReportsData();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!reports) return null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold">Historique des scrapings</h1>
        <p className="text-gray-600 mt-2">
          Consultez l'historique complet de tous les scrapings effectués
        </p>
      </div>

      {reports.items.length > 0 ? (
        <>
          <div className="space-y-4">
            {reports.items.map((report: ScrapeReport) => (
              <ReportListItem key={report.id} report={report} />
            ))}
          </div>

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

function ReportsDetailView() {
  const {
    selectedReport,
    reportDetails,
    isLoading,
    isLoadingDetails,
    isResuming,
    resumeError,
    showDetails,
    toggleShowDetails,
    resume,
  } = useReportsData();
  const formatter = useDateFormatter();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!selectedReport) return null;

  return (
    <div>
      <ReportsBreadcrumb reportId={selectedReport.id} />

      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Rapport #{selectedReport.id}</h1>
        <p className="text-gray-600">{formatDate(selectedReport.started_at, formatter)}</p>
      </div>

      <ReportSummary report={selectedReport} />

      <ReportRateLimitedNotice
        report={selectedReport}
        isResuming={isResuming}
        resumeError={resumeError}
        showDetails={showDetails}
        onResume={resume}
        onToggleDetails={toggleShowDetails}
      />

      {showDetails && (
        <ReportDetailsSection details={reportDetails} isLoading={isLoadingDetails} />
      )}

      <ReportErrorsSection report={selectedReport} />
      <ReportProgressLog report={selectedReport} />
    </div>
  );
}

export default function ReportsPage() {
  const { reportId } = useReportsData();
  return reportId ? <ReportsDetailView /> : <ReportsListView />;
}
