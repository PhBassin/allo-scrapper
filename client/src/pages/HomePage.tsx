import { useEffect, useState, useContext, useCallback, useMemo } from 'react';

import { getWeeklyFilms, getFilmsByDate, getCinemas, getScrapeStatus, addCinema, triggerScrape } from '../api/client';
import type { FilmWithShowtimes, Cinema } from '../types';
import FilmCard from '../components/FilmCard';
import ScrapeButton from '../components/ScrapeButton';
import ScrapeProgress from '../components/ScrapeProgress';
import DaySelector from '../components/DaySelector';
import FilmSearchBar from '../components/FilmSearchBar';
import ScrollToTop from '../components/ScrollToTop';
import { AuthContext } from '../contexts/AuthContext';
import CinemasQuickLinks from '../components/CinemasQuickLinks';

export default function HomePage() {
  const [films, setFilms] = useState<FilmWithShowtimes[]>([]);
  const [cinemas, setCinemas] = useState<Cinema[]>([]);
  const [weekStart, setWeekStart] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const { isAuthenticated } = useContext(AuthContext);

  const loadData = async (date?: string | null) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const [filmsData, cinemasData, scrapeStatus] = await Promise.all([
        date ? getFilmsByDate(date) : getWeeklyFilms(),
        getCinemas(),
        getScrapeStatus()
      ]);
      
      setFilms(filmsData.films);
      setWeekStart(filmsData.weekStart);
      setCinemas(cinemasData);

      // Check if scrape is running
      if (scrapeStatus.isRunning) {
        setShowProgress(true);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedDate);
  }, [selectedDate]);

  const handleDateSelect = useCallback((date: string | null) => {
    setSelectedDate(date);
  }, []);

  // ⚡ PERFORMANCE: Memoize formatDate and getWeekEndDate using useCallback and cache Intl.DateTimeFormat
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }), []);

  const formatDate = useCallback((dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return dateFormatter.format(date);
  }, [dateFormatter]);

  const getWeekEndDate = useCallback((startStr: string) => {
    if (!startStr) return '';
    const start = new Date(startStr);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return formatDate(end.toISOString());
  }, [formatDate]);

  const handleScrapeStart = () => {
    setShowProgress(true);
  };

  const handleScrapeComplete = () => {
    // Hide progress and reload data after a delay to avoid flickering
    setTimeout(() => {
      setShowProgress(false);
      loadData(selectedDate);
    }, 2000);
  };

  const handleAddCinema = useCallback(async () => {
    const url = window.prompt("Entrez l'URL Allociné du cinéma à ajouter (ex: https://www.allocine.fr/seance/salle_affich-salle=C0013.html):");
    if (!url) return;

    try {
      setShowProgress(true);
      await addCinema(url);
      // Data will reload when progress completes via handleScrapeComplete
    } catch (err: any) {
      setShowProgress(false);
      setError(err.message || 'Erreur lors de l\'ajout du cinéma');
    }
  }, []);

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
      {/* Scrape Button - Above sticky header */}
      <div className="flex justify-end mb-6">
        <ScrapeButton 
          onTrigger={async () => { await triggerScrape(); }}
          onScrapeStart={handleScrapeStart} 
        />
      </div>

      {/* Scrape Progress - Above sticky header */}
      {showProgress && (
        <div className="mb-6">
          <ScrapeProgress onComplete={handleScrapeComplete} />
        </div>
      )}

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
      <div className="sticky top-0 z-40 bg-gray-50 pt-4 pb-4 mb-6">
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
        isAuthenticated={isAuthenticated}
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
              Utilisez le bouton de mise à jour pour collecter les données des cinémas et afficher le programme.
            </p>
          </div>
        )}
      </div>

      {/* Scroll to Top Button */}
      <ScrollToTop />
    </div>
  );
}
