import { memo } from 'react';
import { Link } from 'react-router-dom';
import type { Theater } from '../types';

interface TheatersQuickLinksProps {
  theaters: Theater[];
  canAddTheater: boolean;
  onAddTheater: () => void;
}

function TheatersQuickLinks({ theaters, canAddTheater, onAddTheater }: TheatersQuickLinksProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm mb-6" data-testid="theater-list">
      <div className="flex flex-wrap gap-2">
        {theaters.map((theater) => (
          <Link
            key={theater.id}
            to={`/theater/${theater.id}`}
            data-testid="theater-list-item"
            className="px-3 py-1.5 bg-gray-50 text-gray-700 text-sm rounded-lg hover:bg-primary hover:text-black transition font-semibold"
          >
            {theater.name}
          </Link>
        ))}
        {canAddTheater && (
          <button
            onClick={onAddTheater}
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
// but theaters and canAddTheater haven't changed.
export default memo(TheatersQuickLinks);
