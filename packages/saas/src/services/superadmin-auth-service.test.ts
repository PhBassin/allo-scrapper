import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SuperadminAuthService } from './superadmin-auth-service.js';
import type { DB } from '../db/types.js';
import jwt from 'jsonwebtoken';

import bcrypt from 'bcryptjs';

const { mockCompare, mockHash } = vi.hoisted(() => ({
  mockCompare: vi.fn(),
  mockHash: vi.fn(),
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: mockCompare,
    hash: mockHash,
  },
}));

describe('SuperadminAuthService', () => {
  let service: SuperadminAuthService;
  let mockDb: DB;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    } as unknown as DB;
    service = new SuperadminAuthService(mockDb);
    process.env.JWT_SECRET = 'test-secret-minimum-32-chars-required-for-validation-superadmin';
  });

  describe('login', () => {
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
      mockCompare.mockResolvedValue(true);

      const result = await service.login('superadmin', 'superpass123');

      expect(result).toBeDefined();
      expect(result?.token).toBeDefined();
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT id, username, password_hash FROM superadmins WHERE username = $1',
        ['superadmin']
      );
    });

    it('should return null for invalid username', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await service.login('unknown', 'password');

      expect(result).toBeNull();
    });

    it('should return null for invalid password', async () => {
      const hashedPassword = 'hashed_correctpass';
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [{
          id: 'super-1',
          username: 'superadmin',
          password_hash: hashedPassword,
        }],
        rowCount: 1,
      });
      mockCompare.mockResolvedValue(false);

      const result = await service.login('superadmin', 'wrongpass');

      expect(result).toBeNull();
    });
  });

  describe('mintSuperadminJwt', () => {
    it('should create JWT with scope=superadmin', () => {
      const token = service.mintSuperadminJwt('super-1', 'superadmin');

      expect(token).toBeDefined();
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      expect(decoded.id).toBe('super-1');
      expect(decoded.username).toBe('superadmin');
      expect(decoded.scope).toBe('superadmin');
    });

    it('should create token with 24h expiry', () => {
      const token = service.mintSuperadminJwt('super-1', 'superadmin');

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      const now = Math.floor(Date.now() / 1000);
      const expectedExp = now + 24 * 60 * 60;
      
      // Allow 5 second tolerance
      expect(decoded.exp).toBeGreaterThan(now);
      expect(decoded.exp).toBeLessThanOrEqual(expectedExp + 5);
    });
  });
});
