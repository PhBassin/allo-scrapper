import type { ScrapeReport } from '../../types/index.js';

/**
 * Explains why a `rate_limited` report stopped. The Resume action lives at
 * report level (`ReportResumeAction`), not in this notice.
 */
export function ReportRateLimitedNotice({ report }: { report: ScrapeReport }) {
  if (report.status !== 'rate_limited') return null;

  return (
    <div className="card p-6 mb-6 border-orange-200 bg-orange-50">
      <h2 className="text-xl font-bold mb-3 text-orange-800">⚠️ Limitation de débit détectée</h2>
      <p className="text-orange-900 mb-3">
        Le scraping a été arrêté automatiquement car le serveur source a renvoyé une erreur HTTP 429 (Too Many Requests).
      </p>
      <p className="text-sm text-orange-800">
        <strong>Que faire ?</strong> Attendez quelques minutes avant de reprendre le rapport :
        la reprise ne relance que les dates qui n'ont pas abouti.
      </p>
    </div>
  );
}
