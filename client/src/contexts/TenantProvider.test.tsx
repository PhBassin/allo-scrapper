import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TenantProvider } from './TenantProvider';
import { TenantContext } from './TenantContext';
import { useContext } from 'react';

// ── Mock the saas API ────────────────────────────────────────────────────────
vi.mock('../api/saas', () => ({
  pingOrg: vi.fn(),
}));

import { pingOrg } from '../api/saas';

// Helper: wrap TenantProvider inside a MemoryRouter with a :slug param
function renderWithSlug(slug: string, child: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[`/org/${slug}`]}>
      <Routes>
        <Route path="/org/:slug" element={<TenantProvider>{child}</TenantProvider>} />
      </Routes>
    </MemoryRouter>
  );
}

// Helper consumer that exposes context values via data-testid attributes
function ContextInspector() {
  const { org, isLoading, notFound } = useContext(TenantContext);
  return (
    <div>
      <span data-testid="is-loading">{String(isLoading)}</span>
      <span data-testid="not-found">{String(notFound)}</span>
      <span data-testid="org-name">{org?.name ?? ''}</span>
    </div>
  );
}

describe('TenantProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows loading screen while fetching org', async () => {
    vi.mocked(pingOrg).mockImplementation(() => new Promise(() => {})); // never resolves

    renderWithSlug('acme', <ContextInspector />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders children with org data when ping succeeds', async () => {
    vi.mocked(pingOrg).mockResolvedValue({
      org: { id: 1, slug: 'acme', name: 'Acme Cinemas', status: 'active' },
    });

    renderWithSlug('acme', <ContextInspector />);

    await waitFor(() => {
      expect(screen.getByTestId('is-loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('not-found').textContent).toBe('false');
    expect(screen.getByTestId('org-name').textContent).toBe('Acme Cinemas');
  });

  it('renders 404 screen when ping fails', async () => {
    vi.mocked(pingOrg).mockRejectedValue(new Error('Not found'));

    renderWithSlug('unknown-org', <ContextInspector />);

    await waitFor(() => {
      expect(screen.getByText('Organization not found.')).toBeInTheDocument();
    });
  });

  it('renders 403 screen when ping fails with org access denied', async () => {
    const error = Object.assign(new Error('Access denied: organization mismatch'), {
      response: {
        status: 403,
        data: { error: 'Access denied: organization mismatch' },
      },
    });
    vi.mocked(pingOrg).mockRejectedValue(error);

    renderWithSlug('other-org', <ContextInspector />);

    await waitFor(() => {
      expect(screen.getByTestId('403-error-message')).toBeInTheDocument();
    });

    expect(screen.getByTestId('403-error-message')).toHaveTextContent(/organization mismatch/i);
  });

  it('renders 429 screen with retry-after time when org ping is rate limited', async () => {
    const error = Object.assign(new Error('Too many requests to this resource, please try again later.'), {
      response: {
        status: 429,
        data: {
          error: 'Too many requests to this resource, please try again later.',
          retryAfterSeconds: 42,
        },
      },
    });
    vi.mocked(pingOrg).mockRejectedValue(error);

    renderWithSlug('acme', <ContextInspector />);

    await waitFor(() => {
      expect(screen.getByTestId('429-error-message')).toBeInTheDocument();
    });

    expect(screen.getByTestId('429-error-message')).toHaveTextContent(/too many requests/i);
    expect(screen.getByTestId('429-error-message')).toHaveTextContent(/42 seconds/i);
    expect(screen.getByTestId('rate-limit-reset-timer')).toHaveTextContent(/42 seconds/i);
  });

  it('updates the reset timer every second when org ping is rate limited', async () => {
    vi.useFakeTimers();

    const error = Object.assign(new Error('Too many requests to this resource, please try again later.'), {
      response: {
        status: 429,
        data: {
          error: 'Too many requests to this resource, please try again later.',
          retryAfterSeconds: 3,
        },
      },
    });
    vi.mocked(pingOrg).mockRejectedValue(error);

    renderWithSlug('acme', <ContextInspector />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('rate-limit-reset-timer')).toHaveTextContent(/3 seconds/i);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByTestId('rate-limit-reset-timer')).toHaveTextContent(/2 seconds/i);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByTestId('rate-limit-reset-timer')).toHaveTextContent(/0 seconds/i);
  });
});
