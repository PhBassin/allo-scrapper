import type { ReportDetails } from '../../hooks/useReportsData.js';
import { getAttemptStatusColor } from '../../utils/reports.js';

export function ReportDetailsSection({ details, isLoading }: { details?: ReportDetails; isLoading: boolean }) {
  if (!details) return null;
  return (
    <div className="card p-6 mb-6">
      <h2 className="text-xl font-bold mb-4">Détails des tentatives</h2>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
        <SummaryStat label="Total" value={details.summary.total_attempts} />
        <SummaryStat label="Réussis" value={details.summary.successful} colorClass="text-green-600" />
        <SummaryStat label="Échoués" value={details.summary.failed} colorClass="text-red-600" />
        <SummaryStat label="Rate limités" value={details.summary.rate_limited} colorClass="text-orange-600" />
        <SummaryStat label="Non tentés" value={details.summary.not_attempted} colorClass="text-gray-600" />
      </div>

      <div className="space-y-4">
        {Object.entries(details.attempts).map(([theaterId, attempts]) => (
          <div key={theaterId} className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold mb-3">Cinéma {theaterId}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {attempts.map((attempt) => (
                <div
                  key={attempt.id}
                  className={`p-2 rounded border text-xs ${getAttemptStatusColor(attempt.status)}`}
                >
                  <p className="font-semibold">{attempt.date}</p>
                  <p className="mt-1">{attempt.status}</p>
                  {attempt.status === 'success' && (
                    <p className="mt-1">
                      {attempt.movies_scraped} films, {attempt.showtimes_scraped} séances
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {isLoading && (
        <div className="text-center py-4">
          <p className="text-gray-600">Chargement des détails...</p>
        </div>
      )}
    </div>
  );
}

function SummaryStat({ label, value, colorClass = '' }: { label: string; value: number; colorClass?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-600">{label}</p>
      <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}
