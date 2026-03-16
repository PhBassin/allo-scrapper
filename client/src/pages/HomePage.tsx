import { useState, useContext, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getWeeklyFilms, getFilmsByDate, getCinemas, addCinema } from '../api/client';
import FilmCard from '../components/FilmCard';
import DaySelector from '../components/DaySelector';
import FilmSearchBar from '../components/FilmSearchBar';
import ScrollToTop from '../components/ScrollToTop';
import { AuthContext } from '../contexts/AuthContext';
import CinemasQuickLinks from '../components/CinemasQuickLinks';

export default function HomePage() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<string>('');
  const { isAuthenticated, hasPermission } = useContext(AuthContext);

  const { data: cinemas = [], isLoading: isLoadingCinemas } = useQuery({
    queryKey: ['cinemas'],
    queryFn: getCinemas,
  });

  const { data: filmsData, isLoading: isLoadingFilms, error: filmsError } = useQuery({
    queryKey: ['films', selectedDate],
    queryFn: () => selectedDate ? getFilmsByDate(selectedDate) : getWeeklyFilms(),
  });

  const films = filmsData?.films || [];
  const weekStart = filmsData?.weekStart || '';

  const isLoading = isLoadingCinemas || isLoadingFilms;
  const error = filmsError instanceof Error ? filmsError.message : null;

  const handleDateSelect = useCallback((date: string | null) => {
    setSelectedDate(date || '');
  }, []);
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

  const addCinemaMutation = useMutation({
    mutationFn: addCinema,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cinemas'] });
      queryClient.invalidateQueries({ queryKey: ['films', selectedDate] });
    },
    onError: (err: Error) => {
      alert(err.message || 'Erreur lors de l\'ajout du cinéma');
    }
  });

  const handleAddCinema = useCallback(async () => {
    const url = window.prompt("Entrez l'URL Allociné du cinéma à ajouter (ex: https://www.allocine.fr/seance/salle_affich-salle=C0013.html):");
    if (!url) return;

    addCinemaMutation.mutate(url);
  }, [addCinemaMutation]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 className="text-xl font-bold text-red-800 mb-2">Erreur</h2>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }


  return (
    <div className="max-w-5xl mx-auto">
      {/* Title and Date Info - Above sticky header */}
      <div className="mb-8">
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
      <div className="sticky top-[64px] z-40 bg-gray-50/95 backdrop-blur-sm pt-4 pb-4 mb-6 shadow-sm -mx-4 px-4" data-testid="sticky-search-date-container">
        {/* Film Search Bar */}
        <div className="mb-4">
          <FilmSearchBar placeholder="Rechercher un film..." />
        </div>

        {/* Day Selector */}
        {weekStart && (
          <div>
            <DaySelector 
              weekStart={weekStart} 
              selectedDate={selectedDate}
              onSelectDate={handleDateSelect}
            />
          </div>
        )}
      </div>

      {/* Quick Cinema Links - Below sticky header */}
      <CinemasQuickLinks
        cinemas={cinemas}
        canAddCinema={isAuthenticated && hasPermission('cinemas:create')}
        onAddCinema={handleAddCinema}
      />

      {/* Films List */}
      <div className="space-y-8">
        {films.length > 0 ? (
          films.map((film) => (
            <FilmCard key={film.id} film={film} />
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
