import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import usersRouter from './users.js';
import type { DB } from '../db/client.js';

// Mock dependencies
vi.mock('../db/user-queries.js');
vi.mock('../db/queries.js');
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

import * as userQueries from '../db/user-queries.js';
import * as queries from '../db/queries.js';

describe('User Management Routes', () => {
  let app: express.Application;
  const mockDb: DB = {
    query: vi.fn(),
  } as unknown as DB;

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
        { id: 1, username: 'admin', role: 'admin', created_at: '2024-01-01T00:00:00Z' },
        { id: 2, username: 'user1', role: 'user', created_at: '2024-01-02T00:00:00Z' },
      ];

      vi.mocked(userQueries.getAllUsers).mockResolvedValue(mockUsers);

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUsers);
      expect(userQueries.getAllUsers).toHaveBeenCalledWith(mockDb, { limit: 100, offset: 0 });
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
      expect(response.body.error).toBe('Admin required');
    });

    it('should support limit query parameter', async () => {
      vi.mocked(userQueries.getAllUsers).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/users?limit=50')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(200);
      expect(userQueries.getAllUsers).toHaveBeenCalledWith(mockDb, { limit: 50, offset: 0 });
    });

    it('should support offset query parameter', async () => {
      vi.mocked(userQueries.getAllUsers).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/users?offset=10')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(200);
      expect(userQueries.getAllUsers).toHaveBeenCalledWith(mockDb, { limit: 100, offset: 10 });
    });

    it('should support both limit and offset parameters', async () => {
      vi.mocked(userQueries.getAllUsers).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/users?limit=25&offset=50')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(200);
      expect(userQueries.getAllUsers).toHaveBeenCalledWith(mockDb, { limit: 25, offset: 50 });
    });

    it('should return 500 on database error', async () => {
      vi.mocked(userQueries.getAllUsers).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('GET /api/users/:id', () => {
    it('should return user by ID without password (200)', async () => {
      const mockUser = {
        id: 2,
        username: 'user1',
        role: 'user',
        created_at: '2024-01-02T00:00:00Z',
      };

      vi.mocked(userQueries.getUserById).mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/users/2')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUser);
      expect(userQueries.getUserById).toHaveBeenCalledWith(mockDb, 2);
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
    it('should create user with provided role (201)', async () => {
      const newUser = {
        id: 3,
        username: 'newuser',
        role: 'user',
        created_at: '2024-01-03T00:00:00Z',
      };

      // Mock username check (no duplicate)
      vi.mocked(mockDb.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
      // Mock user creation
      vi.mocked(mockDb.query).mockResolvedValueOnce({ rows: [newUser], rowCount: 1 } as any);

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({
          username: 'newuser',
          password: 'Test1234!',
          role: 'user',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(newUser);
    });

    it('should create user with default role=user if not provided', async () => {
      const newUser = {
        id: 3,
        username: 'newuser',
        role: 'user',
        created_at: '2024-01-03T00:00:00Z',
      };

      vi.mocked(mockDb.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
      vi.mocked(mockDb.query).mockResolvedValueOnce({ rows: [newUser], rowCount: 1 } as any);

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({
          username: 'newuser',
          password: 'Test1234!',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.role).toBe('user');
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
      // Mock username exists
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [{ id: 2 }],
        rowCount: 1,
      } as any);

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({
          username: 'existinguser',
          password: 'Test1234!',
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
      expect(response.body.error).toBe('Password is required');
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

    it('should validate role is admin or user', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({
          username: 'newuser',
          password: 'Test1234!',
          role: 'superadmin',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Role must be either "admin" or "user"');
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
      vi.mocked(mockDb.query).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({
          username: 'newuser',
          password: 'Test1234!',
        });

      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/users/:id/role', () => {
    it('should update user role successfully (200)', async () => {
      const mockUser = {
        id: 2,
        username: 'user1',
        role: 'user',
        created_at: '2024-01-02T00:00:00Z',
      };

      vi.mocked(userQueries.getUserById).mockResolvedValue(mockUser);
      vi.mocked(userQueries.getAdminCount).mockResolvedValue(2); // More than 1 admin
      vi.mocked(userQueries.updateUserRole).mockResolvedValue(undefined);

      const response = await request(app)
        .put('/api/users/2/role')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ role: 'admin' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.role).toBe('admin');
      expect(userQueries.updateUserRole).toHaveBeenCalledWith(mockDb, 2, 'admin');
    });

    it('should prevent last admin from demoting self (403)', async () => {
      const mockAdminUser = {
        id: 1,
        username: 'admin',
        role: 'admin',
        created_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(userQueries.getUserById).mockResolvedValue(mockAdminUser);
      vi.mocked(userQueries.getAdminCount).mockResolvedValue(1); // Only 1 admin

      const response = await request(app)
        .put('/api/users/1/role')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ role: 'user' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Cannot demote the last admin user');
      expect(userQueries.updateUserRole).not.toHaveBeenCalled();
    });

    it('should allow admin to demote other admins (if not last)', async () => {
      const mockAdminUser = {
        id: 3,
        username: 'admin2',
        role: 'admin',
        created_at: '2024-01-03T00:00:00Z',
      };

      vi.mocked(userQueries.getUserById).mockResolvedValue(mockAdminUser);
      vi.mocked(userQueries.getAdminCount).mockResolvedValue(2); // 2 admins
      vi.mocked(userQueries.updateUserRole).mockResolvedValue(undefined);

      const response = await request(app)
        .put('/api/users/3/role')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ role: 'user' });

      expect(response.status).toBe(200);
      expect(userQueries.updateUserRole).toHaveBeenCalledWith(mockDb, 3, 'user');
    });

    it('should allow admin to promote users to admin', async () => {
      const mockUser = {
        id: 2,
        username: 'user1',
        role: 'user',
        created_at: '2024-01-02T00:00:00Z',
      };

      vi.mocked(userQueries.getUserById).mockResolvedValue(mockUser);
      vi.mocked(userQueries.updateUserRole).mockResolvedValue(undefined);

      const response = await request(app)
        .put('/api/users/2/role')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ role: 'admin' });

      expect(response.status).toBe(200);
      expect(userQueries.updateUserRole).toHaveBeenCalledWith(mockDb, 2, 'admin');
    });

    it('should return 404 for non-existent user', async () => {
      vi.mocked(userQueries.getUserById).mockResolvedValue(undefined);

      const response = await request(app)
        .put('/api/users/999/role')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ role: 'admin' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    it('should return 400 for invalid role', async () => {
      const response = await request(app)
        .put('/api/users/2/role')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ role: 'superadmin' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Role must be either "admin" or "user"');
    });

    it('should return 400 for invalid ID format', async () => {
      const response = await request(app)
        .put('/api/users/invalid/role')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ role: 'admin' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid user ID');
    });

    it('should return 401 for unauthenticated', async () => {
      const response = await request(app)
        .put('/api/users/2/role')
        .send({ role: 'admin' });

      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin', async () => {
      const response = await request(app)
        .put('/api/users/2/role')
        .set('Authorization', 'Bearer valid-user-token')
        .send({ role: 'admin' });

      expect(response.status).toBe(403);
    });

    it('should return 500 on database error', async () => {
      vi.mocked(userQueries.getUserById).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .put('/api/users/2/role')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ role: 'admin' });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/users/:id/reset-password', () => {
    it('should generate random password and update user (200)', async () => {
      const mockUser = {
        id: 2,
        username: 'user1',
        role: 'user',
        created_at: '2024-01-02T00:00:00Z',
      };

      vi.mocked(userQueries.getUserById).mockResolvedValue(mockUser);
      vi.mocked(userQueries.generateRandomPassword).mockReturnValue('RandomPass123!@#');
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 1 } as any);

      const response = await request(app)
        .post('/api/users/2/reset-password')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.newPassword).toBe('RandomPass123!@#');
      expect(response.body.data.message).toContain('reset');
    });

    it('should return new password in response for admin to share', async () => {
      const mockUser = {
        id: 2,
        username: 'user1',
        role: 'user',
        created_at: '2024-01-02T00:00:00Z',
      };

      vi.mocked(userQueries.getUserById).mockResolvedValue(mockUser);
      vi.mocked(userQueries.generateRandomPassword).mockReturnValue('NewPass456!@#');
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 1 } as any);

      const response = await request(app)
        .post('/api/users/2/reset-password')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.body.data).toHaveProperty('newPassword');
      expect(typeof response.body.data.newPassword).toBe('string');
    });

    it('should hash password before storing', async () => {
      const mockUser = {
        id: 2,
        username: 'user1',
        role: 'user',
        created_at: '2024-01-02T00:00:00Z',
      };

      vi.mocked(userQueries.getUserById).mockResolvedValue(mockUser);
      vi.mocked(userQueries.generateRandomPassword).mockReturnValue('RandomPass123!@#');
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await request(app)
        .post('/api/users/2/reset-password')
        .set('Authorization', 'Bearer valid-admin-token');

      // Verify password was hashed (bcrypt hash starts with $2b$)
      expect(mockDb.query).toHaveBeenCalled();
      const queryCall = vi.mocked(mockDb.query).mock.calls[0];
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
      const mockUser = {
        id: 2,
        username: 'user1',
        role: 'user',
        created_at: '2024-01-02T00:00:00Z',
      };

      vi.mocked(userQueries.getUserById).mockResolvedValue(mockUser);
      vi.mocked(userQueries.deleteUser).mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/users/2')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(204);
      expect(userQueries.deleteUser).toHaveBeenCalledWith(mockDb, 2);
    });

    it('should prevent deletion of last admin (403)', async () => {
      const mockAdminUser = {
        id: 1,
        username: 'admin',
        role: 'admin',
        created_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(userQueries.getUserById).mockResolvedValue(mockAdminUser);
      vi.mocked(userQueries.getAdminCount).mockResolvedValue(1); // Only 1 admin

      const response = await request(app)
        .delete('/api/users/1')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Cannot delete the last admin user');
      expect(userQueries.deleteUser).not.toHaveBeenCalled();
    });

    it('should prevent admin from deleting themselves (403)', async () => {
      const mockAdminUser = {
        id: 1,
        username: 'admin',
        role: 'admin',
        created_at: '2024-01-01T00:00:00Z',
      };

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
      const mockUser = {
        id: 2,
        username: 'user1',
        role: 'user',
        created_at: '2024-01-02T00:00:00Z',
      };

      vi.mocked(userQueries.getUserById).mockResolvedValue(mockUser);
      vi.mocked(userQueries.deleteUser).mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/users/2')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(204);
      expect(userQueries.deleteUser).toHaveBeenCalledWith(mockDb, 2);
    });

    it('should allow deletion of other admin if not last', async () => {
      const mockAdminUser = {
        id: 3,
        username: 'admin2',
        role: 'admin',
        created_at: '2024-01-03T00:00:00Z',
      };

      vi.mocked(userQueries.getUserById).mockResolvedValue(mockAdminUser);
      vi.mocked(userQueries.getAdminCount).mockResolvedValue(2); // 2 admins
      vi.mocked(userQueries.deleteUser).mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/users/3')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(204);
      expect(userQueries.deleteUser).toHaveBeenCalledWith(mockDb, 3);
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
