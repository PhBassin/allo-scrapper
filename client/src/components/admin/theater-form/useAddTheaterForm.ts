import { useState } from 'react';

/**
 * Tracks the in-flight submission flag for the AddTheaterModal. Each tab
 * form manages its own field state internally.
 */
export function useAddTheaterForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  return { isSubmitting, setIsSubmitting };
}