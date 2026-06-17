import { useScrapeProgress } from '../hooks/useScrapeProgress.js';
import type { ProgressEvent } from '../types/index.js';
import {
  deriveProgressState,
  selectCurrentTheater,
  selectCurrentMovie,
  type ProgressUiState,
} from '../utils/scrapeProgress.js';

export interface ScrapeProgressProps {
  onComplete?: (success: boolean) => void;
}

function ConnectingState() {
  return (
    <div className="border-2 rounded-lg p-6 shadow-lg bg-white border-primary" data-testid="scrape-progress">
      <div className="flex items-center gap-3">
        <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full"></div>
        <h3 className="text-lg font-bold text-gray-900">Connexion en cours...</h3>
      </div>
    </div>
  );
}

const STATE_CONFIG: Record<ProgressUiState, { title: string; bg: string; border: string }> = {
  running: { title: 'Scraping en cours', bg: 'bg-white', border: 'border-primary' },
  completed: { title: 'Scraping terminé', bg: 'bg-green-50', border: 'border-green-500' },
  failed: { title: 'Scraping échoué', bg: 'bg-red-50', border: 'border-red-500' },
};

function ProgressIcon({ state }: { state: ProgressUiState }) {
  if (state === 'completed') {
    return (
      <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (state === 'failed') {
    return (
      <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  return <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full"></div>;
}

function ProgressHeader({ state }: { state: ProgressUiState }) {
  const config = STATE_CONFIG[state];
  return (
    <div className="flex items-center gap-3 mb-4">
      <ProgressIcon state={state} />
      <h3 className="text-lg font-bold text-gray-900">{config.title}</h3>
    </div>
  );
}

interface ProgressBarProps {
  label: string;
  processed: number;
  total: number;
  currentItem?: string;
  colorClass?: string;
}

function ProgressBar({ label, processed, total, currentItem, colorClass = 'bg-primary' }: ProgressBarProps) {
  const percent = total > 0 ? (processed / total) * 100 : 0;
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-sm text-gray-600">{processed} / {total}</p>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`${colorClass} h-2 rounded-full transition-all duration-300`}
          style={{ width: `${percent}%` }}
        ></div>
      </div>
      {currentItem && (
        <p className="text-xs text-gray-500 mt-1">En cours: {currentItem}</p>
      )}
    </div>
  );
}

function ScrapeProgressError({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded p-3 mt-4">
      <p className="text-sm text-red-700">
        <span className="font-semibold">Erreur:</span> {message}
      </p>
    </div>
  );
}

export default function ScrapeProgress({ onComplete }: ScrapeProgressProps = {}) {
  const { events, latestEvent, error } = useScrapeProgress(onComplete);

  // Only show connecting state if we have no events yet
  // Once we have events, keep showing progress even if disconnected
  if (events.length === 0) {
    return <ConnectingState />;
  }

  const state = deriveProgressState(latestEvent);
  const startedEvent = events.find((e): e is Extract<ProgressEvent, { type: 'started' }> => e.type === 'started');
  const theaterCompletedEvents = events.filter((e): e is Extract<ProgressEvent, { type: 'theater_completed' }> => e.type === 'theater_completed');
  const movieCompletedEvents = events.filter((e): e is Extract<ProgressEvent, { type: 'movie_completed' }> => e.type === 'movie_completed');
  const movieStartedEvents = events.filter((e): e is Extract<ProgressEvent, { type: 'movie_started' }> => e.type === 'movie_started');

  const totalTheaters = startedEvent?.total_theaters || 0;
  const processedTheaters = theaterCompletedEvents.length;
  const totalMovies = movieStartedEvents.length;
  const processedMovies = movieCompletedEvents.length;

  const config = STATE_CONFIG[state];

  return (
    <div
      className={`border-2 rounded-lg p-6 shadow-lg ${config.bg} ${config.border}`}
      data-testid="scrape-progress"
    >
      <ProgressHeader state={state} />

      <div className="mb-4">
        <p className="text-sm text-gray-600">
          <span className="font-semibold">Statut:</span> {latestEvent?.type || 'initializing'}
        </p>
        {state === 'completed' && (
          <p className="text-sm text-green-600 mt-2">
            🔄 Rechargement de la page dans quelques instants...
          </p>
        )}
      </div>

      <ProgressBar
        label="Cinémas traités"
        processed={processedTheaters}
        total={totalTheaters}
        currentItem={selectCurrentTheater(latestEvent)}
      />

      <ProgressBar
        label="Films traités"
        processed={processedMovies}
        total={totalMovies}
        currentItem={selectCurrentMovie(latestEvent)}
        colorClass="bg-green-500"
      />

      {error && <ScrapeProgressError message={error} />}
    </div>
  );
}
