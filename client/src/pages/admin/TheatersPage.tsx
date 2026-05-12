import React, { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTheaters, createTheater, updateTheater, deleteTheater } from '../../api/theaters';
import type { TheaterCreate, TheaterUpdate } from '../../api/theaters';
import { triggerScrape, triggerTheaterScrape, getScrapeStatus } from '../../api/client';
import type { Theater } from '../../types';
import type { TrackedScrapeJob } from '../../hooks/useScrapeProgress';
import AddTheaterModal from '../../components/admin/AddTheaterModal';
import EditTheaterModal from '../../components/admin/EditTheaterModal';
import DeleteTheaterDialog from '../../components/admin/DeleteTheaterDialog';
import ScrapeButton from '../../components/ScrapeButton';
import ScrapeProgress from '../../components/ScrapeProgress';
import Button from '../../components/ui/Button';
import LinkButton from '../../components/ui/LinkButton';
import { AuthContext } from '../../contexts/AuthContext';

const SUCCESS_DISMISS_MS = 5000;

const TheatersPage: React.FC = () => {
  const { hasPermission } = useContext(AuthContext);
  const canScrapeAll = hasPermission('scraper:trigger');
  const canScrapeSingle = hasPermission('scraper:trigger_single');
  const canCreate = hasPermission('theaters:create');
  const canUpdate = hasPermission('theaters:update');
  const canDelete = hasPermission('theaters:delete');

  const queryClient = useQueryClient();

  const { data: theaters = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['theaters'],
    queryFn: getTheaters
  });

  const error = queryError instanceof Error ? queryError.message : null;

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Scraping state
  const [showProgress, setShowProgress] = useState(false);
  const [trackedJobs, setTrackedJobs] = useState<TrackedScrapeJob[]>([]);
  const [, setScrapingTheaterId] = useState<string | null>(null);

  // Modal / dialog state
  const [showAddModal, setShowAddModal] = useState(false);
  const [theaterToEdit, setTheaterToEdit] = useState<Theater | null>(null);
  const [theaterToDelete, setTheaterToDelete] = useState<Theater | null>(null);
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
    mutationFn: createTheater,
    onSuccess: () => {
      setShowAddModal(false);
      setSuccessMessage('Theater added successfully');
      queryClient.invalidateQueries({ queryKey: ['theaters'] });
    }
  });

  const handleAdd = async (data: TheaterCreate) => {
    createMutation.mutate(data);
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: TheaterUpdate }) => updateTheater(id, updates),
    onSuccess: () => {
      setTheaterToEdit(null);
      setSuccessMessage('Theater updated successfully');
      queryClient.invalidateQueries({ queryKey: ['theaters'] });
    }
  });

  const handleUpdate = async (id: string, updates: TheaterUpdate) => {
    updateMutation.mutate({ id, updates });
  };

  const deleteMutation = useMutation({
    mutationFn: deleteTheater,
    onSuccess: () => {
      setTheaterToDelete(null);
      setSuccessMessage('Theater deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['theaters'] });
      setIsDeleting(false);
    },
    onError: (err) => {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete theater');
      setIsDeleting(false);
    }
  });

  const handleDelete = async (theaterId: string) => {
    setIsDeleting(true);
    setDeleteError(null);
    deleteMutation.mutate(theaterId);
  };

  // ── Scraping handlers ────────────────────────────────────────────────────────

  const handleScrapeStart = useCallback(() => {
    setShowProgress(true);
  }, []);

  const handleScrapeComplete = useCallback(() => {
    setTimeout(() => {
      setShowProgress(false);
      setTrackedJobs([]);
      setScrapingTheaterId(null);
      queryClient.invalidateQueries({ queryKey: ['theaters'] });
    }, 2000);
  }, [queryClient]);

  const trackJob = useCallback((reportId: number, theaterName?: string) => {
    setTrackedJobs((prev) => {
      if (prev.some((job) => job.reportId === reportId)) {
        return prev;
      }

      return [...prev, { reportId, theaterName }];
    });
  }, []);

  // ── Filtering ────────────────────────────────────────────────────────────────

  // ⚡ PERFORMANCE: Memoize the filtered theaters list to prevent expensive
  // recalculation of the entire array on every render, especially when unrelated
  // state (like modal visibility or form data) changes.
  const filteredTheaters = useMemo(() => {
    return theaters.filter((theater) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        theater.name.toLowerCase().includes(q) ||
        theater.id.toLowerCase().includes(q) ||
        (theater.city ?? '').toLowerCase().includes(q)
      );
    });
  }, [theaters, searchQuery]);

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading theaters...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Theater Management</h1>
        <div className="flex items-center gap-3">
          {canScrapeAll && (
            <ScrapeButton
              onTrigger={async () => {
                const result = await triggerScrape();
                trackJob(result.reportId);
              }}
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
              data-testid="add-theater-button"
            >
              Add Theater
            </Button>
          )}
        </div>
      </div>

      {/* Scrape Progress */}
      {showProgress && (
        <div className="mb-6">
          <ScrapeProgress onComplete={handleScrapeComplete} trackedJobs={trackedJobs} />
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
          data-testid="theater-search-input"
          className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Empty State */}
      {filteredTheaters.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600">
            {searchQuery.trim() ? 'No theaters match your search' : 'No theaters found'}
          </p>
        </div>
      ) : (
        /* Theaters Table */
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
              {filteredTheaters.map((theater) => (
                <tr key={theater.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-mono text-sm text-gray-900">{theater.id}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900">{theater.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{theater.city ?? '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {theater.screen_count != null ? theater.screen_count : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                     <div className="flex justify-end gap-2">
                       {canScrapeSingle && (
                         <LinkButton
                           variant="success"
                            onClick={() => {
                              setScrapingTheaterId(theater.id);
                              triggerTheaterScrape(theater.id)
                                .then((result) => {
                                  trackJob(result.reportId, theater.name);
                                  handleScrapeStart();
                                })
                                .catch(() => setScrapingTheaterId(null));
                            }}
                           data-testid={`scrape-theater-${theater.id}`}
                         >
                           Scraper
                         </LinkButton>
                       )}
                       {canUpdate && (
                         <LinkButton
                           onClick={() => setTheaterToEdit(theater)}
                           data-testid={`edit-theater-${theater.id}`}
                         >
                           Edit
                         </LinkButton>
                       )}
                       {canDelete && (
                         <LinkButton
                           variant="danger"
                           onClick={() => {
                             setTheaterToDelete(theater);
                             setDeleteError(null);
                           }}
                           data-testid={`delete-theater-${theater.id}`}
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

      {/* Add Theater Modal */}
      <AddTheaterModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAdd}
      />

      {/* Edit Theater Modal — key forces remount when switching theaters */}
      {theaterToEdit && (
        <EditTheaterModal
          key={theaterToEdit.id}
          isOpen={true}
          theater={theaterToEdit}
          onClose={() => setTheaterToEdit(null)}
          onSave={handleUpdate}
        />
      )}

      {/* Delete Theater Dialog */}
      {theaterToDelete && (
        <DeleteTheaterDialog
          isOpen={true}
          theater={theaterToDelete}
          onClose={() => {
            setTheaterToDelete(null);
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

export default TheatersPage;
