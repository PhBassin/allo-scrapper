/**
 * RED tests for onboarding routes.
 *
 * GET  /api/auth/verify-email/:token
 * POST /api/auth/join/:token
 * POST /api/org/:slug/invitations
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Organization } from '../db/types.js';

// Mock EmailService and InvitationService to avoid real DB calls
vi.mock('../services/email-service.js', () => ({
  EmailService: vi.fn().mockImplementation(() => ({
    verifyEmailToken: vi.fn(),
    markEmailVerified: vi.fn().mockResolvedValue(undefined),
    generateVerificationToken: vi.fn().mockReturnValue('a'.repeat(64)),
    storeVerificationToken: vi.fn().mockResolvedValue(undefined),
    sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../services/invitation-service.js', () => ({
  InvitationService: vi.fn().mockImplementation(() => ({
    createInvitation: vi.fn(),
    getInvitationByToken: vi.fn(),
    acceptInvitation: vi.fn(),
  })),
}));

vi.mock('../services/saas-auth-service.js', () => ({
  SaasAuthService: vi.fn().mockImplementation(() => ({
    createAdminUser: vi.fn(),
    mintJwt: vi.fn().mockReturnValue('mock.jwt.token'),
  })),
}));

function makeOrg(slug = 'acme'): Organization {
  return {
    id: 1,
    name: 'Acme',
    slug,
    plan_id: 1,
    schema_name: `org_${slug}`,
    status: 'active',
    trial_ends_at: null,
  };
}

function buildApp(orgSlug = 'acme') {
  const app = express();
  app.use(express.json());

  const db = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
  const pool = {
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [makeOrg(orgSlug)], rowCount: 1 }),
      release: vi.fn(),
    }),
  };
  app.set('db', db);
  app.set('pool', pool);

  // Simulate resolveTenant for /api/org/:slug routes
  app.use('/api/org/:slug', (req, _res, next) => {
    (req as any).org = makeOrg((req.params as any).slug);
    (req as any).dbClient = db;
    next();
  });

  return app;
}

describe('GET /api/auth/verify-email/:token', () => {
  it('returns 200 when token is valid', async () => {
    const { EmailService } = await import('../services/email-service.js');
    vi.mocked(EmailService).mockImplementation(() => ({
      verifyEmailToken: vi.fn().mockResolvedValue(7),
      markEmailVerified: vi.fn().mockResolvedValue(undefined),
      generateVerificationToken: vi.fn().mockReturnValue('a'.repeat(64)),
      storeVerificationToken: vi.fn().mockResolvedValue(undefined),
      sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    }));

    const app = buildApp();
    const { createOnboardingRouter } = await import('./onboarding.js');
    app.use('/api', createOnboardingRouter());

    const res = await request(app).get('/api/auth/verify-email/acme:validtoken');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 when token is invalid or expired', async () => {
    const { EmailService } = await import('../services/email-service.js');
    vi.mocked(EmailService).mockImplementation(() => ({
      verifyEmailToken: vi.fn().mockResolvedValue(null),
      markEmailVerified: vi.fn().mockResolvedValue(undefined),
      generateVerificationToken: vi.fn().mockReturnValue('a'.repeat(64)),
      storeVerificationToken: vi.fn().mockResolvedValue(undefined),
      sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    }));

    const app = buildApp();
    const { createOnboardingRouter } = await import('./onboarding.js');
    app.use('/api', createOnboardingRouter());

    const res = await request(app).get('/api/auth/verify-email/acme:expiredtoken');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_OR_EXPIRED_TOKEN');
  });

  it('returns 400 when token has no org prefix', async () => {
    const app = buildApp();
    const { createOnboardingRouter } = await import('./onboarding.js');
    app.use('/api', createOnboardingRouter());

    const res = await request(app).get('/api/auth/verify-email/notprefixed');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/join/:token', () => {
  it('returns 201 with JWT when invitation is valid', async () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    const invitation = {
      id: 'uuid-1',
      email: 'bob@example.com',
      role_id: 2,
      token: 'acme:tok',
      expires_at: future,
      accepted_at: null,
    };
    const newUser = { id: 10, username: 'bob@example.com', role_id: 2, role_name: 'editor' };

    const { InvitationService } = await import('../services/invitation-service.js');
    vi.mocked(InvitationService).mockImplementation(() => ({
      createInvitation: vi.fn(),
      getInvitationByToken: vi.fn().mockResolvedValue(invitation),
      acceptInvitation: vi.fn().mockResolvedValue(newUser),
    }));

    const { SaasAuthService } = await import('../services/saas-auth-service.js');
    vi.mocked(SaasAuthService).mockImplementation(() => ({
      createAdminUser: vi.fn(),
      mintJwt: vi.fn().mockReturnValue('join.jwt.token'),
    }));

    const app = buildApp();
    // Inject org lookup mock for the join route
    const db = app.get('db') as { query: ReturnType<typeof vi.fn> };
    db.query = vi.fn()
      .mockResolvedValueOnce({ rows: [makeOrg('acme')], rowCount: 1 }); // getOrgBySlug

    const { createOnboardingRouter } = await import('./onboarding.js');
    app.use('/api', createOnboardingRouter());

    const res = await request(app)
      .post('/api/auth/join/acme:tok')
      .send({ password: 'secret123' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
  });

  it('returns 400 when invitation token is invalid or expired', async () => {
    const { InvitationService } = await import('../services/invitation-service.js');
    vi.mocked(InvitationService).mockImplementation(() => ({
      createInvitation: vi.fn(),
      getInvitationByToken: vi.fn().mockResolvedValue(null),
      acceptInvitation: vi.fn(),
    }));

    const app = buildApp();
    const db = app.get('db') as { query: ReturnType<typeof vi.fn> };
    db.query = vi.fn()
      .mockResolvedValueOnce({ rows: [makeOrg('acme')], rowCount: 1 });

    const { createOnboardingRouter } = await import('./onboarding.js');
    app.use('/api', createOnboardingRouter());

    const res = await request(app)
      .post('/api/auth/join/acme:expired')
      .send({ password: 'secret123' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/org/:slug/invitations', () => {
  it('returns 201 with token when authenticated and valid', async () => {
    const future = new Date(Date.now() + 48 * 3600_000).toISOString();
    const invitation = {
      id: 'uuid-new',
      email: 'new@example.com',
      role_id: 2,
      token: 'acme:newtok',
      expires_at: future,
      accepted_at: null,
      created_at: new Date().toISOString(),
    };

    const { InvitationService } = await import('../services/invitation-service.js');
    vi.mocked(InvitationService).mockImplementation(() => ({
      createInvitation: vi.fn().mockResolvedValue(invitation),
      getInvitationByToken: vi.fn(),
      acceptInvitation: vi.fn(),
    }));

    const app = buildApp();
    // Mock requireAuth by injecting user
    app.use('/api/org/:slug/invitations', (req, _res, next) => {
      (req as any).user = { id: 1, username: 'admin', org_slug: (req.params as any).slug };
      next();
    });

    const { createOnboardingRouter } = await import('./onboarding.js');
    app.use('/api', createOnboardingRouter());

    const res = await request(app)
      .post('/api/org/acme/invitations')
      .send({ email: 'new@example.com', role_id: 2 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBe('acme:newtok');
  });

  it('returns 400 when email is missing', async () => {
    const app = buildApp();
    app.use('/api/org/:slug/invitations', (req, _res, next) => {
      (req as any).user = { id: 1, username: 'admin', org_slug: 'acme' };
      next();
    });

    const { createOnboardingRouter } = await import('./onboarding.js');
    app.use('/api', createOnboardingRouter());

    const res = await request(app)
      .post('/api/org/acme/invitations')
      .send({ role_id: 2 });

    expect(res.status).toBe(400);
  });
});
