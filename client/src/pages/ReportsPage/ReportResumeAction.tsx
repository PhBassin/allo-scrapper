import { useContext } from 'react';
import { AuthContext } from '../../contexts/AuthContext';

interface Props {
  reportId: number;
  reportStatus: string;
  /** Attempts a Resume would re-scrape (`resumable_count` of the report details). */
  resumableCount: number;
  isResuming: boolean;
  resumeError: Error | null;
  onResume: (id: number) => void;
}

function resumeLabel(count: number): string {
  return `Reprendre (${count} ${count === 1 ? 'date' : 'dates'})`;
}

/**
 * Report-level Resume action. Offered whenever the report has resumable
 * attempts and the user may trigger scrapes, whatever the report's final
 * status — but not while the run is still in progress.
 */
export function ReportResumeAction({
  reportId,
  reportStatus,
  resumableCount,
  isResuming,
  resumeError,
  onResume,
}: Props) {
  const { isAuthenticated, hasPermission } = useContext(AuthContext);

  if (!isAuthenticated || !hasPermission('scraper:trigger')) return null;
  if (resumableCount <= 0 || reportStatus === 'running') return null;

  return (
    <div className="flex flex-col items-start md:items-end gap-2">
      <button
        type="button"
        onClick={() => onResume(reportId)}
        disabled={isResuming}
        className="px-4 py-2 bg-primary hover:bg-yellow-500 text-black rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
      >
        {isResuming ? 'Reprise en cours...' : resumeLabel(resumableCount)}
      </button>
      {resumeError && (
        <p role="alert" className="text-sm text-red-600">
          Erreur lors de la reprise : {resumeError.message || 'Erreur inconnue'}
        </p>
      )}
    </div>
  );
}
