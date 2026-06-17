import { Link } from 'react-router-dom';
import type { ScrapeReport } from '../../types/index.js';
import {
  useDateFormatter,
  formatDate,
  formatDuration,
  getStatusColor,
  getStatusLabel,
  getTriggerTypeLabel,
} from '../../utils/reports.js';

export function ReportListItem({ report }: { report: ScrapeReport }) {
  const formatter = useDateFormatter();
  const duration =
    report.completed_at
      ? formatDuration(
          new Date(report.completed_at).getTime() - new Date(report.started_at).getTime()
        )
      : null;

  return (
    <Link
      to={`/admin?tab=rapports&reportId=${report.id}`}
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
              {getTriggerTypeLabel(report.trigger_type)}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            {formatDate(report.started_at, formatter)}
            {duration && ` • Durée: ${duration}`}
          </p>
        </div>
        <div className="flex gap-6 text-sm">
          <div>
            <p className="text-gray-500">Cinémas</p>
            <p className="font-bold text-primary">
              {report.successful_theaters}/{report.total_theaters}
            </p>
          </div>
          {report.total_movies_scraped !== undefined && (
            <>
              <div>
                <p className="text-gray-500">Films</p>
                <p className="font-bold text-primary">{report.total_movies_scraped}</p>
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
  );
}
