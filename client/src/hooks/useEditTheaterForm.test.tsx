import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEditTheaterForm } from './useEditTheaterForm.js';
import type { Theater } from '../types/index.js';
import type { TheaterUpdate } from '../api/theaters.js';

const baseTheater: Theater = {
  id: 'W7504',
  name: 'Cinéma A',
  url: 'https://www.allocine.fr/salle/W7504',
  address: '1 rue de la Paix',
  postal_code: '75001',
  city: 'Paris',
  screen_count: 5,
};

type SaveFn = (id: string, updates: TheaterUpdate) => Promise<void>;
type CloseFn = () => void;
type FormState = ReturnType<typeof useEditTheaterForm>;

describe('useEditTheaterForm', () => {
  let onSave: ReturnType<typeof vi.fn<SaveFn>>;
  let onClose: ReturnType<typeof vi.fn<CloseFn>>;

  beforeEach(() => {
    onSave = vi.fn<SaveFn>().mockResolvedValue(undefined);
    onClose = vi.fn<CloseFn>();
  });

  const submitWith = async (mutate: (state: FormState) => void) => {
    const { result } = renderHook(() => useEditTheaterForm(baseTheater, onSave, onClose));
    act(() => mutate(result.current));
    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;
    await act(async () => {
      await result.current.handleSubmit(fakeEvent);
    });
    return result;
  };

  it('initializes state from theater', () => {
    const { result } = renderHook(() =>
      useEditTheaterForm(baseTheater, onSave, onClose)
    );
    expect(result.current.name).toBe('Cinéma A');
    expect(result.current.url).toBe('https://www.allocine.fr/salle/W7504');
    expect(result.current.screenCount).toBe('5');
    expect(result.current.hasChanges).toBe(false);
  });

  it('detects changes when a field is edited', () => {
    const { result } = renderHook(() =>
      useEditTheaterForm(baseTheater, onSave, onClose)
    );
    act(() => result.current.setName('Cinéma B'));
    expect(result.current.hasChanges).toBe(true);
  });

  it('submits updates with only changed fields', async () => {
    const result = await submitWith((c) => c.setName('Cinéma B'));
    expect(onSave).toHaveBeenCalledWith('W7504', { name: 'Cinéma B' });
    expect(result.current.submitError).toBeNull();
  });

  it('captures submit errors', async () => {
    onSave.mockRejectedValueOnce(new Error('Network down'));
    const result = await submitWith((c) => c.setName('Cinéma B'));
    expect(result.current.submitError).toBe('Network down');
    expect(result.current.isSaving).toBe(false);
  });

  it('rejects non-allocine URL', async () => {
    const result = await submitWith((c) => c.setUrl('https://example.com/foo'));
    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.urlError).toMatch(/Allocine/);
  });

  it('rejects screen count out of range', async () => {
    const result = await submitWith((c) => c.setScreenCount('99'));
    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.screenCountError).toMatch(/between 1 and 50/);
  });

  it('blocks submit when validation fails', async () => {
    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;
    const { result } = renderHook(() => useEditTheaterForm(baseTheater, onSave, onClose));
    act(() => result.current.setName(''));
    await act(async () => {
      await result.current.handleSubmit(fakeEvent);
    });
    expect(fakeEvent.preventDefault).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.nameError).toBe('Name is required');
  });
});