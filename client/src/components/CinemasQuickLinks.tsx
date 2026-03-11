import { memo } from 'react';
import { Link } from 'react-router-dom';
import type { Cinema } from '../types';

interface CinemasQuickLinksProps {
  cinemas: Cinema[];
  canAddCinema: boolean;
  onAddCinema: () => void;
}

function CinemasQuickLinks({ cinemas, canAddCinema, onAddCinema }: CinemasQuickLinksProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm mb-10">
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
        {canAddCinema && (
          <button
            onClick={onAddCinema}
            className="px-3 py-1.5 bg-white border border-dashed border-gray-300 text-gray-500 text-sm rounded-lg hover:border-primary hover:text-primary transition font-semibold cursor-pointer active:scale-95"
          >
            + Ajouter un cinéma
          </button>
        )}
      </div>
    </div>
  );
}

// ⚡ PERFORMANCE: Memoize component to prevent re-renders when parent re-renders
// but cinemas and canAddCinema haven't changed.
export default memo(CinemasQuickLinks);
