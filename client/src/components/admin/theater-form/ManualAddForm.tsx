import { useState } from 'react';
import type { FormEvent } from 'react';
import type { TheaterCreate } from '../../../api/theaters';
import { validateManual, type ManualFormErrors } from './validation.js';
import { FormActions, inputClass } from './FormActions.js';

interface ManualAddFormProps {
  isSubmitting: boolean;
  onSubmit: (data: TheaterCreate) => Promise<void>;
  onCancel: () => void;
}

export function ManualAddForm({ isSubmitting, onSubmit, onCancel }: ManualAddFormProps) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [errors, setErrors] = useState<ManualFormErrors>({});

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validationErrors = validateManual(id, name, url);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    try {
      await onSubmit({ id, name: name.trim(), url });
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : 'Failed to add theater' });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="px-6 py-4">
      <TextField
        id="manual-id"
        label="Theater ID"
        value={id}
        onChange={setId}
        disabled={isSubmitting}
        placeholder="e.g. C0159"
        error={errors.id}
      />
      <TextField
        id="manual-name"
        label="Name"
        value={name}
        onChange={setName}
        disabled={isSubmitting}
        placeholder="e.g. UGC Ciné Cité Les Halles"
        error={errors.name}
      />
      <TextField
        id="manual-url"
        label="Allocine URL"
        type="url"
        value={url}
        onChange={setUrl}
        disabled={isSubmitting}
        placeholder="https://www.allocine.fr/seance/salle_gen_csalle=CXXXX.html"
        error={errors.url}
      />
      {errors.submit && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{errors.submit}</p>
        </div>
      )}
      <FormActions isSubmitting={isSubmitting} onCancel={onCancel} />
    </form>
  );
}

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  placeholder: string;
  error?: string;
  type?: 'text' | 'url';
}

function TextField({ id, label, value, onChange, disabled, placeholder, error, type = 'text' }: TextFieldProps) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={inputClass(!!error)}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}