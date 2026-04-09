import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { checkQuota } from './quota.js';
import * as orgQueries from '../db/org-queries.js';
import { QuotaService } from '../services/quota-service.js';
import type { DB, Plan } from '../db/types.js';

// Mock dependencies
vi.mock('../db/org-queries.js');
vi.mock('../services/quota-service.js');

describe('checkQuota middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let mockDb: DB;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
      release: vi.fn(),
    } as unknown as DB;

    mockReq = {
      org: {
        id: 42,
        name: 'Test Org',
        slug: 'test-org',
        plan_id: 1,
        schema_name: 'org_test_org',
        status: 'active',
        trial_ends_at: null,
      },
      dbClient: mockDb as any,
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();

    vi.clearAllMocks();
  });

  describe('when plan has null limits (unlimited)', () => {
    it('calls next() without checking usage', async () => {
      const unlimitedPlan: Plan = {
        id: 3,
        name: 'Enterprise',
        max_cinemas: null as unknown as number,
        max_users: null as unknown as number,
        max_scrapes_per_day: null as unknown as number,
      };

      vi.mocked(orgQueries.getPlanById).mockResolvedValueOnce(unlimitedPlan);

      const middleware = checkQuota('cinemas');
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(orgQueries.getPlanById).toHaveBeenCalledWith(mockDb, 1);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('when usage is under limit', () => {
    it('calls next() for cinemas resource', async () => {
      const freePlan: Plan = {
        id: 1,
        name: 'Free',
        max_cinemas: 1,
        max_users: 3,
        max_scrapes_per_day: 10,
      };

      vi.mocked(orgQueries.getPlanById).mockResolvedValueOnce(freePlan);

      const mockGetOrCreateUsage = vi.fn().mockResolvedValueOnce({
        id: 1,
        org_id: 42,
        month: '2026-04-01',
        cinemas_count: 0,  // under limit (1)
        users_count: 1,
        scrapes_count: 5,
        api_calls_count: 100,
      });

      vi.mocked(QuotaService).mockImplementationOnce(function() {
        return { getOrCreateUsage: mockGetOrCreateUsage } as any;
      });

      const middleware = checkQuota('cinemas');
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(orgQueries.getPlanById).toHaveBeenCalledWith(mockDb, 1);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('when quota is exceeded', () => {
    it('returns 402 QUOTA_EXCEEDED for cinemas', async () => {
      const freePlan: Plan = {
        id: 1,
        name: 'Free',
        max_cinemas: 1,
        max_users: 3,
        max_scrapes_per_day: 10,
      };

      vi.mocked(orgQueries.getPlanById).mockResolvedValueOnce(freePlan);

      const mockGetOrCreateUsage = vi.fn().mockResolvedValueOnce({
        id: 1,
        org_id: 42,
        month: '2026-04-01',
        cinemas_count: 1,  // at limit
        users_count: 1,
        scrapes_count: 5,
        api_calls_count: 100,
      });

      vi.mocked(QuotaService).mockImplementationOnce(function() {
        return { getOrCreateUsage: mockGetOrCreateUsage } as any;
      });

      const middleware = checkQuota('cinemas');
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(402);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'QUOTA_EXCEEDED',
        resource: 'cinemas',
        limit: 1,
        current: 1,
        upgrade_url: '/api/org/test-org/billing/checkout',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('returns 402 for users resource when quota exceeded', async () => {
      const freePlan: Plan = {
        id: 1,
        name: 'Free',
        max_cinemas: 1,
        max_users: 3,
        max_scrapes_per_day: 10,
      };

      vi.mocked(orgQueries.getPlanById).mockResolvedValueOnce(freePlan);

      const mockGetOrCreateUsage = vi.fn().mockResolvedValueOnce({
        id: 1,
        org_id: 42,
        month: '2026-04-01',
        cinemas_count: 0,
        users_count: 3,  // at limit
        scrapes_count: 5,
        api_calls_count: 100,
      });

      vi.mocked(QuotaService).mockImplementationOnce(function() {
        return { getOrCreateUsage: mockGetOrCreateUsage } as any;
      });

      const middleware = checkQuota('users');
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(402);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'QUOTA_EXCEEDED',
        resource: 'users',
        limit: 3,
        current: 3,
        upgrade_url: '/api/org/test-org/billing/checkout',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('returns 402 for scrapes resource when quota exceeded', async () => {
      const freePlan: Plan = {
        id: 1,
        name: 'Free',
        max_cinemas: 1,
        max_users: 3,
        max_scrapes_per_day: 10,
      };

      vi.mocked(orgQueries.getPlanById).mockResolvedValueOnce(freePlan);

      const mockGetOrCreateUsage = vi.fn().mockResolvedValueOnce({
        id: 1,
        org_id: 42,
        month: '2026-04-01',
        cinemas_count: 0,
        users_count: 1,
        scrapes_count: 10,  // at limit
        api_calls_count: 100,
      });

      vi.mocked(QuotaService).mockImplementationOnce(function() {
        return { getOrCreateUsage: mockGetOrCreateUsage } as any;
      });

      const middleware = checkQuota('scrapes');
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(402);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'QUOTA_EXCEEDED',
        resource: 'scrapes',
        limit: 10,
        current: 10,
        upgrade_url: '/api/org/test-org/billing/checkout',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('error cases', () => {
    it('returns 500 when tenant is not resolved (no req.org)', async () => {
      mockReq.org = undefined;

      const middleware = checkQuota('cinemas');
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Tenant not resolved' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('returns 500 when plan is not found in DB', async () => {
      vi.mocked(orgQueries.getPlanById).mockResolvedValueOnce(null);

      const middleware = checkQuota('cinemas');
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Plan not found' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
