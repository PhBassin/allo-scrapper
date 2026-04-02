import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, type AuthContextType } from '../../contexts/AuthContext';
import { ConfigContext } from '../../contexts/ConfigContext';
import SuperadminPage from './SuperadminPage';

// Mock the superadmin API module
vi.mock('../../api/superadmin', () => ({
  getSuperadminDashboard: vi.fn().mockResolvedValue({
    orgs: { active: 3, trial: 1, suspended: 0 },
    new_orgs_this_week: 1,
    mrr_cents: 9900,
    arr_cents: 118800,
  }),
  getSuperadminOrgs: vi.fn().mockResolvedValue([
    { id: 'org-1', name: 'Org One', slug: 'org-one', status: 'active', plan_name: 'Pro', trial_ends_at: null },
    { id: 'org-2', name: 'Org Two', slug: 'org-two', status: 'trial', plan_name: 'Starter', trial_ends_at: '2026-04-15T00:00:00.000Z' },
  ]),
  getSuperadminAuditLog: vi.fn().mockResolvedValue({
    data: [
      { id: 1, actor_id: 1, action: 'impersonate', target_type: 'organization', target_id: 'org-1', metadata: {}, created_at: '2026-04-01T10:00:00.000Z' },
    ],
    total: 1,
    page: 1,
    limit: 50,
  }),
  impersonateOrg: vi.fn().mockResolvedValue({ token: 'impersonate-jwt' }),
  suspendOrg: vi.fn().mockResolvedValue({}),
  reactivateOrg: vi.fn().mockResolvedValue({}),
  resetOrgTrial: vi.fn().mockResolvedValue({}),
}));

function makeSuperadminCtx(): AuthContextType {
  return {
    isAuthenticated: true,
    token: 'superadmin-jwt',
    user: {
      id: 1,
      username: 'superadmin',
      role_id: 1,
      role_name: 'admin',
      is_system_role: true,
      permissions: [],
      scope: 'superadmin',
    },
    isAdmin: true,
    isSuperadmin: true,
    hasPermission: () => true,
    login: vi.fn(),
    logout: vi.fn(),
  };
}

function renderPage() {
  return render(
    <ConfigContext.Provider value={{ config: { saasEnabled: true }, isLoading: false }}>
      <AuthContext.Provider value={makeSuperadminCtx()}>
        <MemoryRouter>
          <SuperadminPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </ConfigContext.Provider>,
  );
}

describe('SuperadminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page title', async () => {
    renderPage();
    expect(await screen.findByText(/superadmin/i)).toBeInTheDocument();
  });

  it('renders 3 tabs: Dashboard, Organisations, Audit Log', async () => {
    renderPage();
    expect(await screen.findByRole('tab', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /organisations/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /audit log/i })).toBeInTheDocument();
  });

  it('Dashboard tab is active by default and shows stats', async () => {
    renderPage();
    // Dashboard tab should be selected
    expect(await screen.findByRole('tab', { name: /dashboard/i })).toHaveAttribute('aria-selected', 'true');
    // Should display org counts
    expect(await screen.findByText(/active/i)).toBeInTheDocument();
  });

  it('clicking Organisations tab shows org list', async () => {
    const user = userEvent.setup();
    renderPage();

    const orgsTab = await screen.findByRole('tab', { name: /organisations/i });
    await user.click(orgsTab);

    expect(await screen.findByText('Org One')).toBeInTheDocument();
    expect(screen.getByText('Org Two')).toBeInTheDocument();
  });

  it('clicking Audit Log tab shows audit entries', async () => {
    const user = userEvent.setup();
    renderPage();

    const auditTab = await screen.findByRole('tab', { name: /audit log/i });
    await user.click(auditTab);

    expect(await screen.findByText(/impersonate/i)).toBeInTheDocument();
  });

  it('Organisations tab has Impersonate action per row', async () => {
    const user = userEvent.setup();
    renderPage();

    const orgsTab = await screen.findByRole('tab', { name: /organisations/i });
    await user.click(orgsTab);

    const impersonateButtons = await screen.findAllByRole('button', { name: /impersonate/i });
    expect(impersonateButtons.length).toBeGreaterThan(0);
  });
});
