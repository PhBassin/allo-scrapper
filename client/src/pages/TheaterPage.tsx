import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getTheaters, getTheaterSchedule } from '../api/client.js';
import type { Movie, ShowtimeWithMovie, Theater } from '../types/index.js';
import ShowtimeList from '../components/ShowtimeList.js';
import TheaterDateSelector from '../components/TheaterDateSelector.js';
import { LoadingSpinner, ErrorMessage } from '../components/ui/PageStates.js';
import { useDateTimeFilter } from '../hooks/useDateTimeFilter.js';
import {
  getUniqueDates,
  getInitialSelectedDate,
  groupByMovie,
  createDateLabelFormatter,
  formatDurationShort,
} from '../utils/theaterSchedule.js';

export default function TheaterPage() {
  const { id } = useParams<{ id: string }>();

  const theatersQuery = useQuery({
    queryKey: ['theaters'],
    queryFn: getTheaters,
  });
  const scheduleQuery = useQuery({
    queryKey: ['theater-schedule', id],
    queryFn: () => getTheaterSchedule(id!),
    enabled: !!id,
  });

  const isLoading = theatersQuery.isLoading || scheduleQuery.isLoading;
  const queryError = theatersQuery.error || scheduleQuery.error;
  const error = queryError instanceof Error
    ? queryError.message
    : queryError ? 'Failed to load theater data' : null;

  const theater = theatersQuery.data?.find((c) => c.id === id) || null;
  const showtimes = scheduleQuery.data?.showtimes || [];
  const hasNoTheater = !theater && !theatersQuery.isLoading && !!theatersQuery.data;

  if (isLoading) return <LoadingSpinner />;
  if (error || !theater || hasNoTheater) {
    return <ErrorMessage message={error || 'Theater not found'} />;
  }

  return (
    <TheaterContent
      theater={theater}
      showtimes={showtimes}
      formatDateLabel={createDateLabelFormatter()}
    />
  );
}

interface TheaterContentProps {
  theater: Theater;
  showtimes: ShowtimeWithMovie[];
  formatDateLabel: (dateStr: string) => { weekday: string; day: number; month: string };
}

function TheaterContent({ theater, showtimes, formatDateLabel }: TheaterContentProps) {
  const dates = useMemo(() => getUniqueDates(showtimes), [showtimes]);
  const initialDate = useMemo(() => getInitialSelectedDate(showtimes), [showtimes]);

  const { selectedDate, afterTime, selectDate: handleSelectDate, selectNow: handleNow } = useDateTimeFilter(initialDate);

  const effectiveSelectedDate = useMemo(() => {
    if (dates.length === 0) return '';
    if (selectedDate && dates.includes(selectedDate)) return selectedDate;
    return initialDate;
  }, [dates, selectedDate, initialDate]);

  const selectedShowtimes = useMemo(
    () => showtimes.filter(
      (s) => s.date === effectiveSelectedDate && (!afterTime || s.time >= afterTime)
    ),
    [showtimes, effectiveSelectedDate, afterTime]
  );
  const movieGroups = useMemo(() => groupByMovie(selectedShowtimes), [selectedShowtimes]);

  return (
    <div>
      <TheaterBreadcrumb name={theater.name} />
      <TheaterHeader theater={theater} />

      <div
        className="sticky z-40 bg-gray-50/95 backdrop-blur-sm pt-4 pb-4 mb-6 shadow-sm -mx-4 px-4"
        style={{ top: 'var(--layout-header-offset, 64px)' }}
        data-testid="sticky-date-selector-container"
      >
        <TheaterDateSelector
          dates={dates}
          selectedDate={effectiveSelectedDate}
          showtimes={showtimes}
          onSelectDate={handleSelectDate}
          onNow={handleNow}
          isNowActive={afterTime !== null}
          formatDateLabel={formatDateLabel}
        />
      </div>

      <ShowtimesList movieGroups={movieGroups} theater={theater} />
    </div>
  );
}

function TheaterBreadcrumb({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
      <Link to="/" className="hover:text-primary hover:underline">← Accueil</Link>
      <span>/</span>
      <span>{name}</span>
    </div>
  );
}

function TheaterHeader({ theater }: { theater: Theater }) {
  return (
    <div className="mb-6">
      <h1 className="text-3xl md:text-4xl font-bold mb-2">{theater.name}</h1>
      {theater.address && (
        <p className="text-gray-600 mb-1">
          📍 {theater.address}, {theater.postal_code} {theater.city}
        </p>
      )}
      {theater.screen_count != null && theater.screen_count > 0 && (
        <p className="text-gray-600">
          🎬 {theater.screen_count} salle{theater.screen_count > 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

function ShowtimesList({
  movieGroups,
  theater,
}: {
  movieGroups: Array<{ movie: Movie; showtimes: ShowtimeWithMovie[] }>;
  theater: Theater;
}) {
  if (movieGroups.length === 0) return <EmptyShowtimes />;
  return (
    <div className="min-h-[300px]">
      <div className="space-y-6">
        {movieGroups.map(({ movie, showtimes }) => (
          <MovieShowtimeCard key={movie.id} movie={movie} showtimes={showtimes} theater={theater} />
        ))}
      </div>
    </div>
  );
}

function EmptyShowtimes() {
  return (
    <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
      <p className="text-gray-500 font-medium">Aucune séance programmée ce jour-là</p>
      <p className="text-sm text-gray-400 mt-1">Essayez un autre jour de la semaine</p>
    </div>
  );
}

function MovieShowtimeCard({
  movie,
  showtimes,
  theater,
}: {
  movie: Movie;
  showtimes: ShowtimeWithMovie[];
  theater: Theater;
}) {
  return (
    <div className="card p-5 md:p-6 transition hover:shadow-md border border-gray-100">
      <div className="flex flex-col md:flex-row gap-6">
        {movie.poster_url && (
          <div className="hidden md:block w-24 flex-shrink-0">
            <img src={movie.poster_url} alt={movie.title} className="w-full rounded shadow-sm" loading="lazy" />
          </div>
        )}
        <div className="flex-grow">
          <div className="mb-4">
            <h2 className="text-xl md:text-2xl font-bold mb-1">
              <Link to={`/movie/${movie.id}`} className="hover:text-primary transition">
                {movie.title}
              </Link>
            </h2>
            <MovieMetaLine movie={movie} />
            <MovieRatings movie={movie} />
          </div>
          <div className="pt-2 border-t border-gray-100">
            <ShowtimeList showtimes={showtimes} movie={movie} theater={theater} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MovieMetaLine({ movie }: { movie: Movie }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600 mb-3">
      {movie.duration_minutes && <span>⏱ {formatDurationShort(movie.duration_minutes)}</span>}
      {movie.genres && movie.genres.length > 0 && (
        <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">{movie.genres[0]}</span>
      )}
      {movie.director && <span className="hidden sm:inline">de {movie.director}</span>}
    </div>
  );
}

function MovieRatings({ movie }: { movie: Movie }) {
  const press = movie.press_rating ?? 0;
  const audience = movie.audience_rating ?? 0;
  const hasPress = press > 0;
  const hasAudience = audience > 0;
  if (!hasPress && !hasAudience) return null;

  return (
    <div className="flex gap-3 mb-4">
      {hasPress && (
        <div className="flex items-center gap-1">
          <span className="text-xs font-bold bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">Presse</span>
          <span className="font-bold text-sm">★ {press.toFixed(1)}</span>
        </div>
      )}
      {hasAudience && (
        <div className="flex items-center gap-1">
          <span className="text-xs font-bold bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">Spectateurs</span>
          <span className="font-bold text-sm">★ {audience.toFixed(1)}</span>
        </div>
      )}
    </div>
  );
}