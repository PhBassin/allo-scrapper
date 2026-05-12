import { useState, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getTheaters, getTheaterSchedule } from '../api/client';
import type { ShowtimeWithMovie } from '../types';
import ShowtimeList from '../components/ShowtimeList';
import TheaterDateSelector from '../components/TheaterDateSelector';

interface MovieGroup {
  movie: {
    id: number;
    title: string;
    poster_url?: string;
    duration_minutes?: number;
    genres?: string[];
    director?: string;
    press_rating?: number;
    audience_rating?: number;
  };
  showtimes: ShowtimeWithMovie[];
}

export default function TheaterPage() {
  const { id, slug } = useParams<{ id: string; slug?: string }>();

  const { data: theatersData, isLoading: theatersLoading, error: theatersError } = useQuery({
    queryKey: ['theaters', slug ?? null],
    queryFn: getTheaters
  });

  const { data: scheduleData, isLoading: scheduleLoading, error: scheduleError } = useQuery({
    queryKey: ['theater-schedule', slug ?? null, id],
    queryFn: () => getTheaterSchedule(id!),
    enabled: !!id
  });

  const isLoading = theatersLoading || scheduleLoading;
  const queryError = theatersError || scheduleError;
  const error = queryError instanceof Error ? queryError.message : (queryError ? 'Failed to load theater data' : null);

  // Validate if theater was not found in theatersData
  if (!isLoading && theatersData && !theatersData.some(c => c.id === id)) {
    // Setting an error message similar to before if theater is not found
    // however returning 'Theater not found' directly in JSX handles it below
  }

  const theater = theatersData?.find(c => c.id === id) || null;
  const showtimes = useMemo(() => scheduleData?.showtimes || [], [scheduleData?.showtimes]);

  const getInitialSelectedDate = (showtimes: ShowtimeWithMovie[]): string => {
    if (showtimes.length === 0) return '';
    const today = new Date().toISOString().split('T')[0];
    const dates = new Set(showtimes.map(s => s.date));
    const uniqueDates = Array.from(dates).sort();
    return uniqueDates.includes(today) ? today : uniqueDates[0];
  };

  const [selectedDate, setSelectedDate] = useState<string>('');
  const [afterTime, setAfterTime] = useState<string | null>(null);

  const handleSelectDate = useCallback((date: string) => {
    setSelectedDate(date);
    setAfterTime(null);
  }, []);

  const handleNow = useCallback((date: string, time: string) => {
    setSelectedDate(date);
    setAfterTime(time);
  }, []);

  const getUniqueDates = (showtimes: ShowtimeWithMovie[]): string[] => {
    const dates = new Set(showtimes.map(s => s.date));
    return Array.from(dates).sort();
  };

  const groupByMovie = (showtimes: ShowtimeWithMovie[]): MovieGroup[] => {
    const movieMap = new Map<number, MovieGroup>();

    showtimes.forEach((showtime) => {
      if (!movieMap.has(showtime.movie.id)) {
        movieMap.set(showtime.movie.id, {
          movie: showtime.movie,
          showtimes: [],
        });
      }
      movieMap.get(showtime.movie.id)!.showtimes.push(showtime);
    });

    return Array.from(movieMap.values());
  };

  // ⚡ PERFORMANCE: Cache Intl.DateTimeFormat instances to prevent expensive
  // re-initialization during frequent renders
  const formatterWeekday = useMemo(() => new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }), []);
  const formatterMonth = useMemo(() => new Intl.DateTimeFormat('fr-FR', { month: 'short' }), []);

  const formatDateLabel = useCallback((dateStr: string) => {
    if (!dateStr) return { weekday: '', day: 0, month: '' };
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) return { weekday: 'Invalid', day: 0, month: 'Date' };
    return {
      weekday: formatterWeekday.format(date).replace('.', ''),
      day: date.getDate(),
      month: formatterMonth.format(date),
    };
  }, [formatterWeekday, formatterMonth]);

  // ⚡ PERFORMANCE: Memoize derived state calculations to prevent expensive
  // array operations (getUniqueDates, filter, groupByFilm) on every render,
  // especially when showtimes array is large or during unrelated state updates (like scrape progress).
  const dates = useMemo(() => getUniqueDates(showtimes), [showtimes]);
  const effectiveSelectedDate = useMemo(() => {
    if (dates.length === 0) return '';
    if (selectedDate && dates.includes(selectedDate)) return selectedDate;
    return getInitialSelectedDate(showtimes);
  }, [dates, selectedDate, showtimes]);
  const selectedShowtimes = useMemo(
    () => showtimes.filter(s => s.date === effectiveSelectedDate && (!afterTime || s.time >= afterTime)),
    [showtimes, effectiveSelectedDate, afterTime]
  );
  const movieGroups = useMemo(() => groupByMovie(selectedShowtimes), [selectedShowtimes]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !theater) {
    const isForbidden = typeof error === 'string' && error.toLowerCase().includes('cross-tenant access denied');
    const errorMessage = error || 'Theater not found';

    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 className="text-xl font-bold text-red-800 mb-2">{isForbidden ? '403 Forbidden' : 'Erreur'}</h2>
        {isForbidden ? (
          <p className="text-red-600" data-testid="403-error-message">{errorMessage}</p>
        ) : (
          <p className="text-red-600">{errorMessage}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link to="/" className="hover:text-primary hover:underline">← Accueil</Link>
        <span>/</span>
        <span>{theater.name}</span>
      </div>

      {/* Theater Header */}
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-heading font-bold mb-2">{theater.name}</h1>
        
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

      {/* Date Selector - Sticky */}
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

      {/* Movies List for Selected Date */}
      <div className="min-h-[300px]" data-testid="schedule-calendar">
        {movieGroups.length > 0 ? (
          <div className="space-y-6">
            {movieGroups.map(({ movie, showtimes }) => (
              <div key={movie.id} className="card p-5 md:p-6 transition hover:shadow-md border border-gray-100">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Poster (hidden on mobile) */}
                  {movie.poster_url && (
                    <div className="hidden md:block w-24 flex-shrink-0">
                      <img 
                        src={movie.poster_url} 
                        alt={movie.title} 
                        className="w-full rounded shadow-sm"
                        loading="lazy"
                      />
                    </div>
                  )}

                  <div className="flex-grow">
                    <div className="mb-4">
                      <h2 className="text-xl md:text-2xl font-heading font-bold mb-1">
                        <Link to={`/movie/${movie.id}`} className="hover:text-primary transition">
                          {movie.title}
                        </Link>
                      </h2>
                      
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600 mb-3">
                        {movie.duration_minutes && (
                          <span>
                            ⏱ {Math.floor(movie.duration_minutes / 60)}h{movie.duration_minutes % 60 > 0 ? String(movie.duration_minutes % 60).padStart(2, '0') : ''}
                          </span>
                        )}
                        {movie.genres && movie.genres.length > 0 && (
                          <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">
                            {movie.genres[0]}
                          </span>
                        )}
                        {movie.director && (
                          <span className="hidden sm:inline">de {movie.director}</span>
                        )}
                      </div>

                      {/* Ratings */}
                      {(movie.press_rating != null && movie.press_rating > 0) || (movie.audience_rating != null && movie.audience_rating > 0) ? (
                        <div className="flex gap-3 mb-4">
                          {movie.press_rating != null && movie.press_rating > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-bold bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">Presse</span>
                              <span className="font-bold text-sm">★ {movie.press_rating.toFixed(1)}</span>
                            </div>
                          )}
                          {movie.audience_rating != null && movie.audience_rating > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-bold bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">Spectateurs</span>
                              <span className="font-bold text-sm">★ {movie.audience_rating.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>

                    <div className="pt-2 border-t border-gray-100">
                      <ShowtimeList showtimes={showtimes} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <p className="text-gray-500 font-medium">Aucune séance programmée ce jour-là</p>
            <p className="text-sm text-gray-400 mt-1">Essayez un autre jour de la semaine</p>
          </div>
        )}
      </div>
    </div>
  );
}
