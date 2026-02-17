import { useScrapeProgress } from '../hooks/useScrapeProgress';
import type { ProgressEvent } from '../types';

export interface ScrapeProgressProps {
  onComplete?: (success: boolean) => void;
}

export default function ScrapeProgress({ onComplete }: ScrapeProgressProps = {}) {
  const { isConnected, events, latestEvent, error } = useScrapeProgress(onComplete);

  // Show loading state while connecting or waiting for first event
  if (!isConnected || events.length === 0) {
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
  const cinemaCompletedEvents = events.filter((e): e is Extract<ProgressEvent, { type: 'cinema_completed' }> => e.type === 'cinema_completed');
  const filmStartedEvents = events.filter((e): e is Extract<ProgressEvent, { type: 'film_started' }> => e.type === 'film_started');
  const filmCompletedEvents = events.filter((e): e is Extract<ProgressEvent, { type: 'film_completed' }> => e.type === 'film_completed');

  const totalCinemas = startedEvent?.total_cinemas || 0;
  const processedCinemas = cinemaCompletedEvents.length;
  const totalFilms = filmStartedEvents.length;
  const processedFilms = filmCompletedEvents.length;

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
  const isCompleted = latestEvent?.type === 'completed';
  const hasFailed = latestEvent?.type === 'failed';

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
        ) : (
          <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full"></div>
        )}
        <h3 className="text-lg font-bold text-gray-900">
          {isCompleted ? 'Scraping terminé' : hasFailed ? 'Scraping échoué' : 'Scraping en cours'}
        </h3>
      </div>

      {/* Status */}
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          <span className="font-semibold">Statut:</span> {latestEvent?.type || 'initializing'}
        </p>
      </div>

      {/* Cinema Progress */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <p className="text-sm font-medium text-gray-700">
            Cinémas traités
          </p>
          <p className="text-sm text-gray-600">
            {processedCinemas} / {totalCinemas}
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
