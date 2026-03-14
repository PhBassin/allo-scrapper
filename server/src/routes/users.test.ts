import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import usersRouter from './users.js';
import type { DB } from '../db/client.js';

// Mock dependencies
vi.mock('../db/client.js', () => ({
  db: {
    query: vi.fn(),
  },
}));
vi.mock('../db/user-queries.js');
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$10$hashedPasswordExample1234567890123456789012'),
    compare: vi.fn(),
  },
}));
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock('../middleware/auth.js', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (req.headers.authorization === 'Bearer valid-admin-token') {
      req.user = { id: 1, username: 'admin' };
      next();
    } else if (req.headers.authorization === 'Bearer valid-user-token') {
      req.user = { id: 2, username: 'user1' };
      next();
    } else {
      res.status(401).json({ success: false, error: 'Unauthorized' });
    }
  },
}));
vi.mock('../middleware/permission.js', () => ({
  requirePermission: (..._perms: string[]) => async (req: any, res: any, next: any) => {
    // In tests, only user with id=1 (admin) passes permission checks
    if (req.user?.id === 1) {
      next();
    } else {
      res.status(403).json({ success: false, error: 'Permission denied' });
    }
  },
}));
vi.mock('../middleware/admin.js', () => ({
  requireAdmin: async (req: any, res: any, next: any) => {
    // Admin check: only user with id=1 is admin
    if (req.user?.id === 1) {
      next();
    } else {
      res.status(403).json({ success: false, error: 'Admin required' });
    }
  },
}));
vi.mock('../middleware/rate-limit.js', () => ({
  protectedLimiter: (req: any, res: any, next: any) => next(),
}));

import * as userQueries from '../db/user-queries.js';
import { db } from '../db/client.js';

// Helper: mock user in new role_id/role_name format
const makeUser = (id: number, username: string, roleId: number, roleName: string, createdAt = '2024-01-01T00:00:00Z') => ({
  id,
  username,
  role_id: roleId,
  role_name: roleName,
  created_at: createdAt,
});

describe('User Management Routes', () => {
  let app: express.Application;
  const mockDb: DB = db as DB;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.set('db', mockDb);
    app.use('/api/users', usersRouter);
    vi.clearAllMocks();
  });

  describe('GET /api/users', () => {
    it('should return all users without passwords (200)', async () => {
      const mockUsers = [
        makeUser(1, 'admin', 1, 'admin', '2024-01-01T00:00:00Z'),
        makeUser(2, 'user1', 2, 'operator', '2024-01-02T00:00:00Z'),
      ];

      vi.mocked(userQueries.getAllUsers).mockResolvedValue(mockUsers);

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUsers);
      expect(userQueries.getAllUsers).toHaveBeenCalledWith(db, { limit: 100, offset: 0 });
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app).get('/api/users');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', 'Bearer valid-user-token');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Permission denied');
    });

    it('should support limit query parameter', async () => {
      vi.mocked(userQueries.getAllUsers).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/users?limit=50')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(200);
      expect(userQueries.getAllUsers).toHaveBeenCalledWith(db, { limit: 50, offset: 0 });
    });

    it('should clamp limit query parameter to 100 max', async () => {
      vi.mocked(userQueries.getAllUsers).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/users?limit=1000')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(200);
      expect(userQueries.getAllUsers).toHaveBeenCalledWith(db, { limit: 100, offset: 0 });
    });

    it('should support offset query parameter', async () => {
      vi.mocked(userQueries.getAllUsers).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/users?offset=10')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(200);
      expect(userQueries.getAllUsers).toHaveBeenCalledWith(db, { limit: 100, offset: 10 });
    });

    it('should support both limit and offset parameters', async () => {
      vi.mocked(userQueries.getAllUsers).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/users?limit=25&offset=50')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(200);
      expect(userQueries.getAllUsers).toHaveBeenCalledWith(db, { limit: 25, offset: 50 });
    });

    it('should return 500 on database error', async () => {
      vi.mocked(userQueries.getAllUsers).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to list users');
    });
  });

  describe('GET /api/users/:id', () => {
    it('should return user by ID without password (200)', async () => {
      const mockUser = makeUser(2, 'user1', 2, 'operator', '2024-01-02T00:00:00Z');

      vi.mocked(userQueries.getUserById).mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/users/2')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUser);
      expect(userQueries.getUserById).toHaveBeenCalledWith(db, 2);
    });

    it('should return 404 for non-existent user', async () => {
      vi.mocked(userQueries.getUserById).mockResolvedValue(undefined);

      const response = await request(app)
        .get('/api/users/999')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User not found');
    });

    it('should return 400 for invalid ID format', async () => {
      const response = await request(app)
        .get('/api/users/invalid')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid user ID');
    });

    it('should return 401 for unauthenticated', async () => {
      const response = await request(app).get('/api/users/2');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 for non-admin', async () => {
      const response = await request(app)
        .get('/api/users/2')
        .set('Authorization', 'Bearer valid-user-token');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should return 500 on database error', async () => {
      vi.mocked(userQueries.getUserById).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/users/2')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/users', () => {
    it('should create user with provided role_id (201)', async () => {
      const newUser = makeUser(3, 'newuser', 2, 'operator', '2024-01-03T00:00:00Z');

      // First call: role validation check
      vi.mocked(db.query)
        .mockResolvedValueOnce({ rows: [{ id: 2 }], rowCount: 1 } as any) // role exists
        .mockResolvedValueOnce({ rows: [newUser], rowCount: 1 } as any);  // INSERT

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({
          username: 'newuser',
          password: 'Test1234!',
          role_id: '2',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(newUser);
    });

    it('should return 400 if role_id is not provided', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({
          username: 'newuser',
          password: 'Test1234!',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('role_id');
    });

    it('should validate username is required', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({
          password: 'Test1234!',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Username');
    });

    it('should validate username is alphanumeric only', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({
          username: 'user@name',
          password: 'Test1234!',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('alphanumeric');
    });

    it('should validate username minimum length 3', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({
          username: 'ab',
          password: 'Test1234!',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('3-15 characters');
    });

    it('should validate username maximum length 15', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({
          username: 'abcdefghijklmnopqrstuv',
          password: 'Test1234!',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('3-15 characters');
    });

    it('should validate username is unique', async () => {
      // Mock role check to pass, then INSERT to throw duplicate key error
      const duplicateError: any = new Error('duplicate key value violates unique constraint');
      duplicateError.code = '23505';

      vi.mocked(db.query)
        .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 } as any) // role check
        .mockRejectedValueOnce(duplicateError);                              // INSERT fails

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({
          username: 'existinguser',
          password: 'Test1234!',
          role_id: '1',
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Username already exists');
    });

    it('should validate password is required', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({
          username: 'newuser',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Username and password are required');
    });

    it('should validate password meets complexity requirements', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({
          username: 'newuser',
          password: 'weak',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Password');
    });

    it('should return 400 when role_id does not exist in DB', async () => {
      vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // role not found

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({
          username: 'newuser',
          password: 'Test1234!',
          role_id: '999',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('role_id');
    });

    it('should return 401 for unauthenticated', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({
          username: 'newuser',
          password: 'Test1234!',
        });

      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', 'Bearer valid-user-token')
        .send({
          username: 'newuser',
          password: 'Test1234!',
        });

      expect(response.status).toBe(403);
    });

    it('should return 500 on database error', async () => {
      vi.mocked(db.query)
        .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 } as any) // role check
        .mockRejectedValueOnce(new Error('Database error'));                // INSERT fails

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({
          username: 'newuser',
          password: 'Test1234!',
          role_id: '1',
        });

      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/users/:id/role', () => {
    it('should update user role successfully (200)', async () => {
      const mockUser = makeUser(2, 'user1', 2, 'operator', '2024-01-02T00:00:00Z');
      const updatedUser = makeUser(2, 'user1', 1, 'admin', '2024-01-02T00:00:00Z');

      vi.mocked(db.query).mockResolvedValueOnce({ rows: [{ id: 1, name: 'admin' }], rowCount: 1 } as any); // role check
      vi.mocked(userQueries.getUserById).mockResolvedValueOnce(mockUser);    // targetUser check
      vi.mocked(userQueries.getAdminCount).mockResolvedValue(2);              // admin count
      vi.mocked(userQueries.updateUserRole).mockResolvedValue(undefined);
      vi.mocked(userQueries.getUserById).mockResolvedValueOnce(updatedUser);  // updated user

      const response = await request(app)
        .put('/api/users/2/role')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ role_id: 1 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.role_name).toBe('admin');
      expect(userQueries.updateUserRole).toHaveBeenCalledWith(db, 2, 1);
    });

    it('should prevent last admin from demoting self (403)', async () => {
      const mockAdminUser = makeUser(1, 'admin', 1, 'admin', '2024-01-01T00:00:00Z');

      vi.mocked(db.query).mockResolvedValueOnce({ rows: [{ id: 2, name: 'operator' }], rowCount: 1 } as any); // role check
      vi.mocked(userQueries.getUserById).mockResolvedValue(mockAdminUser);
      vi.mocked(userQueries.getAdminCount).mockResolvedValue(1); // Only 1 admin

      const response = await request(app)
        .put('/api/users/1/role')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ role_id: 2 });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Cannot demote the last admin user');
      expect(userQueries.updateUserRole).not.toHaveBeenCalled();
    });

    it('should allow admin to demote other admins (if not last)', async () => {
      const mockAdminUser = makeUser(3, 'admin2', 1, 'admin', '2024-01-03T00:00:00Z');
      const updatedUser = makeUser(3, 'admin2', 2, 'operator', '2024-01-03T00:00:00Z');

      vi.mocked(db.query).mockResolvedValueOnce({ rows: [{ id: 2, name: 'operator' }], rowCount: 1 } as any); // role check
      vi.mocked(userQueries.getUserById).mockResolvedValueOnce(mockAdminUser); // Check user exists
      vi.mocked(userQueries.getAdminCount).mockResolvedValue(2);               // 2 admins
      vi.mocked(userQueries.updateUserRole).mockResolvedValue(undefined);
      vi.mocked(userQueries.getUserById).mockResolvedValueOnce(updatedUser);   // Fetch updated user

      const response = await request(app)
        .put('/api/users/3/role')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ role_id: 2 });

      expect(response.status).toBe(200);
      expect(userQueries.updateUserRole).toHaveBeenCalledWith(db, 3, 2);
    });

    it('should allow admin to promote users to admin', async () => {
      const mockUser = makeUser(2, 'user1', 2, 'operator', '2024-01-02T00:00:00Z');
      const updatedUser = makeUser(2, 'user1', 1, 'admin', '2024-01-02T00:00:00Z');

      vi.mocked(db.query).mockResolvedValueOnce({ rows: [{ id: 1, name: 'admin' }], rowCount: 1 } as any); // role check
      vi.mocked(userQueries.getUserById).mockResolvedValueOnce(mockUser);    // Check user exists
      vi.mocked(userQueries.updateUserRole).mockResolvedValue(undefined);
      vi.mocked(userQueries.getUserById).mockResolvedValueOnce(updatedUser); // Fetch updated user

      const response = await request(app)
        .put('/api/users/2/role')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ role_id: 1 });

      expect(response.status).toBe(200);
      expect(userQueries.updateUserRole).toHaveBeenCalledWith(db, 2, 1);
    });

    it('should return 404 for non-existent user', async () => {
      vi.mocked(db.query).mockResolvedValueOnce({ rows: [{ id: 1, name: 'admin' }], rowCount: 1 } as any); // role check
      vi.mocked(userQueries.getUserById).mockResolvedValue(undefined);

      const response = await request(app)
        .put('/api/users/999/role')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ role_id: 1 });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    it('should return 400 for invalid role_id (non-existent)', async () => {
      vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // role not found

      const response = await request(app)
        .put('/api/users/2/role')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ role_id: 999 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('role_id');
    });

    it('should return 400 for invalid ID format', async () => {
      const response = await request(app)
        .put('/api/users/invalid/role')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ role_id: 1 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid user ID');
    });

    it('should return 401 for unauthenticated', async () => {
      const response = await request(app)
        .put('/api/users/2/role')
        .send({ role_id: 1 });

      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin', async () => {
      const response = await request(app)
        .put('/api/users/2/role')
        .set('Authorization', 'Bearer valid-user-token')
        .send({ role_id: 1 });

      expect(response.status).toBe(403);
    });

    it('should return 500 on database error', async () => {
      vi.mocked(userQueries.getUserById).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .put('/api/users/2/role')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ role_id: 1 });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/users/:id/reset-password', () => {
    it('should generate random password and update user (200)', async () => {
      const mockUser = makeUser(2, 'user1', 2, 'operator', '2024-01-02T00:00:00Z');

      vi.mocked(userQueries.getUserById).mockResolvedValue(mockUser);
      vi.mocked(userQueries.generateRandomPassword).mockReturnValue('RandomPass123!@#');
      vi.mocked(db.query).mockResolvedValue({ rows: [], rowCount: 1 } as any);

      const response = await request(app)
        .post('/api/users/2/reset-password')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.newPassword).toBe('RandomPass123!@#');
      expect(response.body.data.user).toEqual(mockUser);
    });

    it('should return new password in response for admin to share', async () => {
      const mockUser = makeUser(2, 'user1', 2, 'operator', '2024-01-02T00:00:00Z');

      vi.mocked(userQueries.getUserById).mockResolvedValue(mockUser);
      vi.mocked(userQueries.generateRandomPassword).mockReturnValue('NewPass456!@#');
      vi.mocked(db.query).mockResolvedValue({ rows: [], rowCount: 1 } as any);

      const response = await request(app)
        .post('/api/users/2/reset-password')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.body.data).toHaveProperty('newPassword');
      expect(typeof response.body.data.newPassword).toBe('string');
    });

    it('should hash password before storing', async () => {
      const mockUser = makeUser(2, 'user1', 2, 'operator', '2024-01-02T00:00:00Z');

      vi.mocked(userQueries.getUserById).mockResolvedValue(mockUser);
      vi.mocked(userQueries.generateRandomPassword).mockReturnValue('RandomPass123!@#');
      vi.mocked(db.query).mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await request(app)
        .post('/api/users/2/reset-password')
        .set('Authorization', 'Bearer valid-admin-token');

      // Verify password was hashed (bcrypt hash starts with $2b$)
      expect(db.query).toHaveBeenCalled();
      const queryCall = vi.mocked(db.query).mock.calls[0];
      expect(queryCall[1][0]).toMatch(/^\$2[aby]\$/);
      expect(queryCall[1][0]).not.toBe('RandomPass123!@#');
    });

    it('should return 404 for non-existent user', async () => {
      vi.mocked(userQueries.getUserById).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/users/999/reset-password')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    it('should return 400 for invalid ID format', async () => {
      const response = await request(app)
        .post('/api/users/invalid/reset-password')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid user ID');
    });

    it('should return 401 for unauthenticated', async () => {
      const response = await request(app).post('/api/users/2/reset-password');

      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin', async () => {
      const response = await request(app)
        .post('/api/users/2/reset-password')
        .set('Authorization', 'Bearer valid-user-token');

      expect(response.status).toBe(403);
    });

    it('should return 500 on database error', async () => {
      vi.mocked(userQueries.getUserById).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/users/2/reset-password')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should delete user successfully (204)', async () => {
      const mockUser = makeUser(2, 'user1', 2, 'operator', '2024-01-02T00:00:00Z');

      vi.mocked(userQueries.getUserById).mockResolvedValue(mockUser);
      vi.mocked(userQueries.deleteUser).mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/users/2')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(204);
      expect(userQueries.deleteUser).toHaveBeenCalledWith(db, 2);
    });

    it('should prevent deletion of last admin (403)', async () => {
      const mockAdminUser = makeUser(2, 'admin2', 1, 'admin', '2024-01-02T00:00:00Z');

      vi.mocked(userQueries.getUserById).mockResolvedValue(mockAdminUser);
      vi.mocked(userQueries.getAdminCount).mockResolvedValue(1); // Only 1 admin

      const response = await request(app)
        .delete('/api/users/2')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Cannot delete the last admin user');
      expect(userQueries.deleteUser).not.toHaveBeenCalled();
    });

    it('should prevent admin from deleting themselves (403)', async () => {
      const mockAdminUser = makeUser(1, 'admin', 1, 'admin', '2024-01-01T00:00:00Z');

      vi.mocked(userQueries.getUserById).mockResolvedValue(mockAdminUser);
      vi.mocked(userQueries.getAdminCount).mockResolvedValue(2); // 2 admins

      const response = await request(app)
        .delete('/api/users/1')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Cannot delete your own account');
      expect(userQueries.deleteUser).not.toHaveBeenCalled();
    });

    it('should allow deletion of non-admin users', async () => {
      const mockUser = makeUser(2, 'user1', 2, 'operator', '2024-01-02T00:00:00Z');

      vi.mocked(userQueries.getUserById).mockResolvedValue(mockUser);
      vi.mocked(userQueries.deleteUser).mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/users/2')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(204);
      expect(userQueries.deleteUser).toHaveBeenCalledWith(db, 2);
    });

    it('should allow deletion of other admin if not last', async () => {
      const mockAdminUser = makeUser(3, 'admin2', 1, 'admin', '2024-01-03T00:00:00Z');

      vi.mocked(userQueries.getUserById).mockResolvedValue(mockAdminUser);
      vi.mocked(userQueries.getAdminCount).mockResolvedValue(2); // 2 admins
      vi.mocked(userQueries.deleteUser).mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/users/3')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(204);
      expect(userQueries.deleteUser).toHaveBeenCalledWith(db, 3);
    });

    it('should return 404 for non-existent user', async () => {
      vi.mocked(userQueries.getUserById).mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/users/999')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    it('should return 400 for invalid ID format', async () => {
      const response = await request(app)
        .delete('/api/users/invalid')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid user ID');
    });

    it('should return 401 for unauthenticated', async () => {
      const response = await request(app).delete('/api/users/2');

      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin', async () => {
      const response = await request(app)
        .delete('/api/users/2')
        .set('Authorization', 'Bearer valid-user-token');

      expect(response.status).toBe(403);
    });

    it('should return 500 on database error', async () => {
      vi.mocked(userQueries.getUserById).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .delete('/api/users/2')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(500);
    });
  });
});
