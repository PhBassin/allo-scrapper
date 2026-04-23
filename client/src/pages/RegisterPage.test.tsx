import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage, { nameToSlug } from './RegisterPage';

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../api/saas', () => ({
  registerOrg: vi.fn(),
  checkSlugAvailable: vi.fn(),
}));

vi.mock('../api/client', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
}));

import { registerOrg, checkSlugAvailable } from '../api/saas';

// ── Helper ───────────────────────────────────────────────────────────────────
function renderPage() {
  return render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('nameToSlug helper', () => {
  it('converts a plain name to lowercase-hyphenated slug', () => {
    expect(nameToSlug('Grand Cinéma Lyon')).toBe('grand-cinma-lyon');
  });

  it('collapses multiple spaces and hyphens', () => {
    expect(nameToSlug('My  Cinema  Place')).toBe('my-cinema-place');
  });

  it('strips leading/trailing hyphens', () => {
    expect(nameToSlug(' -Test- ')).toBe('test');
  });

  it('truncates to 30 characters', () => {
    const long = 'a'.repeat(40);
    expect(nameToSlug(long)).toHaveLength(30);
  });
});

describe('RegisterPage — step 1', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkSlugAvailable).mockResolvedValue(true);
  });

  it('renders step 1 by default', () => {
    renderPage();
    expect(screen.getByTestId('step-1')).toBeInTheDocument();
  });

  it('auto-generates slug from org name', async () => {
    renderPage();
    const nameInput = screen.getByTestId('input-org-name');
    fireEvent.change(nameInput, { target: { value: 'My Cinema' } });
    await waitFor(() => {
      const slugInput = screen.getByTestId('input-slug') as HTMLInputElement;
      expect(slugInput.value).toBe('my-cinema');
    });
  });

  it('shows validation error when org name too short', async () => {
    vi.mocked(checkSlugAvailable).mockResolvedValue(true);
    renderPage();
    fireEvent.click(screen.getByTestId('btn-step1-next'));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/at least 2 characters/i);
    });
  });

  it('shows "taken" feedback when slug is taken', async () => {
    vi.mocked(checkSlugAvailable).mockResolvedValue(false);
    renderPage();

    fireEvent.change(screen.getByTestId('input-org-name'), { target: { value: 'Taken Org' } });

    await waitFor(() => {
      expect(screen.getByTestId('slug-feedback')).toHaveTextContent(/already taken/i);
    });
  });

  it('advances to step 2 when form is valid', async () => {
    vi.mocked(checkSlugAvailable).mockResolvedValue(true);
    renderPage();

    fireEvent.change(screen.getByTestId('input-org-name'), { target: { value: 'Valid Org' } });

    // Wait for slug availability check
    await waitFor(() => {
      expect(screen.getByTestId('slug-feedback')).toHaveTextContent(/available/i);
    });

    fireEvent.click(screen.getByTestId('btn-step1-next'));

    await waitFor(() => {
      expect(screen.getByTestId('step-2')).toBeInTheDocument();
    });
  });

  it('ignores stale slug check responses (race condition)', async () => {
    // First call (slow) returns false for 'slow-slug'
    // Second call (fast) returns true for 'fast-slug'
    let callCount = 0;
    vi.mocked(checkSlugAvailable).mockImplementation((slug: string) => {
      callCount++;
      if (slug === 'slow-slug') {
        return new Promise((resolve) => setTimeout(() => resolve(false), 300));
      }
      return Promise.resolve(true);
    });

    renderPage();

    // Type first slug (triggers slow check)
    fireEvent.change(screen.getByTestId('input-slug'), { target: { value: 'slow-slug' } });

    // Wait a bit then type second slug (triggers fast check)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    fireEvent.change(screen.getByTestId('input-slug'), { target: { value: 'fast-slug' } });

    // Wait for fast check to resolve
    await waitFor(() => {
      expect(screen.getByTestId('slug-feedback')).toHaveTextContent(/available/i);
    });

    // Wait long enough for slow check to resolve too
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });

    // Final state should still be 'available' (from fast check), not 'taken' (from slow check)
    expect(screen.getByTestId('slug-feedback')).toHaveTextContent(/available/i);
  });
});

describe('RegisterPage — step 2', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(checkSlugAvailable).mockResolvedValue(true);

    renderPage();
    fireEvent.change(screen.getByTestId('input-org-name'), { target: { value: 'Valid Org' } });
    await waitFor(() =>
      expect(screen.getByTestId('slug-feedback')).toHaveTextContent(/available/i)
    );
    fireEvent.click(screen.getByTestId('btn-step1-next'));
    await waitFor(() => expect(screen.getByTestId('step-2')).toBeInTheDocument());
  });

  it('shows error when password is too short', async () => {
    fireEvent.change(screen.getByTestId('input-admin-email'), {
      target: { value: 'admin@test.com' },
    });
    fireEvent.change(screen.getByTestId('input-admin-password'), {
      target: { value: 'short' },
    });
    fireEvent.click(screen.getByTestId('btn-step2-next'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/at least 8 characters/i);
    });
  });

  it('advances to step 3 with valid credentials', async () => {
    fireEvent.change(screen.getByTestId('input-admin-email'), {
      target: { value: 'admin@test.com' },
    });
    fireEvent.change(screen.getByTestId('input-admin-password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByTestId('btn-step2-next'));

    await waitFor(() => {
      expect(screen.getByTestId('step-3')).toBeInTheDocument();
    });
  });

  it('rejects email without @ symbol', async () => {
    fireEvent.change(screen.getByTestId('input-admin-email'), {
      target: { value: 'invalidemail.com' },
    });
    fireEvent.change(screen.getByTestId('input-admin-password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByTestId('btn-step2-next'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/valid email address/i);
    });
  });

  it('rejects email with only @ but no domain', async () => {
    fireEvent.change(screen.getByTestId('input-admin-email'), {
      target: { value: 'test@' },
    });
    fireEvent.change(screen.getByTestId('input-admin-password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByTestId('btn-step2-next'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/valid email address/i);
    });
  });

  it('rejects email with spaces', async () => {
    fireEvent.change(screen.getByTestId('input-admin-email'), {
      target: { value: 'test user@example.com' },
    });
    fireEvent.change(screen.getByTestId('input-admin-password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByTestId('btn-step2-next'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/valid email address/i);
    });
  });

  it('accepts a valid email address', async () => {
    fireEvent.change(screen.getByTestId('input-admin-email'), {
      target: { value: 'user.name+tag@example.co.uk' },
    });
    fireEvent.change(screen.getByTestId('input-admin-password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByTestId('btn-step2-next'));

    await waitFor(() => {
      expect(screen.getByTestId('step-3')).toBeInTheDocument();
    });
  });
});

describe('RegisterPage — step 3 submit', () => {
  async function goToStep3() {
    vi.mocked(checkSlugAvailable).mockResolvedValue(true);

    renderPage();
    fireEvent.change(screen.getByTestId('input-org-name'), { target: { value: 'Submit Org' } });
    await waitFor(() =>
      expect(screen.getByTestId('slug-feedback')).toHaveTextContent(/available/i)
    );
    fireEvent.click(screen.getByTestId('btn-step1-next'));
    await waitFor(() => expect(screen.getByTestId('step-2')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('input-admin-email'), {
      target: { value: 'admin@test.com' },
    });
    fireEvent.change(screen.getByTestId('input-admin-password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByTestId('btn-step2-next'));
    await waitFor(() => expect(screen.getByTestId('step-3')).toBeInTheDocument());
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(registerOrg).mockResolvedValue({
      token: 'mock-token',
      admin: { id: 1, username: 'admin', role_id: 1, role_name: 'admin' },
      org: {
        id: 1,
        name: 'Submit Org',
        slug: 'submit-org',
        schema_name: 'org_submit_org',
        status: 'active',
        trial_ends_at: null,
      },
    });
  });

  it('skips cinema and redirects when "Skip for now" clicked', async () => {
    await goToStep3();

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-skip-cinema'));
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/org/submit-org/');
    });
  });

  it('submits with cinema URL and redirects', async () => {
    await goToStep3();

    fireEvent.change(screen.getByTestId('input-cinema-url'), {
      target: { value: 'https://www.allocine.fr/seance/salle_gen_csalle=C0028.html' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-submit'));
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/org/submit-org/');
    });
  });

  it('calls registerOrg with correct payload', async () => {
    await goToStep3();

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-skip-cinema'));
    });

    await waitFor(() => {
      expect(registerOrg).toHaveBeenCalledWith(
        expect.objectContaining({
          orgName: 'Submit Org',
          adminEmail: 'admin@test.com',
          adminPassword: 'password123',
        })
      );
    });
  });

  it('shows error when registration fails', async () => {
    vi.mocked(registerOrg).mockRejectedValue(new Error('Slug already taken'));
    await goToStep3();

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-skip-cinema'));
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/slug already taken/i);
    });
  });
});
