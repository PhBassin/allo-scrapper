import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useContext } from 'react';
import { TenantContext } from '../contexts/TenantContext';
import { TenantProvider } from '../contexts/TenantProvider';

vi.mock('../api/saas', () => ({
  getOrgInfo: vi.fn(),
}));

import * as saasApi from '../api/saas';

const mockOrg = { id: 'uuid-1', slug: 'cinema-test', name: 'Cinéma Test', status: 'active' };

function ConsumerComponent() {
  const { org, isLoading, error } = useContext(TenantContext);
  if (isLoading) return <div>loading...</div>;
  if (error) return <div>error: {error}</div>;
  if (!org) return <div>no-org</div>;
  return <div>org: {org.name} ({org.slug})</div>;
}

function renderWithSlug(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/org/${slug}/home`]}>
      <Routes>
        <Route path="/org/:slug/*" element={
          <TenantProvider>
            <ConsumerComponent />
          </TenantProvider>
        } />
      </Routes>
    </MemoryRouter>
  );
}

describe('TenantProvider', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows loading initially', () => {
    vi.mocked(saasApi.getOrgInfo).mockReturnValue(new Promise(() => {})); // never resolves
    renderWithSlug('cinema-test');
    expect(screen.getByText('loading...')).toBeInTheDocument();
  });

  it('provides org data on successful fetch', async () => {
    vi.mocked(saasApi.getOrgInfo).mockResolvedValue(mockOrg);
    renderWithSlug('cinema-test');
    await waitFor(() => {
      expect(screen.getByText('org: Cinéma Test (cinema-test)')).toBeInTheDocument();
    });
  });

  it('shows error when org not found', async () => {
    vi.mocked(saasApi.getOrgInfo).mockRejectedValue(new Error('Organization not found'));
    renderWithSlug('unknown');
    await waitFor(() => {
      expect(screen.getByText(/error:/)).toBeInTheDocument();
    });
  });

  it('passes the slug from URL params to the API call', async () => {
    vi.mocked(saasApi.getOrgInfo).mockResolvedValue(mockOrg);
    renderWithSlug('my-cinema');
    await waitFor(() => expect(saasApi.getOrgInfo).toHaveBeenCalledWith('my-cinema'));
  });
});
