import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import RoleManagementPage from './RoleManagementPage';
import { AuthContext } from '../../contexts/AuthContext';

// Mock API modules
vi.mock('../../api/roles', () => ({
  rolesApi: {
    getAll: vi.fn(),
    getAllPermissions: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    setPermissions: vi.fn(),
  },
}));

// Import after mock to get mocked version
import { rolesApi } from '../../api/roles';

const mockAuthContext = {
  isAuthenticated: true,
  token: 'mock-token',
  user: {
    id: 1,
    username: 'admin',
    role_id: 1,
    role_name: 'admin',
    is_system_role: true,
    permissions: ['roles:list', 'roles:read', 'roles:create', 'roles:update', 'roles:delete'],
  },
  login: vi.fn(),
  logout: vi.fn(),
  isAdmin: true,
  hasPermission: vi.fn<(p: string) => boolean>(() => true),
};

const renderWithAuth = (ui: React.ReactElement, authOverrides?: Partial<typeof mockAuthContext>) =>
  render(
    <AuthContext.Provider value={{ ...mockAuthContext, ...authOverrides }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </AuthContext.Provider>
  );

const mockRoles = [
  {
    id: 1,
    name: 'admin',
    description: 'Administrator',
    is_system: true,
    created_at: '2026-01-01T00:00:00Z',
    permissions: [{ id: 1, name: 'roles:list', description: 'List roles', category: 'Rôles', created_at: '2026-01-01T00:00:00Z' }],
  },
  {
    id: 2,
    name: 'auditor',
    description: 'Read-only access',
    is_system: true,
    created_at: '2026-01-01T00:00:00Z',
    permissions: [{ id: 1, name: 'roles:list', description: 'List roles', category: 'Rôles', created_at: '2026-01-01T00:00:00Z' }],
  },
  {
    id: 3,
    name: 'custom_role',
    description: 'Custom role',
    is_system: false,
    created_at: '2026-01-01T00:00:00Z',
    permissions: [],
  },
];

const mockPermissions = [
  { id: 1, name: 'roles:list', description: 'List roles', category: 'Rôles', created_at: '2026-01-01T00:00:00Z' },
  { id: 2, name: 'roles:read', description: 'Read role details', category: 'Rôles', created_at: '2026-01-01T00:00:00Z' },
  { id: 3, name: 'roles:create', description: 'Create roles', category: 'Rôles', created_at: '2026-01-01T00:00:00Z' },
  { id: 4, name: 'roles:update', description: 'Update roles', category: 'Rôles', created_at: '2026-01-01T00:00:00Z' },
  { id: 5, name: 'roles:delete', description: 'Delete roles', category: 'Rôles', created_at: '2026-01-01T00:00:00Z' },
];

describe('RoleManagementPage - Permission-based button visibility', () => {
  beforeEach(() => {
    vi.mocked(rolesApi.getAll).mockResolvedValue(mockRoles);
    vi.mocked(rolesApi.getAllPermissions).mockResolvedValue(mockPermissions);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('hides "Create Role" button when user lacks roles:create permission', async () => {
    renderWithAuth(<RoleManagementPage />, {
      hasPermission: vi.fn((p: string) => p !== 'roles:create'),
    });

    await screen.findByText('admin');

    expect(screen.queryByTestId('create-role-button')).not.toBeInTheDocument();
  });

  it('shows "Create Role" button when user has roles:create permission', async () => {
    renderWithAuth(<RoleManagementPage />, {
      hasPermission: vi.fn(() => true),
    });

    await screen.findByText('admin');

    expect(screen.getByTestId('create-role-button')).toBeInTheDocument();
  });

  it('hides per-row "Edit Permissions" button when user lacks roles:update permission', async () => {
    renderWithAuth(<RoleManagementPage />, {
      hasPermission: vi.fn((p: string) => p !== 'roles:update'),
    });

    await screen.findByText('admin');

    expect(screen.queryByTestId('edit-role-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('edit-role-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('edit-role-3')).not.toBeInTheDocument();
  });

  it('shows per-row "Edit Permissions" button when user has roles:update permission', async () => {
    renderWithAuth(<RoleManagementPage />, {
      hasPermission: vi.fn(() => true),
    });

    await screen.findByText('admin');

    expect(screen.getByTestId('edit-role-1')).toBeInTheDocument();
    expect(screen.getByTestId('edit-role-2')).toBeInTheDocument();
    expect(screen.getByTestId('edit-role-3')).toBeInTheDocument();
  });

  it('hides per-row "Delete" button when user lacks roles:delete permission', async () => {
    renderWithAuth(<RoleManagementPage />, {
      hasPermission: vi.fn((p: string) => p !== 'roles:delete'),
    });

    await screen.findByText('admin');

    expect(screen.queryByTestId('delete-role-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-role-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-role-3')).not.toBeInTheDocument();
  });

  it('shows per-row "Delete" button when user has roles:delete permission', async () => {
    renderWithAuth(<RoleManagementPage />, {
      hasPermission: vi.fn(() => true),
    });

    await screen.findByText('admin');

    expect(screen.getByTestId('delete-role-1')).toBeInTheDocument();
    expect(screen.getByTestId('delete-role-2')).toBeInTheDocument();
    expect(screen.getByTestId('delete-role-3')).toBeInTheDocument();
  });

  it('shows only list view (no buttons) when user has only roles:list permission', async () => {
    renderWithAuth(<RoleManagementPage />, {
      hasPermission: vi.fn((p: string) => p === 'roles:list'),
    });

    await screen.findByText('admin');

    // Role names should be visible
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('auditor')).toBeInTheDocument();
    expect(screen.getByText('custom_role')).toBeInTheDocument();

    // But no CRUD buttons
    expect(screen.queryByTestId('create-role-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('edit-role-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-role-1')).not.toBeInTheDocument();
  });
});
