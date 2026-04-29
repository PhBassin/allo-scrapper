import { useScrapeProgress, type TrackedScrapeJob } from '../hooks/useScrapeProgress';
import type { ProgressEvent } from '../types';

export interface ScrapeProgressProps {
  onComplete?: (success: boolean) => void;
  trackedJobs?: TrackedScrapeJob[];
}

export default function ScrapeProgress({ onComplete, trackedJobs = [] }: ScrapeProgressProps = {}) {
  const { events, latestEvent, jobs, error, connectionStatus } = useScrapeProgress(onComplete, trackedJobs);

  const hasTrackedJobs = jobs.length > 0;
  const isReconnecting = connectionStatus === 'reconnecting';
  const isDisconnected = connectionStatus === 'disconnected';

  // Only show the pure connecting state when we have neither SSE events nor
  // placeholder jobs from trigger responses. Pending tracked jobs should stay
  // visible before the first SSE event arrives.
  if (events.length === 0 && !hasTrackedJobs && !isReconnecting && !isDisconnected) {
    return (
      <div className="border-2 rounded-lg p-6 shadow-lg bg-white border-primary" data-testid="scrape-progress">
        <div className="flex items-center gap-3">
          <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full"></div>
          <h3 className="text-lg font-bold text-gray-900">Connexion en cours...</h3>
        </div>
      </div>
    );
  }

  // Derive state from events
  const startedEvent = events.find((e): e is Extract<ProgressEvent, { type: 'started' }> => e.type === 'started');

  // ⚡ PERFORMANCE: Use a single pass iteration to compute counts instead of multiple
  // .filter().length calls to avoid allocating intermediate arrays and O(M*N) operations
  let processedCinemas = 0;
  let totalFilms = 0;
  let processedFilms = 0;

  for (let i = 0; i < events.length; i++) {
    const type = events[i].type;
    if (type === 'cinema_completed') {
      processedCinemas++;
    } else if (type === 'film_started') {
      totalFilms++;
    } else if (type === 'film_completed') {
      processedFilms++;
    }
  }

  const totalCinemas = startedEvent?.total_cinemas || 0;

  // Get current cinema/film from latest event
  const currentCinema = latestEvent?.type === 'cinema_started' || latestEvent?.type === 'date_started' 
    ? latestEvent.cinema_name 
    : undefined;
  const currentFilm = latestEvent?.type === 'film_started' 
    ? latestEvent.film_title 
    : undefined;

  // Calculate progress percentages
  const cinemaProgress = totalCinemas > 0 ? (processedCinemas / totalCinemas) * 100 : 0;
  const filmProgress = totalFilms > 0 ? (processedFilms / totalFilms) * 100 : 0;

  // Check if completed
  const allJobsTerminal = jobs.length > 0 && jobs.every((job) => job.status === 'completed' || job.status === 'failed');
  const isCompleted = allJobsTerminal && jobs.every((job) => job.status === 'completed');
  const hasFailed = allJobsTerminal && jobs.some((job) => job.status === 'failed');

  const hasMultipleJobs = jobs.length > 1 || jobs.some((job) => job.reportId != null);

  return (
    <div className={`border-2 rounded-lg p-6 shadow-lg ${isCompleted ? 'bg-green-50 border-green-500' : hasFailed ? 'bg-red-50 border-red-500' : 'bg-white border-primary'}`} data-testid="scrape-progress">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        {isCompleted ? (
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : hasFailed ? (
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : isReconnecting ? (
          <div className="animate-pulse h-6 w-6 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        ) : (
          <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full"></div>
        )}
        <h3 className="text-lg font-bold text-gray-900">
          {isCompleted ? 'Scraping terminé' : hasFailed ? 'Scraping échoué' : isReconnecting ? 'Reconnexion...' : 'Scraping en cours'}
        </h3>
      </div>

      {/* Connection Status */}
      <div className="mb-4">
        <span
          data-testid="sse-connection-status"
          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-100 text-green-800' :
            connectionStatus === 'reconnecting' ? 'bg-amber-100 text-amber-800' :
            'bg-red-100 text-red-800'
          }`}
        >
          {connectionStatus === 'connected' ? 'Connecté' :
           connectionStatus === 'reconnecting' ? 'Reconnexion...' :
           'Déconnecté'}
        </span>
      </div>

      {/* Status */}
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          <span className="font-semibold">Statut:</span> {latestEvent?.type || 'initializing'}
        </p>
        {isCompleted && (
          <p className="text-sm text-green-600 mt-2">
            🔄 Rechargement de la page dans quelques instants...
          </p>
        )}
      </div>

      {/* Cinema Progress */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <p className="text-sm font-medium text-gray-700">
            Cinémas traités
          </p>
          <p className="text-sm text-gray-600">
            {processedCinemas} / {totalCinemas}
            {totalCinemas > 0 && processedCinemas < totalCinemas && (
              <span className="ml-2 text-xs text-gray-400" data-testid="scrape-progress-eta">
                ETA: ~{Math.round((totalCinemas - processedCinemas) * 2)} min
              </span>
            )}
          </p>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${cinemaProgress}%` }}
          ></div>
        </div>
        {currentCinema && (
          <p className="text-xs text-gray-500 mt-1">
            En cours: {currentCinema}
          </p>
        )}
      </div>

      {/* Film Progress */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <p className="text-sm font-medium text-gray-700">
            Films traités
          </p>
          <p className="text-sm text-gray-600">
            {processedFilms} / {totalFilms}
          </p>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${filmProgress}%` }}
          ></div>
        </div>
        {currentFilm && (
          <p className="text-xs text-gray-500 mt-1">
            En cours: {currentFilm}
          </p>
        )}
      </div>

      {hasMultipleJobs && jobs.length > 0 && (
        <div className="mt-6 border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-900">Jobs</h4>
            <p className="text-xs text-gray-500">{jobs.length} suivi(s)</p>
          </div>
          <div className="space-y-3">
            {jobs.map((job) => {
              const cardCompleted = job.status === 'completed';
              const cardFailed = job.status === 'failed';
              const cardPending = job.status === 'pending';

              return (
                <div
                  key={job.id}
                  className={`rounded-md border p-4 ${cardCompleted ? 'border-green-300 bg-green-50' : cardFailed ? 'border-red-300 bg-red-50' : cardPending ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}
                  data-testid="scrape-progress-card"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{job.cinemaName || `Scrape #${job.reportId ?? job.id}`}</p>
                      {job.reportId != null && (
                        <p className="text-xs text-gray-500">Report #{job.reportId}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-semibold uppercase ${cardCompleted ? 'text-green-700' : cardFailed ? 'text-red-700' : cardPending ? 'text-amber-700' : 'text-blue-700'}`}>
                        {cardCompleted ? 'Termine' : cardFailed ? 'Echec' : cardPending ? 'En attente' : 'En cours'}
                      </p>
                      {cardCompleted && <span className="sr-only" data-testid="scrape-status-completed">completed</span>}
                    </div>
                  </div>

                  <div className="mt-3 space-y-3">
                    <div>
                      <div className="flex justify-between items-center mb-1 text-xs text-gray-600">
                        <span>Cinemas</span>
                        <span>
                          {job.processedCinemas} / {job.totalCinemas}
                          <span className="ml-2" data-testid="scrape-progress-percentage">{Math.round(job.cinemaProgress)}%</span>
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: `${job.cinemaProgress}%` }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1 text-xs text-gray-600">
                        <span>Films</span>
                        <span>{job.processedFilms} / {job.totalFilms}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full transition-all duration-300" style={{ width: `${job.filmProgress}%` }}></div>
                      </div>
                    </div>

                    {job.currentFilm && !cardCompleted && !cardFailed && !cardPending && (
                      <p className="text-xs text-gray-500">Film en cours: {job.currentFilm}</p>
                    )}

                    {cardPending && (
                      <p className="text-xs text-amber-700">En attente du premier evenement SSE</p>
                    )}

                    {job.error && (
                      <p className="text-xs text-red-700">{job.error}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mt-4">
          <p className="text-sm text-red-700">
            <span className="font-semibold">Erreur:</span> {error}
          </p>
        </div>
      )}
    </div>
  );
}
