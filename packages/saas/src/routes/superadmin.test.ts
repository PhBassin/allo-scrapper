import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import { createSuperadminRouter } from './superadmin.js';
import type { DB, Pool } from '../db/types.js';
import jwt from 'jsonwebtoken';

const bcrypt = {
  hash: vi.fn(),
  compare: vi.fn(),
};
vi.mock('bcrypt', () => ({ default: bcrypt }));

describe('Superadmin Routes', () => {
  let app: Express;
  let mockDb: DB;
  let mockPool: Pool;
  const jwtSecret = 'test-secret-minimum-32-chars-required-for-validation-superadmin';

  beforeEach(() => {
    process.env.JWT_SECRET = jwtSecret;
    mockDb = {
      query: vi.fn(),
    } as unknown as DB;
    mockPool = {
      connect: vi.fn(),
    } as unknown as Pool;

    app = express();
    app.use(express.json());
    app.set('db', mockDb);
    app.set('pool', mockPool);
    app.use('/api/superadmin', createSuperadminRouter());
  });

  describe('POST /api/superadmin/login', () => {
    it('should return token for valid credentials', async () => {
      const hashedPassword = 'hashed_superpass123';
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [{
          id: 'super-1',
          username: 'superadmin',
          password_hash: hashedPassword,
        }],
        rowCount: 1,
      });
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const response = await request(app)
        .post('/api/superadmin/login')
        .send({ username: 'superadmin', password: 'superpass123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
    });

    it('should return 401 for invalid credentials', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 });

      const response = await request(app)
        .post('/api/superadmin/login')
        .send({ username: 'superadmin', password: 'wrongpass' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('GET /api/superadmin/dashboard', () => {
    it('should return 401 without auth', async () => {
      const response = await request(app).get('/api/superadmin/dashboard');

      expect(response.status).toBe(401);
    });

    it('should return dashboard metrics with valid token', async () => {
      const token = jwt.sign({ id: 'super-1', username: 'superadmin', scope: 'superadmin' }, jwtSecret);
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({
          rows: [{
            total_orgs: 10,
            active_orgs: 7,
            suspended_orgs: 2,
            new_orgs_this_week: 3,
          }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [
            { plan_name: 'free', count: 5 },
            { plan_name: 'starter', count: 3 },
          ],
          rowCount: 2,
        });

      const response = await request(app)
        .get('/api/superadmin/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        totalOrgs: 10,
        activeOrgs: 7,
        suspendedOrgs: 2,
        newOrgsThisWeek: 3,
      });
    });
  });

  describe('GET /api/superadmin/orgs', () => {
    it('should return paginated orgs list', async () => {
      const token = jwt.sign({ id: 'super-1', username: 'superadmin', scope: 'superadmin' }, jwtSecret);
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({
          rows: [
            { id: 1, name: 'Org 1', slug: 'org-1', status: 'active' },
            { id: 2, name: 'Org 2', slug: 'org-2', status: 'trial' },
          ],
          rowCount: 2,
        })
        .mockResolvedValueOnce({
          rows: [{ count: '2' }],
          rowCount: 1,
        });

      const response = await request(app)
        .get('/api/superadmin/orgs?page=1&pageSize=20')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.orgs).toHaveLength(2);
      expect(response.body.data.total).toBe(2);
      expect(response.body.data.page).toBe(1);
    });
  });

  describe('POST /api/superadmin/orgs/:id/suspend', () => {
    it('should suspend org and create audit log', async () => {
      const token = jwt.sign({ id: 'super-1', username: 'superadmin', scope: 'superadmin' }, jwtSecret);
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 });

      const response = await request(app)
        .post('/api/superadmin/orgs/1/suspend')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE organizations SET status = 'suspended'"),
        expect.any(Array)
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_log'),
        expect.arrayContaining(['super-1', 'suspend_org'])
      );
    });
  });

  describe('POST /api/superadmin/impersonate', () => {
    it('should generate temporary org token with impersonated flag', async () => {
      const token = jwt.sign({ id: 'super-1', username: 'superadmin', scope: 'superadmin' }, jwtSecret);
      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // SET search_path
          .mockResolvedValueOnce({
            rows: [{ id: 1, username: 'admin', role_id: 1 }],
            rowCount: 1,
          }) // SELECT user
          .mockResolvedValueOnce({
            rows: [{ name: 'admin', permissions: JSON.stringify(['view_cinemas', 'manage_users']) }],
            rowCount: 1,
          }), // SELECT role
        release: vi.fn(),
      };
      vi.mocked(mockPool.connect).mockResolvedValue(mockClient as any);
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [{
          id: 1,
          slug: 'test-org',
          schema_name: 'org_test',
        }],
        rowCount: 1,
      }).mockResolvedValueOnce({ rows: [], rowCount: 0 }); // audit log

      const response = await request(app)
        .post('/api/superadmin/impersonate')
        .set('Authorization', `Bearer ${token}`)
        .send({ org_slug: 'test-org' });

      expect(response.status).toBe(200);
      expect(response.body.data.token).toBeDefined();
      
      const decoded = jwt.verify(response.body.data.token, jwtSecret) as any;
      expect(decoded.impersonated).toBe(true);
      expect(decoded.org_slug).toBe('test-org');
    });
  });

  describe('GET /api/superadmin/audit-log', () => {
    it('should return paginated audit log', async () => {
      const token = jwt.sign({ id: 'super-1', username: 'superadmin', scope: 'superadmin' }, jwtSecret);
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'log-1',
              actor_id: 'super-1',
              action: 'suspend_org',
              target_type: 'organization',
              target_id: '1',
              created_at: new Date(),
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ count: '1' }],
          rowCount: 1,
        });

      const response = await request(app)
        .get('/api/superadmin/audit-log?page=1&pageSize=50')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.logs).toHaveLength(1);
    });
  });
});
