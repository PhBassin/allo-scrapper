import { useState } from 'react';
import type { FormEvent } from 'react';
import type { TheaterCreate } from '../../../api/theaters';
import { validateSmartUrl, type SmartFormErrors } from './validation.js';
import { FormActions, inputClass } from './FormActions.js';

interface SmartAddFormProps {
  isSubmitting: boolean;
  onSubmit: (data: TheaterCreate) => Promise<void>;
  onCancel: () => void;
}

export function SmartAddForm({ isSubmitting, onSubmit, onCancel }: SmartAddFormProps) {
  const [url, setUrl] = useState('');
  const [errors, setErrors] = useState<SmartFormErrors>({});

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const urlError = validateSmartUrl(url);
    if (urlError) {
      setErrors({ url: urlError });
      return;
    }
    setErrors({});
    try {
      await onSubmit({ url });
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : 'Failed to add theater' });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="px-6 py-4">
      <p className="text-sm text-gray-500 mb-4">
        The theater metadata and showtimes will be automatically scraped. This can take 30+ seconds.
      </p>
      <div className="mb-4">
        <label htmlFor="smart-url" className="block text-sm font-medium text-gray-700 mb-1">
          Allocine URL
        </label>
        <input
          id="smart-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={isSubmitting}
          placeholder="https://www.allocine.fr/seance/salle_gen_csalle=CXXXX.html"
          className={inputClass(!!errors.url)}
        />
        {errors.url && <p className="mt-1 text-sm text-red-600">{errors.url}</p>}
      </div>
      {errors.submit && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{errors.submit}</p>
        </div>
      )}
      <FormActions isSubmitting={isSubmitting} onCancel={onCancel} />
    </form>
  );
}