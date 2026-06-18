import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createTheater, updateTheater, deleteTheater } from '../api/theaters';
import type { TheaterCreate, TheaterUpdate } from '../api/theaters';
import type { Theater } from '../types';

const SUCCESS_DISMISS_MS = 5000;

/**
 * Encapsulates theater CRUD mutation logic, success/error messaging,
 * and modal/dialog state for create, edit, and delete operations.
 */
export function useTheatersCrud() {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal / dialog state
  const [showAddModal, setShowAddModal] = useState(false);
  const [theaterToEdit, setTheaterToEdit] = useState<Theater | null>(null);
  const [theaterToDelete, setTheaterToDelete] = useState<Theater | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Auto-dismiss success message after SUCCESS_DISMISS_MS
  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), SUCCESS_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['theaters'] });

  const createMutation = useMutation({
    mutationFn: createTheater,
    onSuccess: () => {
      setShowAddModal(false);
      setSuccessMessage('Theater added successfully');
      invalidate();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: TheaterUpdate }) =>
      updateTheater(id, updates),
    onSuccess: () => {
      setTheaterToEdit(null);
      setSuccessMessage('Theater updated successfully');
      invalidate();
    },
  });

  const handleAddAsync = async (data: TheaterCreate): Promise<void> => {
    await createMutation.mutateAsync(data);
  };

  const handleUpdateAsync = async (id: string, updates: TheaterUpdate): Promise<void> => {
    await updateMutation.mutateAsync({ id, updates });
  };

  const deleteMutation = useMutation({
    mutationFn: deleteTheater,
    onSuccess: () => {
      setTheaterToDelete(null);
      setSuccessMessage('Theater deleted successfully');
      invalidate();
      setIsDeleting(false);
    },
    onError: (err) => {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete theater');
      setIsDeleting(false);
    },
  });

  return {
    // Success / error banners
    successMessage,
    deleteError,

    // Add modal
    showAddModal,
    openAddModal: () => setShowAddModal(true),
    closeAddModal: () => setShowAddModal(false),

    // Edit modal
    theaterToEdit,
    openEditModal: (theater: Theater) => setTheaterToEdit(theater),
    closeEditModal: () => setTheaterToEdit(null),

    // Delete dialog
    theaterToDelete,
    openDeleteDialog: (theater: Theater) => {
      setTheaterToDelete(theater);
      setDeleteError(null);
    },
    closeDeleteDialog: () => {
      setTheaterToDelete(null);
      setDeleteError(null);
    },
    isDeleting,
    setIsDeleting,

    // Mutations
    handleAdd: handleAddAsync,
    handleUpdate: handleUpdateAsync,
    handleDelete: (theaterId: string) => {
      setIsDeleting(true);
      setDeleteError(null);
      deleteMutation.mutate(theaterId);
    },
  };
}