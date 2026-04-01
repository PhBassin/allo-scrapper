import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import supertest from 'supertest';
import { createOnboardingRouter } from './onboarding.js';
import type { Pool } from '../db/types.js';

// ── module mocks ──────────────────────────────────────────────────────────────

vi.mock('../services/email-service.js', () => ({
  EmailService: vi.fn().mockImplementation(() => ({
    verifyEmailToken: vi.fn(),
    markEmailVerified: vi.fn().mockResolvedValue(undefined),
    generateVerificationToken: vi.fn().mockReturnValue('gen-token'),
    storeVerificationToken: vi.fn().mockResolvedValue(undefined),
    sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../services/invitation-service.js', () => ({
  InvitationService: vi.fn().mockImplementation(() => ({
    getInvitationByToken: vi.fn(),
    acceptInvitation: vi.fn(),
  })),
}));

vi.mock('../services/saas-auth-service.js', () => ({
  SaasAuthService: vi.fn().mockImplementation(() => ({
    mintJwt: vi.fn().mockReturnValue('mock.jwt.token'),
  })),
}));

// ── helpers ───────────────────────────────────────────────────────────────────

const VALID_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';

function makePool(): Pool {
  return { connect: vi.fn().mockResolvedValue({ query: vi.fn(), release: vi.fn() }) };
}

function buildApp(pool: Pool): Express {
  const app = express();
  app.use(express.json());
  app.set('pool', pool);
  app.use('/api', createOnboardingRouter());
  return app;
}

// ── GET /api/auth/verify-email/:token ────────────────────────────────────────

describe('GET /api/auth/verify-email/:token', () => {
  beforeEach(() => {
    vi.stubEnv('JWT_SECRET', VALID_JWT_SECRET);
  });

  it('returns 200 and marks user verified when token is valid', async () => {
    const { EmailService } = await import('../services/email-service.js');
    vi.mocked(EmailService).mockImplementationOnce(() => ({
      verifyEmailToken: vi.fn().mockResolvedValue(42), // returns user_id
      markEmailVerified: vi.fn().mockResolvedValue(undefined),
      generateVerificationToken: vi.fn(),
      storeVerificationToken: vi.fn(),
      sendVerificationEmail: vi.fn(),
    }));

    const app = buildApp(makePool());
    const res = await supertest(app).get('/api/auth/verify-email/valid-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 when the token is invalid or expired', async () => {
    const { EmailService } = await import('../services/email-service.js');
    vi.mocked(EmailService).mockImplementationOnce(() => ({
      verifyEmailToken: vi.fn().mockResolvedValue(null), // not found / expired
      markEmailVerified: vi.fn(),
      generateVerificationToken: vi.fn(),
      storeVerificationToken: vi.fn(),
      sendVerificationEmail: vi.fn(),
    }));

    const app = buildApp(makePool());
    const res = await supertest(app).get('/api/auth/verify-email/bad-token');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ── POST /api/auth/join/:token ────────────────────────────────────────────────

describe('POST /api/auth/join/:token', () => {
  beforeEach(() => {
    vi.stubEnv('JWT_SECRET', VALID_JWT_SECRET);
  });

  const MOCK_INVITE = {
    id: 'inv-uuid-1',
    email: 'bob@example.com',
    role_id: 2,
    token: 'valid-invite-token',
    invited_by: 1,
    accepted_at: null,
    expires_at: new Date(Date.now() + 48 * 3600_000),
    created_at: new Date(),
    org_id: 'org-uuid-1',
    org_slug: 'my-cinema',
    org_schema_name: 'org_my_cinema',
  };

  it('returns 400 when password is missing', async () => {
    const app = buildApp(makePool());
    const res = await supertest(app)
      .post('/api/auth/join/some-token')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when invitation token is invalid or expired', async () => {
    const { InvitationService } = await import('../services/invitation-service.js');
    vi.mocked(InvitationService).mockImplementationOnce(() => ({
      getInvitationByToken: vi.fn().mockResolvedValue(null),
      acceptInvitation: vi.fn(),
      createInvitation: vi.fn(),
    }));

    const app = buildApp(makePool());
    const res = await supertest(app)
      .post('/api/auth/join/expired-token')
      .send({ password: 'NewPass1!' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 201 with token and user on successful join', async () => {
    const { InvitationService } = await import('../services/invitation-service.js');
    vi.mocked(InvitationService).mockImplementationOnce(() => ({
      getInvitationByToken: vi.fn().mockResolvedValue(MOCK_INVITE),
      acceptInvitation: vi.fn().mockResolvedValue({
        id: 99,
        username: 'bob@example.com',
        role_id: 2,
        role_name: 'user',
      }),
      createInvitation: vi.fn(),
    }));

    const app = buildApp(makePool());
    const res = await supertest(app)
      .post('/api/auth/join/valid-invite-token')
      .send({ password: 'SecurePass1!' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.username).toBe('bob@example.com');
  });
});

// ── POST /api/org/:slug/invitations ──────────────────────────────────────────

describe('POST /api/org/:slug/invitations', () => {
  const MOCK_ORG = {
    id: 'org-uuid-1',
    slug: 'my-cinema',
    schema_name: 'org_my_cinema',
    status: 'trial',
  };

  function buildAppWithOrg(pool: Pool): Express {
    const app = express();
    app.use(express.json());
    app.set('pool', pool);
    // Simulate resolveTenant by setting req.org manually
    app.use((req: any, _res: any, next: any) => {
      req.org = MOCK_ORG;
      req.user = { id: 1, username: 'admin@my-cinema.com', role_name: 'admin' };
      next();
    });
    app.use('/api', createOnboardingRouter());
    return app;
  }

  it('returns 400 when email is missing', async () => {
    const app = buildAppWithOrg(makePool());
    const res = await supertest(app)
      .post('/api/org/my-cinema/invitations')
      .send({ role_id: 2 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when role_id is missing', async () => {
    const app = buildAppWithOrg(makePool());
    const res = await supertest(app)
      .post('/api/org/my-cinema/invitations')
      .send({ email: 'bob@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 201 with the invitation on success', async () => {
    const { InvitationService } = await import('../services/invitation-service.js');
    const MOCK_CREATED = {
      id: 'inv-uuid-1',
      email: 'bob@example.com',
      role_id: 2,
      token: 'new-token-xyz',
      invited_by: 1,
      accepted_at: null,
      expires_at: new Date(Date.now() + 48 * 3600_000),
      created_at: new Date(),
    };
    vi.mocked(InvitationService).mockImplementationOnce(() => ({
      createInvitation: vi.fn().mockResolvedValue(MOCK_CREATED),
      getInvitationByToken: vi.fn(),
      acceptInvitation: vi.fn(),
    }));

    const { EmailService } = await import('../services/email-service.js');
    vi.mocked(EmailService).mockImplementationOnce(() => ({
      verifyEmailToken: vi.fn(),
      markEmailVerified: vi.fn(),
      generateVerificationToken: vi.fn().mockReturnValue('gen-token'),
      storeVerificationToken: vi.fn(),
      sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    }));

    const app = buildAppWithOrg(makePool());
    const res = await supertest(app)
      .post('/api/org/my-cinema/invitations')
      .send({ email: 'bob@example.com', role_id: 2 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.invitation).toBeDefined();
    expect(res.body.invitation.email).toBe('bob@example.com');
  });
});
