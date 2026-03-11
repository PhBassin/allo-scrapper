import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../middleware/auth.js', () => ({
  requireAuth: vi.fn((req, _res, next) => next()),
}));

vi.mock('../middleware/permission.js', () => ({
  requirePermission: vi.fn((..._perms: string[]) => vi.fn((_req: any, _res: any, next: any) => next())),
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../db/role-queries.js', () => ({
  getAllRoles: vi.fn(),
  getRoleById: vi.fn(),
  createRole: vi.fn(),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
  setRolePermissions: vi.fn(),
  getAllPermissions: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockPermissions = [
  { id: 1, name: 'scraper:trigger', description: 'Trigger scraper', category: 'scraper', created_at: '2024-01-01' },
  { id: 2, name: 'cinemas:create', description: 'Create cinema', category: 'cinemas', created_at: '2024-01-01' },
];

const mockAdminRole = {
  id: 1,
  name: 'admin',
  description: 'System administrator',
  is_system: true,
  created_at: '2024-01-01',
  permissions: mockPermissions,
};

const mockOperatorRole = {
  id: 2,
  name: 'operator',
  description: 'Operator',
  is_system: false,
  created_at: '2024-01-01',
  permissions: [mockPermissions[0]],
};

const mockCustomRole = {
  id: 3,
  name: 'custom',
  description: 'Custom role',
  is_system: false,
  created_at: '2024-01-01',
  permissions: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMockApp(db: any) {
  return { get: vi.fn((key: string) => (key === 'db' ? db : undefined)) };
}

function buildMockRes() {
  return {
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as any;
}

function getRouteHandler(router: any, method: string, path: string) {
  const layer = router.stack.find(
    (l: any) => l.route?.path === path && l.route?.methods?.[method]
  );
  if (!layer) throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Routes - Roles', () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = { query: vi.fn() };
  });

  // GET /api/roles
  describe('GET /api/roles', () => {
    it('should return all roles with their permissions', async () => {
      const { getAllRoles } = await import('../db/role-queries.js');
      (getAllRoles as any).mockResolvedValue([mockAdminRole, mockOperatorRole]);

      const { default: router } = await import('./roles.js');
      const handler = getRouteHandler(router, 'get', '/');

      const req = { app: buildMockApp(mockDb) } as any;
      const res = buildMockRes();

      await handler(req, res, vi.fn());

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [mockAdminRole, mockOperatorRole],
      });
    });
  });

  // GET /api/roles/:id
  describe('GET /api/roles/:id', () => {
    it('should return a specific role by ID', async () => {
      const { getRoleById } = await import('../db/role-queries.js');
      (getRoleById as any).mockResolvedValue(mockOperatorRole);

      const { default: router } = await import('./roles.js');
      const handler = getRouteHandler(router, 'get', '/:id');

      const req = { params: { id: '2' }, app: buildMockApp(mockDb) } as any;
      const res = buildMockRes();

      await handler(req, res, vi.fn());

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockOperatorRole,
      });
    });

    it('should return 404 when role is not found', async () => {
      const { getRoleById } = await import('../db/role-queries.js');
      (getRoleById as any).mockResolvedValue(undefined);

      const { default: router } = await import('./roles.js');
      const handler = getRouteHandler(router, 'get', '/:id');

      const req = { params: { id: '999' }, app: buildMockApp(mockDb) } as any;
      const res = buildMockRes();

      await handler(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Role not found',
      });
    });
  });

  // POST /api/roles
  describe('POST /api/roles', () => {
    it('should create a role and return 201', async () => {
      const { createRole, getRoleById } = await import('../db/role-queries.js');
      (createRole as any).mockResolvedValue(mockCustomRole);
      (getRoleById as any).mockResolvedValue(mockCustomRole);

      const { default: router } = await import('./roles.js');
      const handler = getRouteHandler(router, 'post', '/');

      const req = {
        body: { name: 'custom', description: 'Custom role' },
        app: buildMockApp(mockDb),
      } as any;
      const res = buildMockRes();

      await handler(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockCustomRole,
      });
    });

    it('should return 400 when name is missing', async () => {
      const { default: router } = await import('./roles.js');
      const handler = getRouteHandler(router, 'post', '/');

      const req = { body: {}, app: buildMockApp(mockDb) } as any;
      const res = buildMockRes();

      await handler(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });
  });

  // PUT /api/roles/:id
  describe('PUT /api/roles/:id', () => {
    it('should update a role name/description', async () => {
      const { updateRole, getRoleById } = await import('../db/role-queries.js');
      const updated = { ...mockOperatorRole, description: 'Updated desc' };
      (updateRole as any).mockResolvedValue(updated);
      (getRoleById as any).mockResolvedValue({ ...updated, permissions: [mockPermissions[0]] });

      const { default: router } = await import('./roles.js');
      const handler = getRouteHandler(router, 'put', '/:id');

      const req = {
        params: { id: '2' },
        body: { description: 'Updated desc' },
        app: buildMockApp(mockDb),
      } as any;
      const res = buildMockRes();

      await handler(req, res, vi.fn());

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it('should return 404 when role does not exist', async () => {
      const { updateRole } = await import('../db/role-queries.js');
      (updateRole as any).mockResolvedValue(undefined);

      const { default: router } = await import('./roles.js');
      const handler = getRouteHandler(router, 'put', '/:id');

      const req = {
        params: { id: '999' },
        body: { name: 'x' },
        app: buildMockApp(mockDb),
      } as any;
      const res = buildMockRes();

      await handler(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // DELETE /api/roles/:id
  describe('DELETE /api/roles/:id', () => {
    it('should delete a non-system role and return 204', async () => {
      const { getRoleById } = await import('../db/role-queries.js');
      (getRoleById as any).mockResolvedValue(mockCustomRole); // is_system: false
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '0' }] }); // no users
      mockDb.query.mockResolvedValueOnce({ rowCount: 1 }); // delete

      const { default: router } = await import('./roles.js');
      const handler = getRouteHandler(router, 'delete', '/:id');

      const req = { params: { id: '3' }, app: buildMockApp(mockDb) } as any;
      const res = buildMockRes();

      await handler(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('should return 403 when trying to delete a system role', async () => {
      const { getRoleById } = await import('../db/role-queries.js');
      (getRoleById as any).mockResolvedValue(mockAdminRole); // is_system: true

      const { default: router } = await import('./roles.js');
      const handler = getRouteHandler(router, 'delete', '/:id');

      const req = { params: { id: '1' }, app: buildMockApp(mockDb) } as any;
      const res = buildMockRes();

      await handler(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Cannot delete a system role',
      });
    });

    it('should return 409 when role is assigned to users', async () => {
      const { getRoleById } = await import('../db/role-queries.js');
      (getRoleById as any).mockResolvedValue(mockCustomRole); // is_system: false
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '3' }] }); // 3 users assigned

      const { default: router } = await import('./roles.js');
      const handler = getRouteHandler(router, 'delete', '/:id');

      const req = { params: { id: '3' }, app: buildMockApp(mockDb) } as any;
      const res = buildMockRes();

      await handler(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Role is assigned to 3 user(s)',
      });
    });

    it('should return 404 when role does not exist', async () => {
      const { getRoleById } = await import('../db/role-queries.js');
      (getRoleById as any).mockResolvedValue(undefined);

      const { default: router } = await import('./roles.js');
      const handler = getRouteHandler(router, 'delete', '/:id');

      const req = { params: { id: '999' }, app: buildMockApp(mockDb) } as any;
      const res = buildMockRes();

      await handler(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // PUT /api/roles/:id/permissions
  describe('PUT /api/roles/:id/permissions', () => {
    it('should replace permissions and return updated role', async () => {
      const { getRoleById, setRolePermissions } = await import('../db/role-queries.js');
      (setRolePermissions as any).mockResolvedValue(undefined);
      (getRoleById as any).mockResolvedValue({ ...mockOperatorRole, permissions: mockPermissions });

      const { default: router } = await import('./roles.js');
      const handler = getRouteHandler(router, 'put', '/:id/permissions');

      const req = {
        params: { id: '2' },
        body: { permission_ids: [1, 2] },
        app: buildMockApp(mockDb),
      } as any;
      const res = buildMockRes();

      await handler(req, res, vi.fn());

      expect(setRolePermissions).toHaveBeenCalledWith(mockDb, 2, [1, 2]);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ id: 2, permissions: mockPermissions }),
      });
    });

    it('should return 400 when permission_ids is not an array', async () => {
      const { default: router } = await import('./roles.js');
      const handler = getRouteHandler(router, 'put', '/:id/permissions');

      const req = {
        params: { id: '2' },
        body: { permission_ids: 'not-an-array' },
        app: buildMockApp(mockDb),
      } as any;
      const res = buildMockRes();

      await handler(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // GET /api/roles/permissions
  // Note: This route is mounted at /api/roles, so the full path is /api/roles/permissions
  describe('GET /permissions', () => {
    it('should return all available permissions', async () => {
      const { getAllPermissions } = await import('../db/role-queries.js');
      (getAllPermissions as any).mockResolvedValue(mockPermissions);

      const { default: router } = await import('./roles.js');
      const handler = getRouteHandler(router, 'get', '/permissions');

      const req = { app: buildMockApp(mockDb) } as any;
      const res = buildMockRes();

      await handler(req, res, vi.fn());

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockPermissions,
      });
    });
  });
});
