/**
 * RED tests for InvitationService.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DB, Organization } from '../db/types.js';

function makeDb(queryImpl?: ReturnType<typeof vi.fn>): DB {
  return {
    query: queryImpl ?? vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  };
}

function makeOrg(): Organization {
  return {
    id: 1,
    name: 'Acme',
    slug: 'acme',
    plan_id: 1,
    schema_name: 'org_acme',
    status: 'active',
    trial_ends_at: null,
  };
}

describe('InvitationService', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('createInvitation', () => {
    it('inserts an invitation row and returns it with a prefixed token', async () => {
      const invitation = {
        id: 'uuid-1',
        email: 'bob@example.com',
        role_id: 2,
        token: 'acme:abc',
        expires_at: new Date(Date.now() + 48 * 3600_000).toISOString(),
        accepted_at: null,
        created_by: null,
        created_at: new Date().toISOString(),
      };
      const queryMock = vi.fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // SET search_path
        .mockResolvedValueOnce({ rows: [invitation], rowCount: 1 }); // INSERT
      const db = makeDb(queryMock);

      const { InvitationService } = await import('./invitation-service.js');
      const svc = new InvitationService(db);
      const result = await svc.createInvitation(makeOrg(), {
        email: 'bob@example.com',
        role_id: 2,
      });

      expect(result.email).toBe('bob@example.com');
      // token must be prefixed with orgSlug:
      expect(result.token).toMatch(/^acme:/);
    });

    it('sets expiry ~48 hours in the future', async () => {
      const now = Date.now();
      const invitation = {
        id: 'uuid-2',
        email: 'carol@example.com',
        role_id: 1,
        token: 'acme:xyz',
        expires_at: new Date(now + 48 * 3600_000).toISOString(),
        accepted_at: null,
        created_by: null,
        created_at: new Date().toISOString(),
      };
      const queryMock = vi.fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [invitation], rowCount: 1 });
      const db = makeDb(queryMock);

      const { InvitationService } = await import('./invitation-service.js');
      const svc = new InvitationService(db);
      const result = await svc.createInvitation(makeOrg(), {
        email: 'carol@example.com',
        role_id: 1,
      });

      const expiresAt = new Date(result.expires_at).getTime();
      // Between 47h and 49h from now
      expect(expiresAt).toBeGreaterThan(now + 47 * 3600_000);
      expect(expiresAt).toBeLessThan(now + 49 * 3600_000);
    });
  });

  describe('getInvitationByToken', () => {
    it('returns invitation when valid and not yet accepted', async () => {
      const future = new Date(Date.now() + 3600_000).toISOString();
      const invitation = {
        id: 'uuid-3',
        email: 'dave@example.com',
        token: 'acme:tok',
        expires_at: future,
        accepted_at: null,
      };
      const queryMock = vi.fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [invitation], rowCount: 1 });
      const db = makeDb(queryMock);

      const { InvitationService } = await import('./invitation-service.js');
      const svc = new InvitationService(db);
      const result = await svc.getInvitationByToken(makeOrg(), 'acme:tok');

      expect(result).not.toBeNull();
      expect(result?.email).toBe('dave@example.com');
    });

    it('returns null when invitation is expired', async () => {
      const past = new Date(Date.now() - 1000).toISOString();
      const invitation = {
        id: 'uuid-4',
        email: 'eve@example.com',
        token: 'acme:old',
        expires_at: past,
        accepted_at: null,
      };
      const queryMock = vi.fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [invitation], rowCount: 1 });
      const db = makeDb(queryMock);

      const { InvitationService } = await import('./invitation-service.js');
      const svc = new InvitationService(db);
      const result = await svc.getInvitationByToken(makeOrg(), 'acme:old');

      expect(result).toBeNull();
    });

    it('returns null when invitation is already accepted', async () => {
      const future = new Date(Date.now() + 3600_000).toISOString();
      const invitation = {
        id: 'uuid-5',
        email: 'frank@example.com',
        token: 'acme:used',
        expires_at: future,
        accepted_at: new Date().toISOString(),
      };
      const queryMock = vi.fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [invitation], rowCount: 1 });
      const db = makeDb(queryMock);

      const { InvitationService } = await import('./invitation-service.js');
      const svc = new InvitationService(db);
      const result = await svc.getInvitationByToken(makeOrg(), 'acme:used');

      expect(result).toBeNull();
    });

    it('returns null when token not found', async () => {
      const queryMock = vi.fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const db = makeDb(queryMock);

      const { InvitationService } = await import('./invitation-service.js');
      const svc = new InvitationService(db);
      const result = await svc.getInvitationByToken(makeOrg(), 'missing');

      expect(result).toBeNull();
    });
  });

  describe('acceptInvitation', () => {
    it('creates a user and marks invitation accepted', async () => {
      const future = new Date(Date.now() + 3600_000).toISOString();
      const invitation = {
        id: 'uuid-6',
        email: 'grace@example.com',
        role_id: 2,
        token: 'acme:tok',
        expires_at: future,
        accepted_at: null,
      };
      const newUser = { id: 99, username: 'grace@example.com', role_id: 2, role_name: 'editor' };
      const queryMock = vi.fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // SET search_path
        .mockResolvedValueOnce({ rows: [newUser], rowCount: 1 }) // INSERT user
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // UPDATE invitation
      const db = makeDb(queryMock);

      const { InvitationService } = await import('./invitation-service.js');
      const svc = new InvitationService(db);
      const result = await svc.acceptInvitation(makeOrg(), invitation as any, 'password123');

      expect(result.username).toBe('grace@example.com');

      // Verify invitation was marked accepted
      const calls = queryMock.mock.calls.map(([sql]) => sql as string);
      expect(
        calls.some(
          (s) => s.toLowerCase().includes('update') && s.toLowerCase().includes('accepted_at')
        )
      ).toBe(true);
    });
  });
});
