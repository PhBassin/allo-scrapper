import { useState } from 'react';
import type { Theater } from '../types';
import type { TheaterUpdate } from '../api/theaters';

const ALLOCINE_URL_PREFIX = 'https://www.allocine.fr/';

function isAllocineUrl(url: string): boolean {
  return url.startsWith(ALLOCINE_URL_PREFIX);
}

function validateName(value: string): string | undefined {
  if (!value.trim()) return 'Name is required';
  if (value.trim().length > 100) return 'Name must be at most 100 characters';
  return undefined;
}

function validateUrl(value: string): string | undefined {
  if (!value.trim()) return undefined;
  if (!isAllocineUrl(value)) return 'Must be an Allocine URL (https://www.allocine.fr/...)';
  if (value.length > 2048) return 'URL must be at most 2048 characters';
  return undefined;
}

function validateAddress(value: string): string | undefined {
  if (value.trim() && value.length > 200) return 'Address must be at most 200 characters';
  return undefined;
}

function validatePostalCode(value: string): string | undefined {
  if (value.trim()) {
    if (value.length > 10) return 'Postal code must be at most 10 characters';
    if (!/^[a-zA-Z0-9]+$/.test(value)) return 'Postal code must be alphanumeric';
  }
  return undefined;
}

function validateCity(value: string): string | undefined {
  if (value.trim() && value.length > 100) return 'City must be at most 100 characters';
  return undefined;
}

function validateScreenCount(value: string): string | undefined {
  if (value.trim()) {
    const num = Number(value);
    if (isNaN(num)) return 'Screen count must be a number';
    if (!Number.isInteger(num)) return 'Screen count must be an integer';
    if (num < 1 || num > 50) return 'Screen count must be between 1 and 50';
  }
  return undefined;
}

export function useEditTheaterForm(
  theater: Theater,
  onSave: (id: string, updates: TheaterUpdate) => Promise<void>,
  onClose: () => void
) {
  const [name, setName] = useState(theater.name);
  const [url, setUrl] = useState(theater.url ?? '');
  const [address, setAddress] = useState(theater.address ?? '');
  const [postalCode, setPostalCode] = useState(theater.postal_code ?? '');
  const [city, setCity] = useState(theater.city ?? '');
  const [screenCount, setScreenCount] = useState<string>(
    theater.screen_count != null ? String(theater.screen_count) : ''
  );

  const [nameError, setNameError] = useState<string | undefined>();
  const [urlError, setUrlError] = useState<string | undefined>();
  const [addressError, setAddressError] = useState<string | undefined>();
  const [postalCodeError, setPostalCodeError] = useState<string | undefined>();
  const [cityError, setCityError] = useState<string | undefined>();
  const [screenCountError, setScreenCountError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges =
    name.trim() !== theater.name.trim() ||
    url.trim() !== (theater.url ?? '').trim() ||
    address.trim() !== (theater.address ?? '').trim() ||
    postalCode.trim() !== (theater.postal_code ?? '').trim() ||
    city.trim() !== (theater.city ?? '').trim() ||
    screenCount.trim() !== (theater.screen_count != null ? String(theater.screen_count) : '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nErr = validateName(name);
    const uErr = validateUrl(url);
    const aErr = validateAddress(address);
    const pErr = validatePostalCode(postalCode);
    const cErr = validateCity(city);
    const scErr = validateScreenCount(screenCount);

    setNameError(nErr);
    setUrlError(uErr);
    setAddressError(aErr);
    setPostalCodeError(pErr);
    setCityError(cErr);
    setScreenCountError(scErr);

    if (nErr || uErr || aErr || pErr || cErr || scErr) return;

    setIsSaving(true);
    setSubmitError(null);
    try {
      const updates: TheaterUpdate = {};

      if (name.trim() !== theater.name.trim()) updates.name = name.trim();
      if (url.trim() !== (theater.url ?? '').trim()) updates.url = url.trim() || undefined;
      if (address.trim() !== (theater.address ?? '').trim()) updates.address = address.trim() || undefined;
      if (postalCode.trim() !== (theater.postal_code ?? '').trim())
        updates.postal_code = postalCode.trim() || undefined;
      if (city.trim() !== (theater.city ?? '').trim()) updates.city = city.trim() || undefined;

      const currentScreenCount = theater.screen_count != null ? String(theater.screen_count) : '';
      if (screenCount.trim() !== currentScreenCount) {
        updates.screen_count = screenCount.trim() ? Number(screenCount.trim()) : undefined;
      }

      await onSave(theater.id, updates);
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
    name,
    setName,
    url,
    setUrl,
    address,
    setAddress,
    postalCode,
    setPostalCode,
    city,
    setCity,
    screenCount,
    setScreenCount,
    nameError,
    urlError,
    addressError,
    postalCodeError,
    cityError,
    screenCountError,
    submitError,
    isSaving,
    hasChanges,
    handleSubmit,
    handleBackdropClick,
    inputClass,
  };
}
