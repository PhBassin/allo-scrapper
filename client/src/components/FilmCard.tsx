import { Link } from 'react-router-dom';
import type { Film } from '../types';

interface FilmCardProps {
  film: Film;
  isNew?: boolean;
}

function formatDuration(minutes?: number): string {
  if (!minutes) return '';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h${mins > 0 ? ` ${mins}min` : ''}`;
}

export default function FilmCard({ film, isNew = false }: FilmCardProps) {
  return (
    <div className="card hover:shadow-lg transition relative">
      {isNew && (
        <div className="absolute top-2 right-2 bg-primary text-black text-xs font-bold px-2 py-1 rounded z-10">
          NOUVEAU
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 p-4">
        {/* Poster */}
        <div className="flex-shrink-0">
          {film.poster_url ? (
            <img
              src={film.poster_url}
              alt={`Affiche de ${film.title}`}
              className="w-32 h-48 object-cover rounded"
              loading="lazy"
            />
          ) : (
            <div className="w-32 h-48 bg-gray-200 rounded flex items-center justify-center">
              <span className="text-gray-400 text-4xl">🎬</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-grow">
          <h3 className="text-xl font-bold mb-2">
            <Link to={`/film/${film.id}`} className="hover:text-primary transition">
              {film.title}
            </Link>
          </h3>

          {film.original_title && film.original_title !== film.title && (
            <p className="text-sm text-gray-600 mb-2 italic">{film.original_title}</p>
          )}

          <div className="flex flex-wrap gap-2 mb-3">
            {film.genres.map((genre) => (
              <span key={genre} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                {genre}
              </span>
            ))}
          </div>

          <div className="text-sm text-gray-600 space-y-1 mb-3">
            {film.duration_minutes && (
              <p>
                <strong>Durée:</strong> {formatDuration(film.duration_minutes)}
              </p>
            )}
            {film.director && (
              <p>
                <strong>Réalisateur:</strong> {film.director}
              </p>
            )}
            {film.nationality && (
              <p>
                <strong>Nationalité:</strong> {film.nationality}
              </p>
            )}
            {film.certificate && (
              <p>
                <strong>Classification:</strong> {film.certificate}
              </p>
            )}
          </div>

          {(film.press_rating || film.audience_rating) && (
            <div className="flex gap-4 mb-3">
              {film.press_rating && (
                <div className="flex items-center gap-1">
                  <span className="text-yellow-500">★</span>
                  <span className="font-semibold">{film.press_rating.toFixed(1)}</span>
                  <span className="text-xs text-gray-500">Presse</span>
                </div>
              )}
              {film.audience_rating && (
                <div className="flex items-center gap-1">
                  <span className="text-yellow-500">★</span>
                  <span className="font-semibold">{film.audience_rating.toFixed(1)}</span>
                  <span className="text-xs text-gray-500">Spectateurs</span>
                </div>
              )}
            </div>
          )}

          {film.synopsis && <p className="text-sm text-gray-700 line-clamp-3">{film.synopsis}</p>}
        </div>
      </div>
    </div>
  );
}
