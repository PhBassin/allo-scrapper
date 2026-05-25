import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';

describe('requireAuth (multi-secret verification)', () => {
  const VALID_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';
  const OLD_SECRET = 'b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7';

  beforeEach(() => {
    vi.resetModules();
    process.env.JWT_SECRET = VALID_SECRET;
    delete process.env.JWT_PREVIOUS_SECRETS;
  });

  it('should reject request without Authorization header', async () => {
    const { requireAuth } = await import('./auth.js');
    const req = { headers: {} } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    requireAuth(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should accept token signed with current secret', async () => {
    process.env.JWT_PREVIOUS_SECRETS = OLD_SECRET;

    const { requireAuth } = await import('./auth.js');
    const token = jwt.sign({ id: 1, username: 'test' }, VALID_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    requireAuth(req, res as any, next);

    expect(next).toHaveBeenCalled();
    expect(req.user?.id).toBe(1);
  });

  it('should accept token signed with previous secret', async () => {
    process.env.JWT_PREVIOUS_SECRETS = OLD_SECRET;

    const { requireAuth } = await import('./auth.js');
    const token = jwt.sign({ id: 2, username: 'rotated' }, OLD_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    requireAuth(req, res as any, next);

    expect(next).toHaveBeenCalled();
    expect(req.user?.id).toBe(2);
  });

  it('should reject token signed with unknown secret', async () => {
    process.env.JWT_PREVIOUS_SECRETS = OLD_SECRET;

    const { requireAuth } = await import('./auth.js');
    const token = jwt.sign({ id: 3, username: 'hacker' }, 'unknown-secret-min-32-chars-long-here!');
    const req = { headers: { authorization: `Bearer ${token}` } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    requireAuth(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
