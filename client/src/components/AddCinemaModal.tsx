import { useState } from 'react';
import { addCinema } from '../api/client';

interface AddCinemaModalProps {
  onClose: () => void;
  onSuccess: (cinemaId: string) => void;
}

export default function AddCinemaModal({ onClose, onSuccess }: AddCinemaModalProps) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await addCinema({ id: id.trim(), name: name.trim(), url: url.trim() });
      onSuccess(id.trim());
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Erreur lors de l\'ajout du cinéma');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold">Ajouter un cinéma</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            aria-label="Fermer"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="cinema-id" className="block text-sm font-semibold text-gray-700 mb-1">
              Identifiant Allociné (ex : W7504)
            </label>
            <input
              id="cinema-id"
              type="text"
              value={id}
              onChange={e => setId(e.target.value)}
              required
              placeholder="W7504"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="cinema-name" className="block text-sm font-semibold text-gray-700 mb-1">
              Nom du cinéma
            </label>
            <input
              id="cinema-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="Épée de Bois"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="cinema-url" className="block text-sm font-semibold text-gray-700 mb-1">
              URL Allociné (page séances)
            </label>
            <input
              id="cinema-url"
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              required
              placeholder="https://www.allocine.fr/seance/salle_gen_csalle=W7504.html"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded border border-red-200">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-black transition
                ${isLoading ? 'bg-gray-300 cursor-not-allowed' : 'bg-primary hover:bg-yellow-500 active:scale-95'}`}
            >
              {isLoading ? 'Ajout en cours...' : 'Ajouter et scraper'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
