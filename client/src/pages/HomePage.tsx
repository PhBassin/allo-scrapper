import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getWeeklyFilms, getFilmsByDate, getCinemas, getScrapeStatus, addCinema } from '../api/client';
import type { FilmWithShowtimes, Cinema } from '../types';
import FilmCard from '../components/FilmCard';
import ScrapeButton from '../components/ScrapeButton';
import ScrapeProgress from '../components/ScrapeProgress';
import DaySelector from '../components/DaySelector';

export default function HomePage() {
  const [films, setFilms] = useState<FilmWithShowtimes[]>([]);
  const [cinemas, setCinemas] = useState<Cinema[]>([]);
  const [weekStart, setWeekStart] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProgress, setShowProgress] = useState(false);

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

  const handleDateSelect = (date: string | null) => {
    setSelectedDate(date);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const getWeekEndDate = (startStr: string) => {
    if (!startStr) return '';
    const start = new Date(startStr);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return formatDate(end.toISOString());
  };

  const handleScrapeStart = () => {
    setShowProgress(true);
  };

  const handleScrapeComplete = () => {
    // Reload data immediately to show new results
    loadData(selectedDate);
    
    // Hide progress after 5 seconds
    setTimeout(() => {
      setShowProgress(false);
    }, 5000);
  };

  const handleAddCinema = async () => {
    const url = window.prompt("Entrez l'URL Allociné du cinéma à ajouter (ex: https://www.allocine.fr/seance/salle_affich-salle=C0013.html):");
    if (!url) return;

    try {
      setIsLoading(true);
      await addCinema(url);
      await loadData(selectedDate);
      alert("Cinéma ajouté avec succès !");
    } catch (err: any) {
      alert("Erreur lors de l'ajout du cinéma: " + (err.message || 'Erreur inconnue'));
      setIsLoading(false);
    }
  };

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
      {/* Header Section */}
      <div className="mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
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
          <div className="flex-shrink-0">
            <ScrapeButton onScrapeStart={handleScrapeStart} />
          </div>
        </div>

        {/* Scrape Progress */}
        {showProgress && (
          <div className="mb-8">
            <ScrapeProgress onComplete={handleScrapeComplete} />
          </div>
        )}

        {/* Day Selector */}
        {weekStart && (
          <div className="mb-6">
            <DaySelector 
              weekStart={weekStart} 
              selectedDate={selectedDate}
              onSelectDate={handleDateSelect}
            />
          </div>
        )}

        {/* Quick Cinema Links */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <h2 className="text-xs font-bold text-gray-400 uppercase mb-3 px-1">Accès rapide par cinéma</h2>
          <div className="flex flex-wrap gap-2">
            {cinemas.map((cinema) => (
              <Link
                key={cinema.id}
                to={`/cinema/${cinema.id}`}
                className="px-3 py-1.5 bg-gray-50 text-gray-700 text-sm rounded-lg hover:bg-primary hover:text-black transition font-semibold"
              >
                {cinema.name}
              </Link>
            ))}
            <button
              onClick={handleAddCinema}
              className="px-3 py-1.5 bg-white border border-dashed border-gray-300 text-gray-500 text-sm rounded-lg hover:border-primary hover:text-primary transition font-semibold"
            >
              + Ajouter un cinéma
            </button>
          </div>
        </div>
      </div>

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
    </div>
  );
}
