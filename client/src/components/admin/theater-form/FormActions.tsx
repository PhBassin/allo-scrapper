/**
 * Shared Tailwind class for theater-form inputs. Switches the border to
 * `border-red-500` when the field has a validation error.
 */
export const inputClass = (hasError: boolean) =>
  `w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed ${
    hasError ? 'border-red-500' : 'border-gray-300'
  }`;

interface FormActionsProps {
  isSubmitting: boolean;
  onCancel: () => void;
  submitLabel?: string;
}

/**
 * Cancel + submit button row shared by every form in `theater-form/`.
 *
 * Both buttons are disabled while `isSubmitting` so an in-flight request
 * can't be cancelled mid-flight (matching the original behavior in
 * `AddTheaterModal`).
 */
export function FormActions({ isSubmitting, onCancel, submitLabel = 'Add Theater' }: FormActionsProps) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={isSubmitting}
        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isSubmitting}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Adding...' : submitLabel}
      </button>
    </div>
  );
}