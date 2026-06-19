import React, { useState, useMemo, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTheaters } from '../../api/theaters';
import type { Theater } from '../../types';
import AddTheaterModal from '../../components/admin/AddTheaterModal';
import EditTheaterModal from '../../components/admin/EditTheaterModal';
import DeleteTheaterDialog from '../../components/admin/DeleteTheaterDialog';
import ScrapeProgress from '../../components/ScrapeProgress';
import { AuthContext } from '../../contexts/AuthContext';
import { useTheatersCrud } from '../../hooks/useTheatersCrud';
import { useScrapeTracking } from '../../hooks/useScrapeTracking';
import { TheatersToolbar } from '../../components/admin/TheatersToolbar';
import { TheatersTable } from '../../components/admin/TheatersTable';
import { TheatersMessages } from '../../components/admin/TheatersMessages';

const TheatersPage: React.FC = () => {
  const { hasPermission } = useContext(AuthContext);
  const canScrapeAll = hasPermission('scraper:trigger');
  const canScrapeSingle = hasPermission('scraper:trigger_single');
  const canCreate = hasPermission('theaters:create');
  const canUpdate = hasPermission('theaters:update');
  const canDelete = hasPermission('theaters:delete');

  const { data: theaters = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['theaters'],
    queryFn: getTheaters,
  });

  const error = queryError instanceof Error ? queryError.message : null;

  const crud = useTheatersCrud();
  const scrape = useScrapeTracking();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTheaters = useMemo(
    () => (searchQuery.trim() ? theaters.filter((t) => matchesSearch(t, searchQuery)) : theaters),
    [theaters, searchQuery]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading theaters...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <TheatersToolbar
        canScrapeAll={canScrapeAll}
        canCreate={canCreate}
        onScrapeAll={scrape.triggerAll}
        onScrapeStart={scrape.handleScrapeStart}
        onAdd={crud.openAddModal}
      />

      {scrape.showProgress && (
        <div className="mb-6">
          <ScrapeProgress onComplete={scrape.handleScrapeComplete} />
        </div>
      )}

      <TheatersMessages successMessage={crud.successMessage} errorMessage={error} />

      <TheaterSearch value={searchQuery} onChange={setSearchQuery} />

      <TheaterList
        theaters={filteredTheaters}
        searchQuery={searchQuery}
        canScrapeSingle={canScrapeSingle}
        canUpdate={canUpdate}
        canDelete={canDelete}
        onScrapeSingle={scrape.triggerSingle}
        onEdit={crud.openEditModal}
        onDelete={crud.openDeleteDialog}
      />

      <AddTheaterModal
        isOpen={crud.showAddModal}
        onClose={crud.closeAddModal}
        onAdd={crud.handleAdd}
      />

      {crud.theaterToEdit && (
        <EditTheaterModal
          key={crud.theaterToEdit.id}
          isOpen={true}
          theater={crud.theaterToEdit}
          onClose={crud.closeEditModal}
          onSave={crud.handleUpdate}
        />
      )}

      {crud.theaterToDelete && (
        <DeleteTheaterDialog
          isOpen={true}
          theater={crud.theaterToDelete}
          onClose={crud.closeDeleteDialog}
          onConfirm={crud.handleDelete}
          isDeleting={crud.isDeleting}
          error={crud.deleteError}
        />
      )}
    </div>
  );
};

function matchesSearch(theater: Theater, q: string) {
  const lower = q.toLowerCase();
  return (
    theater.name.toLowerCase().includes(lower) ||
    theater.id.toLowerCase().includes(lower) ||
    (theater.city ?? '').toLowerCase().includes(lower)
  );
}

interface TheaterSearchProps {
  value: string;
  onChange: (q: string) => void;
}

function TheaterSearch({ value, onChange }: TheaterSearchProps) {
  return (
    <div className="mb-4">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by name, ID, or city..."
        data-testid="theater-search-input"
        className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  );
}

interface TheaterListProps {
  theaters: Theater[];
  searchQuery: string;
  canScrapeSingle: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onScrapeSingle: (theaterId: string) => Promise<void>;
  onEdit: (theater: Theater) => void;
  onDelete: (theater: Theater) => void;
}

function TheaterList({
  theaters,
  searchQuery,
  canScrapeSingle,
  canUpdate,
  canDelete,
  onScrapeSingle,
  onEdit,
  onDelete,
}: TheaterListProps) {
  if (theaters.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">
          {searchQuery.trim() ? 'No theaters match your search' : 'No theaters found'}
        </p>
      </div>
    );
  }
  return (
    <TheatersTable
      theaters={theaters}
      canScrapeSingle={canScrapeSingle}
      canUpdate={canUpdate}
      canDelete={canDelete}
      onScrapeSingle={onScrapeSingle}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
}

export default TheatersPage;