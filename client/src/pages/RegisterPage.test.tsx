import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RegisterPage from './RegisterPage';

vi.mock('../api/saas', () => ({
  checkSlugAvailability: vi.fn(),
  registerOrg: vi.fn(),
}));

import * as saasApi from '../api/saas';

const renderPage = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(saasApi.checkSlugAvailability).mockResolvedValue(true);
  });

  it('renders step 1 with org name and slug fields', () => {
    renderPage();
    expect(screen.getByLabelText(/nom de votre organisation/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/identifiant/i)).toBeInTheDocument();
  });

  it('shows a "Suivant" button on step 1', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /suivant/i })).toBeInTheDocument();
  });

  it('auto-generates slug from org name', async () => {
    renderPage();
    const nameInput = screen.getByLabelText(/nom de votre organisation/i);
    fireEvent.change(nameInput, { target: { value: 'Mon Cinéma' } });
    await waitFor(() => {
      const slugInput = screen.getByLabelText(/identifiant/i) as HTMLInputElement;
      expect(slugInput.value).toMatch(/mon-cin/);
    });
  });

  it('advances to step 2 after valid step 1', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/nom de votre organisation/i), {
      target: { value: 'Mon Cinéma' },
    });
    fireEvent.click(screen.getByRole('button', { name: /suivant/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });
  });

  it('shows validation error when org name is too short', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/nom de votre organisation/i), {
      target: { value: 'A' },
    });
    fireEvent.click(screen.getByRole('button', { name: /suivant/i }));
    await waitFor(() => {
      expect(screen.getByText(/au moins 2 caractères/i)).toBeInTheDocument();
    });
  });

  it('calls registerOrg on final step submission', async () => {
    vi.mocked(saasApi.registerOrg).mockResolvedValue({
      success: true,
      org: { id: 'uuid-1', name: 'Mon Cinéma', slug: 'mon-cinema', schema_name: 'org_mon_cinema', status: 'trial', trial_ends_at: null },
    });
    renderPage();

    // Step 1
    fireEvent.change(screen.getByLabelText(/nom de votre organisation/i), { target: { value: 'Mon Cinéma' } });
    fireEvent.click(screen.getByRole('button', { name: /suivant/i }));

    // Step 2
    await waitFor(() => screen.getByLabelText(/email/i));
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@test.com' } });
    fireEvent.change(screen.getByLabelText(/mot de passe/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /créer mon organisation/i }));

    await waitFor(() => expect(saasApi.registerOrg).toHaveBeenCalledOnce());
  });

  it('shows success message after registration', async () => {
    vi.mocked(saasApi.registerOrg).mockResolvedValue({
      success: true,
      org: { id: 'uuid-1', name: 'Mon Cinéma', slug: 'mon-cinema', schema_name: 'org_mon_cinema', status: 'trial', trial_ends_at: null },
    });
    renderPage();

    fireEvent.change(screen.getByLabelText(/nom de votre organisation/i), { target: { value: 'Mon Cinéma' } });
    fireEvent.click(screen.getByRole('button', { name: /suivant/i }));

    await waitFor(() => screen.getByLabelText(/email/i));
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@test.com' } });
    fireEvent.change(screen.getByLabelText(/mot de passe/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /créer mon organisation/i }));

    await waitFor(() => {
      expect(screen.getByText(/organisation créée/i)).toBeInTheDocument();
    });
  });
});
