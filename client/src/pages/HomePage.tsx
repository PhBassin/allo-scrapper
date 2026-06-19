import { useContext, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getWeeklyMovies, getMoviesByDate, getTheaters, addTheater } from '../api/client.js';
import MovieCard from '../components/MovieCard.js';
import DaySelector from '../components/DaySelector.js';
import MovieSearchBar from '../components/MovieSearchBar.js';
import ScrollToTop from '../components/ScrollToTop.js';
import { AuthContext } from '../contexts/AuthContext.js';
import TheatersQuickLinks from '../components/TheatersQuickLinks.js';
import { LoadingSpinner, ErrorMessage } from '../components/ui/PageStates.js';
import { useDateTimeFilter } from '../hooks/useDateTimeFilter.js';

export default function HomePage() {
  const queryClient = useQueryClient();
  const { selectedDate, afterTime, selectDate, selectNow } = useDateTimeFilter();
  const { isAuthenticated, hasPermission } = useContext(AuthContext);

  const { data: theaters = [], isLoading: isLoadingTheaters } = useQuery({
    queryKey: ['theaters'],
    queryFn: getTheaters,
  });

  const { data: moviesData, isLoading: isLoadingMovies, error: moviesError } = useQuery({
    queryKey: ['movies', selectedDate],
    queryFn: () => selectedDate ? getMoviesByDate(selectedDate) : getWeeklyMovies(),
  });

  const allMovies = useMemo(() => moviesData?.movies || [], [moviesData]);
  // When "Maintenant" is active, hide movies whose showtimes are all in the past
  const movies = useMemo(() => {
    return afterTime
      ? allMovies.filter(movie =>
          movie.theaters.some(c => c.showtimes.some(s => s.time >= afterTime))
        )
      : allMovies;
  }, [allMovies, afterTime]);
  const weekStart = moviesData?.weekStart || '';

  const isLoading = isLoadingTheaters || isLoadingMovies;
  const error = moviesError instanceof Error ? moviesError.message : null;

  const handleDateSelect = useCallback((date: string | null) => {
    selectDate(date || '');
  }, [selectDate]);
  const formatterDate = useMemo(() => new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }), []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return formatterDate.format(date);
  };

  const getWeekEndDate = (startStr: string) => {
    if (!startStr) return '';
    const start = new Date(startStr);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return formatDate(end.toISOString());
  };

  const addTheaterMutation = useMutation({
    mutationFn: addTheater,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['theaters'] });
      queryClient.invalidateQueries({ queryKey: ['movies', selectedDate] });
    },
    onError: (err: Error) => {
      alert(err.message || 'Erreur lors de l\'ajout du cinéma');
    }
  });

  const handleAddTheater = useCallback(async () => {
    const url = window.prompt("Entrez l'URL Allociné du cinéma à ajouter (ex: https://www.allocine.fr/seance/salle_affich-salle=C0013.html):");
    if (!url) return;

    addTheaterMutation.mutate(url);
  }, [addTheaterMutation]);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;


  return (
    <div className="max-w-5xl mx-auto">
      {/* Title and Date Info - Above sticky header */}
      <div className="mb-4">
        <h1 className="text-4xl font-bold mb-3">
          {selectedDate ? 'Films du jour' : 'Au programme cette semaine'}
        </h1>
        {weekStart && !selectedDate && (
          <div className="flex items-center gap-2 text-gray-500 font-medium">
            <span className="bg-gray-100 px-2 py-0.5 rounded text-sm">Semaine ciné</span>
            <span>Du {formatDate(weekStart)} au {getWeekEndDate(weekStart)}</span>
          </div>
        )}
        {selectedDate && (
          <div className="flex items-center gap-2 text-gray-500 font-medium">
            <span className="bg-gray-100 px-2 py-0.5 rounded text-sm">Date sélectionnée</span>
            <span>{formatDate(selectedDate)}</span>
          </div>
        )}
      </div>

      {/* Sticky Header Section - Compact */}
      <div
        className="sticky z-40 bg-gray-50/95 backdrop-blur-sm pt-3 pb-3 mb-4 shadow-sm -mx-4 px-4"
        style={{ top: 'var(--layout-header-offset, 64px)' }}
        data-testid="sticky-search-date-container"
      >
        {/* Search + Day Selector — single row */}
        <div className="flex items-center gap-3">
          <MovieSearchBar
            placeholder="Rechercher un film..."
            className="w-40 sm:w-52 flex-shrink-0"
          />
          {weekStart && (
            <div className="flex-1 min-w-0">
              <DaySelector
                weekStart={weekStart}
                selectedDate={selectedDate}
                onSelectDate={handleDateSelect}
                onNow={selectNow}
                isNowActive={afterTime !== null}
              />
            </div>
          )}
        </div>
      </div>

      {/* Quick Theater Links - Below sticky header */}
      <TheatersQuickLinks
        theaters={theaters}
        canAddTheater={isAuthenticated && hasPermission('theaters:create')}
        onAddTheater={handleAddTheater}
      />

      {/* Movies List */}
      <div className="space-y-6">
        {movies.length > 0 ? (
          movies.map((movie) => (
            <MovieCard key={movie.id} movie={movie} initialAfterTime={afterTime} />
          ))
        ) : (
          <div className="bg-gray-50 rounded-2xl p-12 text-center border-2 border-dashed border-gray-200">
            <p className="text-gray-600 text-lg font-medium mb-2">
              {selectedDate ? 'Aucun film programmé pour cette date.' : 'Aucun film programmé pour le moment.'}
            </p>
            <p className="text-gray-400 text-sm max-w-md mx-auto">
              Les données des cinémas sont mises à jour automatiquement ou depuis l'interface d'administration.
            </p>
          </div>
        )}
      </div>

      {/* Scroll to Top Button */}
      <ScrollToTop />
    </div>
  );
}
