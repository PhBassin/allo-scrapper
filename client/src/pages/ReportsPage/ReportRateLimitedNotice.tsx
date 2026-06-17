import type { ScrapeReport } from '../../types/index.js';

interface Props {
  report: ScrapeReport;
  isResuming: boolean;
  resumeError: Error | null;
  showDetails: boolean;
  onResume: (id: number) => void;
  onToggleDetails: () => void;
}

export function ReportRateLimitedNotice({
  report,
  isResuming,
  resumeError,
  showDetails,
  onResume,
  onToggleDetails,
}: Props) {
  if (report.status !== 'rate_limited') return null;

  return (
    <div className="card p-6 mb-6 border-orange-200 bg-orange-50">
      <h2 className="text-xl font-bold mb-3 text-orange-800">⚠️ Limitation de débit détectée</h2>
      <p className="text-orange-900 mb-3">
        Le scraping a été arrêté automatiquement car le serveur source a renvoyé une erreur HTTP 429 (Too Many Requests).
      </p>
      <p className="text-sm text-orange-800 mb-4">
        <strong>Que faire ?</strong> Attendez quelques minutes avant de relancer un nouveau scraping.
        Les cinémas non traités seront automatiquement inclus lors de la prochaine exécution.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => onResume(report.id)}
          disabled={isResuming}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
        >
          {isResuming ? 'Reprise en cours...' : '🔄 Reprendre le scraping'}
        </button>
        <button
          onClick={onToggleDetails}
          className="px-4 py-2 bg-white text-orange-800 border border-orange-300 rounded-lg hover:bg-orange-100 font-semibold"
        >
          {showDetails ? 'Masquer les détails' : 'Voir les détails'}
        </button>
      </div>
      {resumeError && (
        <p className="mt-3 text-sm text-red-600">
          ❌ Erreur lors de la reprise: {resumeError instanceof Error ? resumeError.message : 'Erreur inconnue'}
        </p>
      )}
    </div>
  );
}
