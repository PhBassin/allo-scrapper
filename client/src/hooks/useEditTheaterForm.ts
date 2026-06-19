import { useState } from 'react';
import type { Theater } from '../types/index.js';
import type { TheaterUpdate } from '../api/theaters.js';
import {
  validateName,
  validateUrl,
  validateAddress,
  validatePostalCode,
  validateCity,
  validateScreenCount,
} from '../utils/theaterValidators.js';

type Validator = (value: string) => string | undefined;

interface FieldDef<T> {
  key: keyof FormState;
  validate: Validator;
  parseForUpdate: (trimmed: string) => T | undefined;
  isDifferent: (current: string, original: Theater) => boolean;
}

interface FormState {
  name: string;
  url: string;
  address: string;
  postalCode: string;
  city: string;
  screenCount: string;
}

const trim = (s: string | undefined) => (s ?? '').trim();

const FORM_FIELDS = [
  {
    key: 'name',
    validate: validateName,
    parseForUpdate: (v: string) => v as string | undefined,
    isDifferent: (current: string, original: Theater) =>
      current.trim() !== original.name.trim(),
  },
  {
    key: 'url',
    validate: validateUrl,
    parseForUpdate: (v: string) => v || undefined,
    isDifferent: (current: string, original: Theater) =>
      current.trim() !== trim(original.url),
  },
  {
    key: 'address',
    validate: validateAddress,
    parseForUpdate: (v: string) => v || undefined,
    isDifferent: (current: string, original: Theater) =>
      current.trim() !== trim(original.address),
  },
  {
    key: 'postalCode',
    validate: validatePostalCode,
    parseForUpdate: (v: string) => v || undefined,
    isDifferent: (current: string, original: Theater) =>
      current.trim() !== trim(original.postal_code),
  },
  {
    key: 'city',
    validate: validateCity,
    parseForUpdate: (v: string) => v || undefined,
    isDifferent: (current: string, original: Theater) =>
      current.trim() !== trim(original.city),
  },
  {
    key: 'screenCount',
    validate: validateScreenCount,
    parseForUpdate: (v: string) => (v ? Number(v) : undefined),
    isDifferent: (current: string, original: Theater) =>
      current.trim() !==
      (original.screen_count != null ? String(original.screen_count) : ''),
  },
] as const satisfies ReadonlyArray<FieldDef<unknown>>;

export function useEditTheaterForm(
  theater: Theater,
  onSave: (id: string, updates: TheaterUpdate) => Promise<void>,
  onClose: () => void
) {
  const [state, setState] = useState<FormState>({
    name: theater.name,
    url: theater.url ?? '',
    address: theater.address ?? '',
    postalCode: theater.postal_code ?? '',
    city: theater.city ?? '',
    screenCount:
      theater.screen_count != null ? String(theater.screen_count) : '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const setField = (key: keyof FormState, value: string) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const hasChanges = FORM_FIELDS.some((field) =>
    field.isDifferent(state[field.key], theater)
  );

  const validateAll = (): Partial<Record<keyof FormState, string>> => {
    const next: Partial<Record<keyof FormState, string>> = {};
    for (const field of FORM_FIELDS) {
      const err = field.validate(state[field.key]);
      if (err) next[field.key] = err;
    }
    return next;
  };

  const buildUpdates = (): TheaterUpdate => {
    const updates: TheaterUpdate = {};
    for (const field of FORM_FIELDS) {
      const current = state[field.key];
      if (field.isDifferent(current, theater)) {
        const value = field.parseForUpdate(current.trim());
        if (field.key === 'postalCode') {
          updates.postal_code = value as string | undefined;
        } else if (field.key === 'screenCount') {
          updates.screen_count = value as number | undefined;
        } else {
          updates[field.key as 'name' | 'url' | 'address' | 'city'] =
            value as string | undefined;
        }
      }
    }
    return updates;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateAll();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setIsSaving(true);
    setSubmitError(null);
    try {
      await onSave(theater.id, buildUpdates());
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save theater');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isSaving) onClose();
  };

  const inputClass = (hasError: boolean) =>
    `w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed ${
      hasError ? 'border-red-500' : 'border-gray-300'
    }`;

  return {
    name: state.name,
    setName: (v: string) => setField('name', v),
    url: state.url,
    setUrl: (v: string) => setField('url', v),
    address: state.address,
    setAddress: (v: string) => setField('address', v),
    postalCode: state.postalCode,
    setPostalCode: (v: string) => setField('postalCode', v),
    city: state.city,
    setCity: (v: string) => setField('city', v),
    screenCount: state.screenCount,
    setScreenCount: (v: string) => setField('screenCount', v),
    nameError: errors.name,
    urlError: errors.url,
    addressError: errors.address,
    postalCodeError: errors.postalCode,
    cityError: errors.city,
    screenCountError: errors.screenCount,
    submitError,
    isSaving,
    hasChanges,
    handleSubmit,
    handleBackdropClick,
    inputClass,
  };
}
