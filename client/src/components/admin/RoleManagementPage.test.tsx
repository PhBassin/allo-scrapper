import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import RoleManagementPage from './RoleManagementPage';
import { AuthContext } from '../../contexts/AuthContext';
import type { PermissionName } from '../../types/role';

// Mock API modules
vi.mock('../../api/roles', () => ({
  rolesApi: {
    getAll: vi.fn(),
    getAllPermissions: vi.fn(),
    getPermissionCategoryLabels: vi.fn(),
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
    permissions: ['roles:list', 'roles:read', 'roles:create', 'roles:update', 'roles:delete'] as PermissionName[],
  },
  login: vi.fn(),
  logout: vi.fn(),
  isAdmin: true,
  hasPermission: vi.fn<(p: PermissionName) => boolean>(() => true),
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
    permissions: [{ id: 1, name: 'roles:list', description: 'List roles', category: 'roles', created_at: '2026-01-01T00:00:00Z' }],
  },
  {
    id: 2,
    name: 'auditor',
    description: 'Read-only access',
    is_system: true,
    created_at: '2026-01-01T00:00:00Z',
    permissions: [{ id: 1, name: 'roles:list', description: 'List roles', category: 'roles', created_at: '2026-01-01T00:00:00Z' }],
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
  { id: 1, name: 'roles:list', description: 'List roles', category: 'roles', created_at: '2026-01-01T00:00:00Z' },
  { id: 2, name: 'roles:read', description: 'Read role details', category: 'roles', created_at: '2026-01-01T00:00:00Z' },
  { id: 3, name: 'roles:create', description: 'Create roles', category: 'roles', created_at: '2026-01-01T00:00:00Z' },
  { id: 4, name: 'roles:update', description: 'Update roles', category: 'roles', created_at: '2026-01-01T00:00:00Z' },
  { id: 5, name: 'roles:delete', description: 'Delete roles', category: 'roles', created_at: '2026-01-01T00:00:00Z' },
];

const mockCategoryLabels = [
  {
    id: 1,
    category_key: 'roles',
    label_en: 'Roles',
    label_fr: 'Rôles',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

describe('RoleManagementPage - Permission-based button visibility', () => {
  beforeEach(() => {
    vi.mocked(rolesApi.getAll).mockResolvedValue(mockRoles);
    vi.mocked(rolesApi.getAllPermissions).mockResolvedValue(mockPermissions);
    vi.mocked(rolesApi.getPermissionCategoryLabels).mockResolvedValue(mockCategoryLabels);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('hides "Create Role" button when user lacks roles:create permission', async () => {
    renderWithAuth(<RoleManagementPage />, {
      hasPermission: vi.fn((p: PermissionName) => p !== 'roles:create'),
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
      hasPermission: vi.fn((p: PermissionName) => p !== 'roles:update'),
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
      hasPermission: vi.fn((p: PermissionName) => p !== 'roles:delete'),
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
      hasPermission: vi.fn((p: PermissionName) => p === 'roles:list'),
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

  it('shows "View Permissions" button when user has only roles:read permission', async () => {
    renderWithAuth(<RoleManagementPage />, {
      hasPermission: vi.fn((p: PermissionName) => p === 'roles:list' || p === 'roles:read'),
    });

    await screen.findByText('admin');

    // View buttons should be visible
    expect(screen.getByTestId('view-role-1')).toBeInTheDocument();
    expect(screen.getByTestId('view-role-2')).toBeInTheDocument();
    expect(screen.getByTestId('view-role-3')).toBeInTheDocument();

    // But Edit buttons should not
    expect(screen.queryByTestId('edit-role-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('edit-role-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('edit-role-3')).not.toBeInTheDocument();
  });

  it('shows both "View Permissions" and "Edit Permissions" buttons when user has both permissions', async () => {
    renderWithAuth(<RoleManagementPage />, {
      hasPermission: vi.fn((p: PermissionName) => 
        p === 'roles:list' || p === 'roles:read' || p === 'roles:update'
      ),
    });

    await screen.findByText('admin');

    // Both View and Edit buttons should be visible
    expect(screen.getByTestId('view-role-1')).toBeInTheDocument();
    expect(screen.getByTestId('view-role-2')).toBeInTheDocument();
    expect(screen.getByTestId('view-role-3')).toBeInTheDocument();
    expect(screen.getByTestId('edit-role-1')).toBeInTheDocument();
    expect(screen.getByTestId('edit-role-2')).toBeInTheDocument();
    expect(screen.getByTestId('edit-role-3')).toBeInTheDocument();
  });

  it('shows only "Edit Permissions" button when user has roles:update but not roles:read', async () => {
    renderWithAuth(<RoleManagementPage />, {
      hasPermission: vi.fn((p: PermissionName) => p === 'roles:list' || p === 'roles:update'),
    });

    await screen.findByText('admin');

    // Edit buttons should be visible
    expect(screen.getByTestId('edit-role-1')).toBeInTheDocument();
    expect(screen.getByTestId('edit-role-2')).toBeInTheDocument();
    expect(screen.getByTestId('edit-role-3')).toBeInTheDocument();

    // View buttons should not
    expect(screen.queryByTestId('view-role-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('view-role-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('view-role-3')).not.toBeInTheDocument();
  });
});

describe('RoleManagementPage - View Permissions modal', () => {
  beforeEach(() => {
    vi.mocked(rolesApi.getAll).mockResolvedValue(mockRoles);
    vi.mocked(rolesApi.getAllPermissions).mockResolvedValue(mockPermissions);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('opens read-only modal when "View Permissions" button is clicked', async () => {
    const user = userEvent.setup();
    renderWithAuth(<RoleManagementPage />, {
      hasPermission: vi.fn((p: PermissionName) => p === 'roles:list' || p === 'roles:read'),
    });

    await screen.findByText('admin');

    const viewButton = screen.getByTestId('view-role-1');
    await user.click(viewButton);

    // Modal should open with "View Permissions" title
    await waitFor(() => {
      expect(screen.getByText(/View Permissions — admin/i)).toBeInTheDocument();
    });
  });

  it('displays checkboxes as disabled in read-only mode', async () => {
    const user = userEvent.setup();
    renderWithAuth(<RoleManagementPage />, {
      hasPermission: vi.fn((p: PermissionName) => p === 'roles:list' || p === 'roles:read'),
    });

    await screen.findByText('admin');

    const viewButton = screen.getByTestId('view-role-1');
    await user.click(viewButton);

    // Wait for modal to open
    await waitFor(() => {
      expect(screen.getByText(/View Permissions — admin/i)).toBeInTheDocument();
    });

    // All checkboxes should be disabled
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(checkbox => {
      expect(checkbox).toBeDisabled();
    });
  });

  it('does not show Save button in read-only mode', async () => {
    const user = userEvent.setup();
    renderWithAuth(<RoleManagementPage />, {
      hasPermission: vi.fn((p: PermissionName) => p === 'roles:list' || p === 'roles:read'),
    });

    await screen.findByText('admin');

    const viewButton = screen.getByTestId('view-role-1');
    await user.click(viewButton);

    // Wait for modal to open
    await waitFor(() => {
      expect(screen.getByText(/View Permissions — admin/i)).toBeInTheDocument();
    });

    // Save button should not be present
    expect(screen.queryByText('Save')).not.toBeInTheDocument();
    // But Close button should be present
    expect(screen.getByText('Close')).toBeInTheDocument();
  });

  it('opens editable modal when "Edit Permissions" button is clicked', async () => {
    const user = userEvent.setup();
    renderWithAuth(<RoleManagementPage />, {
      hasPermission: vi.fn(() => true),
    });

    await screen.findByText('admin');

    const editButton = screen.getByTestId('edit-role-1');
    await user.click(editButton);

    // Modal should open with "Edit Permissions" title
    await waitFor(() => {
      expect(screen.getByText(/Edit Permissions — admin/i)).toBeInTheDocument();
    });

    // Checkboxes should NOT be disabled
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(checkbox => {
      expect(checkbox).not.toBeDisabled();
    });

    // Save button should be present
    expect(screen.getByText('Save')).toBeInTheDocument();
  });
});
