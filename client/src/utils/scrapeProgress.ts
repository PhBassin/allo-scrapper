import type { ProgressEvent } from '../types/index.js';

export type ProgressUiState = 'running' | 'completed' | 'failed';

export function deriveProgressState(
  latestEvent: ProgressEvent | undefined
): ProgressUiState {
  if (latestEvent?.type === 'completed') return 'completed';
  if (latestEvent?.type === 'failed') return 'failed';
  return 'running';
}

export function selectCurrentTheater(
  latestEvent: ProgressEvent | undefined
): string | undefined {
  if (latestEvent?.type === 'theater_started') return latestEvent.theater_name;
  if (latestEvent?.type === 'date_started') return latestEvent.theater_name;
  return undefined;
}

export function selectCurrentMovie(
  latestEvent: ProgressEvent | undefined
): string | undefined {
  return latestEvent?.type === 'movie_started' ? latestEvent.movie_title : undefined;
}
