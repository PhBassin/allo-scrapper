import React, { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCinemas, createCinema, updateCinema, deleteCinema } from '../../api/cinemas';
import type { CinemaCreate, CinemaUpdate } from '../../api/cinemas';
import { triggerScrape, triggerCinemaScrape, getScrapeStatus } from '../../api/client';
import type { Cinema } from '../../types';
import AddCinemaModal from '../../components/admin/AddCinemaModal';
import EditCinemaModal from '../../components/admin/EditCinemaModal';
import DeleteCinemaDialog from '../../components/admin/DeleteCinemaDialog';
import ScrapeButton from '../../components/ScrapeButton';
import ScrapeProgress from '../../components/ScrapeProgress';
import Button from '../../components/ui/Button';
import LinkButton from '../../components/ui/LinkButton';
import { AuthContext } from '../../contexts/AuthContext';

const SUCCESS_DISMISS_MS = 5000;

const CinemasPage: React.FC = () => {
  const { hasPermission } = useContext(AuthContext);
  const canScrapeAll = hasPermission('scraper:trigger');
  const canScrapeSingle = hasPermission('scraper:trigger_single');
  const canCreate = hasPermission('cinemas:create');
  const canUpdate = hasPermission('cinemas:update');
  const canDelete = hasPermission('cinemas:delete');

  const queryClient = useQueryClient();

  const { data: cinemas = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['cinemas'],
    queryFn: getCinemas
  });

  const error = queryError instanceof Error ? queryError.message : null;

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Scraping state
  const [showProgress, setShowProgress] = useState(false);
  const [, setScrapingCinemaId] = useState<string | null>(null);

  // Modal / dialog state
  const [showAddModal, setShowAddModal] = useState(false);
  const [cinemaToEdit, setCinemaToEdit] = useState<Cinema | null>(null);
  const [cinemaToDelete, setCinemaToDelete] = useState<Cinema | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Check if scrape is already running on mount ───────────────────────────────

  useEffect(() => {
    getScrapeStatus().then((status) => {
      if (status.isRunning) {
        setShowProgress(true);
      }
    }).catch(() => {
      // Non-critical — ignore errors checking status
    });
  }, []);

  // ── Success message auto-dismiss ─────────────────────────────────────────────

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), SUCCESS_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [successMessage]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: createCinema,
    onSuccess: () => {
      setShowAddModal(false);
      setSuccessMessage('Cinema added successfully');
      queryClient.invalidateQueries({ queryKey: ['cinemas'] });
    }
  });

  const handleAdd = async (data: CinemaCreate) => {
    createMutation.mutate(data);
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: CinemaUpdate }) => updateCinema(id, updates),
    onSuccess: () => {
      setCinemaToEdit(null);
      setSuccessMessage('Cinema updated successfully');
      queryClient.invalidateQueries({ queryKey: ['cinemas'] });
    }
  });

  const handleUpdate = async (id: string, updates: CinemaUpdate) => {
    updateMutation.mutate({ id, updates });
  };

  const deleteMutation = useMutation({
    mutationFn: deleteCinema,
    onSuccess: () => {
      setCinemaToDelete(null);
      setSuccessMessage('Cinema deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['cinemas'] });
      setIsDeleting(false);
    },
    onError: (err) => {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete cinema');
      setIsDeleting(false);
    }
  });

  const handleDelete = async (cinemaId: string) => {
    setIsDeleting(true);
    setDeleteError(null);
    deleteMutation.mutate(cinemaId);
  };

  // ── Scraping handlers ────────────────────────────────────────────────────────

  const handleScrapeStart = useCallback(() => {
    setShowProgress(true);
  }, []);

  const handleScrapeComplete = useCallback(() => {
    setTimeout(() => {
      setShowProgress(false);
      setScrapingCinemaId(null);
      queryClient.invalidateQueries({ queryKey: ['cinemas'] });
    }, 2000);
  }, [queryClient]);

  // ── Filtering ────────────────────────────────────────────────────────────────

  // ⚡ PERFORMANCE: Memoize the filtered cinemas list to prevent expensive
  // recalculation of the entire array on every render, especially when unrelated
  // state (like modal visibility or form data) changes.
  const filteredCinemas = useMemo(() => {
    return cinemas.filter((cinema) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        cinema.name.toLowerCase().includes(q) ||
        cinema.id.toLowerCase().includes(q) ||
        (cinema.city ?? '').toLowerCase().includes(q)
      );
    });
  }, [cinemas, searchQuery]);

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading cinemas...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Cinema Management</h1>
        <div className="flex items-center gap-3">
          {canScrapeAll && (
            <ScrapeButton
              onTrigger={async () => { await triggerScrape(); }}
              onScrapeStart={handleScrapeStart}
              buttonText="Scraper tous les cinémas"
              loadingText="Scraping..."
              successText="Scraping démarré !"
              testId="scrape-all-button"
            />
          )}
          {canCreate && (
            <Button
              onClick={() => setShowAddModal(true)}
              data-testid="add-cinema-button"
            >
              Add Cinema
            </Button>
          )}
        </div>
      </div>

      {/* Scrape Progress */}
      {showProgress && (
        <div className="mb-6">
          <ScrapeProgress onComplete={handleScrapeComplete} />
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800">{successMessage}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, ID, or city..."
          data-testid="cinema-search-input"
          className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Empty State */}
      {filteredCinemas.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600">
            {searchQuery.trim() ? 'No cinemas match your search' : 'No cinemas found'}
          </p>
        </div>
      ) : (
        /* Cinemas Table */
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  City
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Screens
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCinemas.map((cinema) => (
                <tr key={cinema.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-mono text-sm text-gray-900">{cinema.id}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900">{cinema.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{cinema.city ?? '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {cinema.screen_count != null ? cinema.screen_count : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                     <div className="flex justify-end gap-2">
                       {canScrapeSingle && (
                         <LinkButton
                           variant="success"
                           onClick={() => {
                             setScrapingCinemaId(cinema.id);
                             triggerCinemaScrape(cinema.id)
                               .then(() => handleScrapeStart())
                               .catch(() => setScrapingCinemaId(null));
                           }}
                           data-testid={`scrape-cinema-${cinema.id}`}
                         >
                           Scraper
                         </LinkButton>
                       )}
                       {canUpdate && (
                         <LinkButton
                           onClick={() => setCinemaToEdit(cinema)}
                           data-testid={`edit-cinema-${cinema.id}`}
                         >
                           Edit
                         </LinkButton>
                       )}
                       {canDelete && (
                         <LinkButton
                           variant="danger"
                           onClick={() => {
                             setCinemaToDelete(cinema);
                             setDeleteError(null);
                           }}
                           data-testid={`delete-cinema-${cinema.id}`}
                         >
                           Delete
                         </LinkButton>
                       )}
                     </div>
                   </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Cinema Modal */}
      <AddCinemaModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAdd}
      />

      {/* Edit Cinema Modal — key forces remount when switching cinemas */}
      {cinemaToEdit && (
        <EditCinemaModal
          key={cinemaToEdit.id}
          isOpen={true}
          cinema={cinemaToEdit}
          onClose={() => setCinemaToEdit(null)}
          onSave={handleUpdate}
        />
      )}

      {/* Delete Cinema Dialog */}
      {cinemaToDelete && (
        <DeleteCinemaDialog
          isOpen={true}
          cinema={cinemaToDelete}
          onClose={() => {
            setCinemaToDelete(null);
            setDeleteError(null);
          }}
          onConfirm={handleDelete}
          isDeleting={isDeleting}
          error={deleteError}
        />
      )}
    </div>
  );
};

export default CinemasPage;
