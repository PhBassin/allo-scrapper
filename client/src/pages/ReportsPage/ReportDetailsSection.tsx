import type { ReportDetails, ScrapeAttempt } from '../../api/reports.js';
import { getAttemptStatusColor, getAttemptStatusLabel, getErrorTypeLabel } from '../../utils/reports.js';

interface TheaterGroup {
  theaterId: string;
  name: string;
  attempts: ScrapeAttempt[];
  successes: number;
  movies: number;
  showtimes: number;
  hasProblems: boolean;
}

function toTheaterGroups(attemptsByTheater: Record<string, ScrapeAttempt[]>): TheaterGroup[] {
  const groups = Object.entries(attemptsByTheater).map(([theaterId, attempts]) => {
    const successful = attempts.filter((a) => a.status === 'success');
    return {
      theaterId,
      name: attempts.find((a) => a.theater_name)?.theater_name ?? theaterId,
      attempts,
      successes: successful.length,
      movies: successful.reduce((sum, a) => sum + (a.movies_scraped ?? 0), 0),
      showtimes: successful.reduce((sum, a) => sum + (a.showtimes_scraped ?? 0), 0),
      hasProblems: successful.length < attempts.length,
    };
  });

  // Theaters with at least one non-success attempt first, then by name.
  return groups.sort(
    (a, b) => Number(b.hasProblems) - Number(a.hasProblems) || a.name.localeCompare(b.name, 'fr')
  );
}

export function ReportDetailsSection({ details, isLoading }: { details?: ReportDetails; isLoading: boolean }) {
  if (!details) {
    return isLoading ? (
      <div className="card p-6 mb-6 text-center">
        <p className="text-gray-600">Chargement des détails...</p>
      </div>
    ) : null;
  }

  const groups = toTheaterGroups(details.attempts);

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

      {groups.length === 0 ? (
        <p className="text-gray-600">Aucune tentative enregistrée pour ce rapport.</p>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <TheaterAttempts key={group.theaterId} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}

function TheaterAttempts({ group }: { group: TheaterGroup }) {
  return (
    <details
      data-testid="theater-attempts"
      open={group.hasProblems}
      className={`border rounded-lg p-4 ${group.hasProblems ? 'border-orange-300' : 'border-gray-200'}`}
    >
      {/* The summary stays `list-item` to keep its disclosure marker. */}
      <summary className="cursor-pointer">
        <span className="inline-flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span data-testid="theater-name" className="font-semibold">{group.name}</span>
          <span data-testid="theater-summary" className="text-sm text-gray-600">
            {group.successes}/{group.attempts.length} dates · {group.movies} films · {group.showtimes} séances
          </span>
        </span>
      </summary>
      <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
        {group.attempts.map((attempt) => (
          <AttemptItem key={attempt.id} attempt={attempt} />
        ))}
      </ul>
    </details>
  );
}

function AttemptItem({ attempt }: { attempt: ScrapeAttempt }) {
  return (
    <li
      data-testid={`attempt-${attempt.date}`}
      className={`p-2 rounded border text-xs ${getAttemptStatusColor(attempt.status)}`}
    >
      <p className="font-semibold">
        {attempt.date} · {getAttemptStatusLabel(attempt.status)}
      </p>
      {attempt.status === 'success' ? (
        <p className="mt-1">
          {attempt.movies_scraped} films · {attempt.showtimes_scraped} séances
        </p>
      ) : (
        <>
          {(attempt.error_type || attempt.http_status_code) && (
            <p className="mt-1">
              {attempt.error_type && getErrorTypeLabel(attempt.error_type)}
              {attempt.error_type && attempt.http_status_code ? ' · ' : ''}
              {attempt.http_status_code ? `HTTP ${attempt.http_status_code}` : ''}
            </p>
          )}
          {attempt.error_message && <p className="mt-1 break-words">{attempt.error_message}</p>}
        </>
      )}
    </li>
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
