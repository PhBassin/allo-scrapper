import type { ScrapeReport } from '../../types/index.js';
import { getStatusColor, getStatusLabel, getFullTriggerTypeLabel } from '../../utils/reports.js';

export function ReportSummary({ report }: { report: ScrapeReport }) {
  const durationMs =
    report.completed_at
      ? new Date(report.completed_at).getTime() - new Date(report.started_at).getTime()
      : null;

  return (
    <div className="card p-6 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <p className="text-sm text-gray-600 mb-1">Statut</p>
          <span className={`inline-block px-3 py-1 rounded border font-semibold text-sm ${getStatusColor(report.status)}`}>
            {getStatusLabel(report.status)}
          </span>
        </div>
        <div>
          <p className="text-sm text-gray-600 mb-1">Type</p>
          <p className="font-semibold">{getFullTriggerTypeLabel(report.trigger_type)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600 mb-1">Durée</p>
          <p className="font-semibold">{durationMs != null ? formatDurationSimple(durationMs) : 'N/A'}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600 mb-1">Cinémas traités</p>
          <p className="font-semibold">
            {report.successful_theaters} / {report.total_theaters}
          </p>
        </div>
      </div>

      {report.total_movies_scraped !== undefined && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600 mb-2">Statistiques</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500">Films</p>
              <p className="text-xl font-bold text-primary">{report.total_movies_scraped}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Séances</p>
              <p className="text-xl font-bold text-primary">{report.total_showtimes_scraped}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDurationSimple(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${seconds}s`;
}
