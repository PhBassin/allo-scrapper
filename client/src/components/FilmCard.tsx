import { Link } from 'react-router-dom';
import { useState } from 'react';
import type { FilmWithShowtimes } from '../types';
import CinemaShowtimes from './CinemaShowtimes';

interface FilmCardProps {
  film: FilmWithShowtimes;
  isNew?: boolean;
}

function formatDuration(minutes?: number): string {
  if (!minutes) return '';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h${mins > 0 ? ` ${mins}min` : ''}`;
}

export default function FilmCard({ film, isNew = false }: FilmCardProps) {
  const [showSchedule, setShowSchedule] = useState(false);

  return (
    <div className="card hover:shadow-lg transition relative" data-testid="film-card">
      {isNew && (
        <div className="absolute top-2 right-2 bg-primary text-black text-xs font-bold px-2 py-1 rounded z-10">
          NOUVEAU
        </div>
      )}

      <div className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          {/* Poster */}
          <div className="flex-shrink-0 mx-auto md:mx-0">
            {film.poster_url ? (
              <img
                src={film.poster_url}
                alt={`Affiche de ${film.title}`}
                className="w-40 md:w-32 h-60 md:h-48 object-cover rounded shadow-md"
                loading="lazy"
              />
            ) : (
              <div className="w-40 md:w-32 h-60 md:h-48 bg-gray-200 rounded flex items-center justify-center shadow-inner">
                <span className="text-gray-400 text-4xl">🎬</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-grow">
            <h3 className="text-2xl font-bold mb-1">
              <Link to={`/film/${film.id}`} className="hover:text-primary transition">
                {film.title}
              </Link>
            </h3>

            {film.original_title && film.original_title !== film.title && (
              <p className="text-sm text-gray-500 mb-3 italic">{film.original_title}</p>
            )}

            <div className="flex flex-wrap gap-1.5 mb-4">
              {film.genres.map((genre) => (
                <span key={genre} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold uppercase rounded">
                  {genre}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600 mb-4">
              {film.duration_minutes && (
                <p><strong>Durée:</strong> {formatDuration(film.duration_minutes)}</p>
              )}
              {film.director && (
                <p><strong>Réalisateur:</strong> {film.director}</p>
              )}
              {film.nationality && (
                <p><strong>Nationalité:</strong> {film.nationality}</p>
              )}
              {film.certificate && (
                <p><strong>Classification:</strong> {film.certificate}</p>
              )}
            </div>

            {(film.press_rating || film.audience_rating) && (
              <div className="flex gap-4 mb-4 pt-4 border-t border-gray-50">
                {film.press_rating && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-yellow-500 text-lg leading-none">★</span>
                    <span className="font-bold">{film.press_rating.toFixed(1)}</span>
                    <span className="text-[10px] text-gray-400 uppercase font-bold">Presse</span>
                  </div>
                )}
                {film.audience_rating && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-yellow-500 text-lg leading-none">★</span>
                    <span className="font-bold">{film.audience_rating.toFixed(1)}</span>
                    <span className="text-[10px] text-gray-400 uppercase font-bold">Public</span>
                  </div>
                )}
              </div>
            )}

            {film.synopsis && <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed">{film.synopsis}</p>}
          </div>
        </div>

        {/* Action / Showtimes Toggle */}
        <div className="pt-4 border-t border-gray-100 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <button 
              onClick={() => setShowSchedule(!showSchedule)}
              className={`text-sm font-bold flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                showSchedule 
                  ? 'bg-primary text-black' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>{showSchedule ? '▼ Cacher les horaires' : '▶ Voir les horaires'}</span>
              <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded">{film.cinemas.length} cinémas</span>
            </button>
            <Link 
              to={`/film/${film.id}`} 
              className="text-sm font-bold text-gray-500 hover:text-primary transition"
            >
              Fiche complète →
            </Link>
          </div>

          {showSchedule && (
            <div className="mt-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <CinemaShowtimes cinemas={film.cinemas} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
