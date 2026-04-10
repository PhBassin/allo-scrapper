import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import { createOrgExportRouter } from './org-export.js';
import type { DB, PoolClient } from '../db/types.js';
import jwt from 'jsonwebtoken';

describe('Org Export Routes', () => {
  let app: Express;
  let mockDb: DB;
  let mockClient: PoolClient;
  const jwtSecret = 'test-secret-minimum-32-chars-required-for-validation-superadmin';

  beforeEach(() => {
    process.env.JWT_SECRET = jwtSecret;
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    } as unknown as PoolClient;
    mockDb = {
      query: vi.fn(),
    } as unknown as DB;

    app = express();
    app.use(express.json());
    app.set('db', mockDb);
    
    // Simulate resolveTenant and requireAuth/requirePermission middleware
    app.use((req, res, next) => {
      (req as any).dbClient = mockClient;
      (req as any).org = { id: 1, slug: 'test-org', schema_name: 'org_test' };
      
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const token = authHeader.split(' ')[1];
        try {
          const decoded = jwt.verify(token, jwtSecret) as any;
          (req as any).user = decoded;
        } catch {}
      }

      // Explicit permission check for the test
      if (req.path === '/export' && !(req as any).user?.permissions?.includes('export_data')) {
        return res.status(403).json({ success: false, error: 'INSUFFICIENT_PERMISSIONS' });
      }

      next();
    });
    
    app.use('/', createOrgExportRouter());
  });

  describe('GET /export', () => {
    it('should return complete org export JSON', async () => {
      const token = jwt.sign(
        { id: 'user-1', org_id: 1, org_slug: 'test-org', permissions: ['export_data'] },
        jwtSecret
      );

      // Mock org data
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Test Org',
          slug: 'test-org',
          plan_id: 1,
          status: 'active',
          created_at: new Date('2026-01-01'),
        }],
        rowCount: 1,
      });

      // Mock cinemas
      vi.mocked(mockClient.query).mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Cinema 1', allocine_id: 'C0001' },
          { id: 2, name: 'Cinema 2', allocine_id: 'C0002' },
        ],
      } as any);

      // Mock showtimes (last 7 days)
      vi.mocked(mockClient.query).mockResolvedValueOnce({
        rows: [
          { id: 1, cinema_id: 1, showtime: new Date() },
        ],
      } as any);

      // Mock reports
      vi.mocked(mockClient.query).mockResolvedValueOnce({
        rows: [],
      } as any);

      // Mock settings
      vi.mocked(mockClient.query).mockResolvedValueOnce({
        rows: [{ logo_url: 'https://example.com/logo.png' }],
      } as any);

      const response = await request(app)
        .get('/export')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('org');
      expect(response.body.data.cinemas).toHaveLength(2);
    });

    it('should NOT leak sensitive organization fields', async () => {
      const token = jwt.sign(
        { id: 'user-1', org_id: 1, org_slug: 'test-org', permissions: ['export_data'] },
        jwtSecret
      );

      // Mock org data with sensitive fields
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Test Org',
          slug: 'test-org',
          plan_id: 1,
          status: 'active',
          created_at: new Date('2026-01-01'),
          stripe_subscription_id: 'sub_12345',
          internal_notes: 'Highly secret notes',
          private_metadata: { key: 'secret' }
        }],
        rowCount: 1,
      });

      // Mock other data
      vi.mocked(mockClient.query).mockResolvedValue({ rows: [] } as any);

      const response = await request(app)
        .get('/export')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      const org = response.body.data.org;
      
      // Allowed fields
      expect(org).toHaveProperty('id');
      expect(org).toHaveProperty('name');
      expect(org).toHaveProperty('slug');
      
      // Sensitive fields should NOT be present
      expect(org).not.toHaveProperty('stripe_subscription_id');
      expect(org).not.toHaveProperty('internal_notes');
      expect(org).not.toHaveProperty('private_metadata');
    });

    it('should require export_data permission', async () => {
      const token = jwt.sign(
        { id: 'user-1', org_id: 1, org_slug: 'test-org', permissions: [] },
        jwtSecret
      );

      const response = await request(app)
        .get('/export')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });
});
