import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet, mockPost, mockPut, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: mockGet,
      post: mockPost,
      put: mockPut,
      delete: mockDelete,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
  },
}));

import { getCinemas, getCinemaSchedule } from './client';

describe('Cinema API Client', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('uses the shared cinemas endpoint outside tenant routes', async () => {
    mockGet.mockResolvedValueOnce({
      data: { success: true, data: [] },
    });

    await getCinemas();

    expect(mockGet).toHaveBeenCalledWith('/cinemas');
  });

  it('uses the tenant-scoped cinemas endpoint on org routes', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/org/acme/cinema/C1234',
      },
    });

    mockGet.mockResolvedValueOnce({
      data: { success: true, data: [] },
    });

    await getCinemas();

    expect(mockGet).toHaveBeenCalledWith('/org/acme/cinemas');
  });

  it('uses the tenant-scoped cinema detail endpoint on org routes', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/org/acme/cinema/C1234',
      },
    });

    mockGet.mockResolvedValueOnce({
      data: { success: true, data: { showtimes: [], weekStart: '2026-04-15' } },
    });

    await getCinemaSchedule('C1234');

    expect(mockGet).toHaveBeenCalledWith('/org/acme/cinemas/C1234');
  });
});
