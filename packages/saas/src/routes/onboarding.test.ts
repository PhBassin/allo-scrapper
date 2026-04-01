import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import supertest from 'supertest';
import { createOnboardingRouter } from './onboarding.js';
import type { Pool } from '../db/types.js';

// ── module mocks ──────────────────────────────────────────────────────────────

// Mock checkQuota to be a pass-through — quota enforcement is tested separately
vi.mock('../middleware/quota.js', () => ({
  checkQuota: vi.fn(() => (_req: any, _res: any, next: any) => next()),
}));

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
    createInvitation: vi.fn(),
  })),
}));

vi.mock('../services/saas-auth-service.js', () => ({
  SaasAuthService: vi.fn().mockImplementation(() => ({
    mintJwt: vi.fn().mockReturnValue('mock.jwt.token'),
  })),
}));

// ── helpers ───────────────────────────────────────────────────────────────────

const VALID_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';

const MOCK_ORG = {
  id: 'org-uuid-1',
  slug: 'my-cinema',
  schema_name: 'org_my_cinema',
};

/**
 * Makes a pool whose client resolves org queries with MOCK_ORG
 * (used for routes that look up the org from the token prefix).
 */
function makePoolWithOrg(): Pool {
  const client = {
    query: vi.fn().mockResolvedValue({ rows: [MOCK_ORG], rowCount: 1 }),
    release: vi.fn(),
  };
  return { connect: vi.fn().mockResolvedValue(client) };
}

/** Pool that returns empty rows — used to simulate org-not-found cases. */
function makeEmptyPool(): Pool {
  const client = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
  };
  return { connect: vi.fn().mockResolvedValue(client) };
}

function buildApp(pool: Pool): Express {
  const app = express();
  app.use(express.json());
  app.set('pool', pool);
  app.use('/api', createOnboardingRouter());
  return app;
}

// Token format used in all tests: "<orgSlug>:<hex>"
const VALID_VERIFY_TOKEN = 'my-cinema:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
const VALID_INVITE_TOKEN = 'my-cinema:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

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

    const app = buildApp(makePoolWithOrg());
    const res = await supertest(app).get(`/api/auth/verify-email/${VALID_VERIFY_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 when the token format is missing a colon separator', async () => {
    const app = buildApp(makeEmptyPool());
    const res = await supertest(app).get('/api/auth/verify-email/no-colon-here');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when org slug in token does not match any organization', async () => {
    const app = buildApp(makeEmptyPool()); // org lookup returns no rows
    const res = await supertest(app).get('/api/auth/verify-email/unknown-org:sometoken');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
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

    const app = buildApp(makePoolWithOrg());
    const res = await supertest(app).get(`/api/auth/verify-email/${VALID_VERIFY_TOKEN}`);

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
    token: VALID_INVITE_TOKEN,
    invited_by: 1,
    accepted_at: null,
    expires_at: new Date(Date.now() + 48 * 3600_000),
    created_at: new Date(),
    org_id: 'org-uuid-1',
    org_slug: 'my-cinema',
    org_schema_name: 'org_my_cinema',
  };

  it('returns 400 when password is missing', async () => {
    const app = buildApp(makePoolWithOrg());
    const res = await supertest(app)
      .post(`/api/auth/join/${VALID_INVITE_TOKEN}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when token format has no colon separator', async () => {
    const app = buildApp(makeEmptyPool());
    const res = await supertest(app)
      .post('/api/auth/join/bad-token-no-colon')
      .send({ password: 'NewPass1!' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when invitation token is invalid or expired', async () => {
    const { InvitationService } = await import('../services/invitation-service.js');
    vi.mocked(InvitationService).mockImplementationOnce(() => ({
      getInvitationByToken: vi.fn().mockResolvedValue(null),
      acceptInvitation: vi.fn(),
      createInvitation: vi.fn(),
    }));

    const app = buildApp(makePoolWithOrg());
    const res = await supertest(app)
      .post(`/api/auth/join/${VALID_INVITE_TOKEN}`)
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

    const app = buildApp(makePoolWithOrg());
    const res = await supertest(app)
      .post(`/api/auth/join/${VALID_INVITE_TOKEN}`)
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
    const app = buildAppWithOrg(makePoolWithOrg());
    const res = await supertest(app)
      .post('/api/org/my-cinema/invitations')
      .send({ role_id: 2 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when role_id is missing', async () => {
    const app = buildAppWithOrg(makePoolWithOrg());
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
      token: 'my-cinema:new-token-xyz',
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

    const app = buildAppWithOrg(makePoolWithOrg());
    const res = await supertest(app)
      .post('/api/org/my-cinema/invitations')
      .send({ email: 'bob@example.com', role_id: 2 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.invitation).toBeDefined();
    expect(res.body.invitation.email).toBe('bob@example.com');
  });
});
