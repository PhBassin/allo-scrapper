import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getCinemas, createCinema, updateCinema, deleteCinema } from '../../api/cinemas';
import type { CinemaCreate, CinemaUpdate } from '../../api/cinemas';
import type { Cinema } from '../../types';
import AddCinemaModal from '../../components/admin/AddCinemaModal';
import EditCinemaModal from '../../components/admin/EditCinemaModal';
import DeleteCinemaDialog from '../../components/admin/DeleteCinemaDialog';

const SUCCESS_DISMISS_MS = 5000;

const CinemasPage: React.FC = () => {
  const [cinemas, setCinemas] = useState<Cinema[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Modal / dialog state
  const [showAddModal, setShowAddModal] = useState(false);
  const [cinemaToEdit, setCinemaToEdit] = useState<Cinema | null>(null);
  const [cinemaToDelete, setCinemaToDelete] = useState<Cinema | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Data fetching ────────────────────────────────────────────────────────────

  const fetchCinemas = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCinemas();
      setCinemas(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch cinemas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCinemas();
  }, [fetchCinemas]);

  // ── Success message auto-dismiss ─────────────────────────────────────────────

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), SUCCESS_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [successMessage]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleAdd = async (data: CinemaCreate) => {
    await createCinema(data);
    setShowAddModal(false);
    setSuccessMessage('Cinema added successfully');
    await fetchCinemas();
  };

  const handleUpdate = async (id: string, updates: CinemaUpdate) => {
    await updateCinema(id, updates);
    setCinemaToEdit(null);
    setSuccessMessage('Cinema updated successfully');
    await fetchCinemas();
  };

  const handleDelete = async (cinemaId: string) => {
    try {
      setIsDeleting(true);
      setDeleteError(null);
      await deleteCinema(cinemaId);
      setCinemaToDelete(null);
      setSuccessMessage('Cinema deleted successfully');
      await fetchCinemas();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete cinema');
    } finally {
      setIsDeleting(false);
    }
  };

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
        <button
          onClick={() => setShowAddModal(true)}
          data-testid="add-cinema-button"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
        >
          Add Cinema
        </button>
      </div>

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
                      <button
                        onClick={() => setCinemaToEdit(cinema)}
                        data-testid={`edit-cinema-${cinema.id}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setCinemaToDelete(cinema);
                          setDeleteError(null);
                        }}
                        data-testid={`delete-cinema-${cinema.id}`}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
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
