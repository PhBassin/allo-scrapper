import { errorHandler } from '../middleware/error-handler.js';
// IMPORTANT: Set JWT_SECRET BEFORE any imports
// The auth middleware reads process.env.JWT_SECRET at module load time
process.env.JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import * as passwordUtils from '../utils/password.js';
import jwt from 'jsonwebtoken';
import authRouter from './auth.js';
import { db } from '../db/client.js';
import * as queries from '../db/user-queries.js';
import type { AuthRequest } from '../middleware/auth.js';
import { assertChangePasswordRejected } from '../test-utils/auth.js';
import { RefreshTokenService } from '../services/refresh-token-service.js';

async function createMockUser(
  username: string,
  role_id: number,
  role_name: string,
  is_system_role: boolean,
  password: string,
  id = 1
) {
  const mockUser = {
    id,
    username,
    password_hash: await passwordUtils.hashPassword(password),
    role_id,
    role_name,
    is_system_role,
    created_at: new Date().toISOString()
  };
  vi.mocked(queries.getUserByUsername).mockResolvedValue(mockUser);
  return mockUser;
}

const TEST_JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';

vi.mock('../db/client.js', () => ({
    db: {
        query: vi.fn(),
        transaction: vi.fn(),
    },
}));

vi.mock('../db/user-queries.js');

vi.mock('../db/role-queries.js', () => ({
    getPermissionNamesByRoleId: vi.fn().mockResolvedValue(['settings:read', 'reports:list']),
}));

vi.mock('../services/refresh-token-service.js', () => {
    const mockValidate = vi.fn();
    const mockRotate = vi.fn();
    const mockRevoke = vi.fn();
    const mockRevokeAll = vi.fn().mockResolvedValue(undefined);
    const mockGenerate = vi.fn();

    return {
        RefreshTokenService: vi.fn(function() {
            this.validate = mockValidate;
            this.rotate = mockRotate;
            this.revoke = mockRevoke;
            this.revokeAllForUser = mockRevokeAll;
            this.generate = mockGenerate;
        }),
        __mockValidate: mockValidate,
        __mockRotate: mockRotate,
        __mockRevoke: mockRevoke,
        __mockRevokeAll: mockRevokeAll,
        __mockGenerate: mockGenerate,
    };
});

// Mock the auth middleware with proper JWT verification using test secret
vi.mock('../middleware/auth.js', () => ({
    requireAuth: vi.fn((req: AuthRequest, res, next) => {
        const authHeader = req.headers.authorization as string | undefined;
        const cookieToken = req.cookies?.access_token as string | undefined;
        const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
        const token = cookieToken || bearerToken;

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required. No token provided.',
            });
        }

        try {
            const decoded = jwt.verify(token, TEST_JWT_SECRET, { algorithms: ['HS256'] }) as { id: number; username: string };
            req.user = decoded;
            next();
        } catch (error) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired token.',
            });
        }
    }),
    AuthRequest: {} as any,
}));

vi.mock('../middleware/permission.js', () => ({
    requirePermission: (..._perms: string[]) => vi.fn((req: any, res: any, next: any) => next()),
}));

const app = express();
app.use(express.json());
app.use(cookieParser());
app.set('db', db); // Register mock db for dependency injection
app.use('/api/auth', authRouter);
app.use(errorHandler);

describe('Auth Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('POST /api/auth/login', () => {
        it('should return a user and token for valid credentials', async () => {
            const mockUser = await createMockUser('admin', 1, 'admin', true, 'password123');

            const response = await request(app)
                .post('/api/auth/login')
                .send({ username: 'admin', password: 'password123' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.token).toBeDefined();
            expect(response.body.data.user.username).toBe('admin');
            expect(response.body.data.user.password_hash).toBeUndefined(); // Should not expose hash
            // Should set access_token cookie as httpOnly
            const setCookieHeaders = response.headers['set-cookie'];
            expect(setCookieHeaders).toBeDefined();
            const cookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
            const accessTokenCookie = cookies.find((c: string) => c.startsWith('access_token='));
            expect(accessTokenCookie).toBeDefined();
            expect(accessTokenCookie).toContain('HttpOnly');
            expect(accessTokenCookie).toContain('SameSite=Lax');
        });

        it('should return is_system_role in the user object for valid credentials', async () => {
            await createMockUser('admin', 1, 'admin', true, 'password123');

            const response = await request(app)
                .post('/api/auth/login')
                .send({ username: 'admin', password: 'password123' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.user.is_system_role).toBe(true);
        });

        it('should return is_system_role=false for non-system role in the user object', async () => {
            await createMockUser('operator', 2, 'operator', false, 'password123', 2);

            const response = await request(app)
                .post('/api/auth/login')
                .send({ username: 'operator', password: 'password123' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.user.is_system_role).toBe(false);
        });

        it('should return permissions in the user object for valid credentials', async () => {
            await createMockUser('admin', 1, 'admin', true, 'password123');

            const response = await request(app)
                .post('/api/auth/login')
                .send({ username: 'admin', password: 'password123' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.user.permissions).toBeDefined();
            expect(Array.isArray(response.body.data.user.permissions)).toBe(true);
            // Mock getPermissionNamesByRoleId returns ['settings:read', 'reports:list'] (see line 26)
            expect(response.body.data.user.permissions).toEqual(['settings:read', 'reports:list']);
        });

        it('should return 401 for invalid password', async () => {
            await createMockUser('admin', 1, 'admin', true, 'password123');

            const response = await request(app)
                .post('/api/auth/login')
                .send({ username: 'admin', password: 'wrongpassword' });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid credentials');
        });

        it('should execute constant-time comparison for unknown user', async () => {
            vi.mocked(queries.getUserByUsername).mockResolvedValue(undefined);
            const compareSpy = vi.spyOn(passwordUtils, 'comparePassword');

            const response = await request(app)
                .post('/api/auth/login')
                .send({ username: 'unknown', password: 'password123' });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid credentials');

            // Verify that comparePassword was called even though user was not found
            expect(compareSpy).toHaveBeenCalled();
        });

        it('should return 401 for unknown user', async () => {
            vi.mocked(queries.getUserByUsername).mockResolvedValue(undefined);

            const response = await request(app)
                .post('/api/auth/login')
                .send({ username: 'unknown', password: 'password123' });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid credentials');
        });

        it('should return 400 for missing credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ username: 'admin' });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Username and password are required');
        });
    });

    describe('POST /api/auth/change-password', () => {
        const JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';
        let validToken: string;

        beforeEach(() => {
            // Create a valid token for testing
            validToken = jwt.sign(
                { id: 1, username: 'testuser' },
                JWT_SECRET,
                { algorithm: 'HS256', expiresIn: '24h' }
            );
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .post('/api/auth/change-password')
                .send({ currentPassword: 'old', newPassword: 'NewPass123!' });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Authentication required. No token provided.');
        });

        it('should return 400 if currentPassword is missing', async () => {
            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ newPassword: 'NewPass123!' });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Current password and new password are required');
        });

        it('should return 400 if newPassword is missing', async () => {
            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ currentPassword: 'OldPass123!' });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Current password and new password are required');
        });

        it('should return 400 if newPassword is too short', async () => {
            await createMockUser('testuser', 2, 'user', false, 'OldPass123!');
            await assertChangePasswordRejected(app, validToken, 'Short1!', 'Password must be at least 8 characters');
        });

        it('should return 400 if newPassword lacks uppercase', async () => {
            await createMockUser('testuser', 2, 'user', false, 'OldPass123!');
            await assertChangePasswordRejected(app, validToken, 'newpass123!', 'Password must contain at least one uppercase letter');
        });

        it('should return 400 if newPassword lacks lowercase', async () => {
            await createMockUser('testuser', 2, 'user', false, 'OldPass123!');
            await assertChangePasswordRejected(app, validToken, 'NEWPASS123!', 'Password must contain at least one lowercase letter');
        });

        it('should return 400 if newPassword lacks digit', async () => {
            await createMockUser('testuser', 2, 'user', false, 'OldPass123!');
            await assertChangePasswordRejected(app, validToken, 'NewPassword!', 'Password must contain at least one digit');
        });

        it('should return 400 if newPassword lacks special character', async () => {
            await createMockUser('testuser', 2, 'user', false, 'OldPass123!');
            await assertChangePasswordRejected(app, validToken, 'NewPass123', 'Password must contain at least one special character');
        });

        it('should return 401 if currentPassword is incorrect', async () => {
            await createMockUser('testuser', 2, 'user', false, 'OldPass123!');

            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ currentPassword: 'WrongPass123!', newPassword: 'NewPass123!' });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Current password is incorrect');
        });

        it('should change password successfully with valid inputs', async () => {
            await createMockUser('testuser', 2, 'user', false, 'OldPass123!');
            vi.mocked(queries.updateUserPassword).mockResolvedValue(undefined);

            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ currentPassword: 'OldPass123!', newPassword: 'NewPass123!' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.message).toBe('Password changed successfully');
            expect(queries.updateUserPassword).toHaveBeenCalledWith(
                db,
                1,
                expect.any(String) // The new password hash
            );
        });

        it('should hash the new password', async () => {
            await createMockUser('testuser', 2, 'user', false, 'OldPass123!');
            vi.mocked(queries.updateUserPassword).mockResolvedValue(undefined);

            const hashSpy = vi.spyOn(passwordUtils, 'hashPassword');

            await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ currentPassword: 'OldPass123!', newPassword: 'NewPass123!' });

            expect(hashSpy).toHaveBeenCalledWith('NewPass123!');
        });

        it('should not expose password hash in response', async () => {
            await createMockUser('testuser', 2, 'user', false, 'OldPass123!');
            vi.mocked(queries.updateUserPassword).mockResolvedValue(undefined);

            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ currentPassword: 'OldPass123!', newPassword: 'NewPass123!' });

            expect(response.body.data.password_hash).toBeUndefined();
            expect(response.body.data.newPasswordHash).toBeUndefined();
        });

        it('should return 500 on database error', async () => {
            await createMockUser('testuser', 2, 'user', false, 'OldPass123!');
            vi.mocked(queries.updateUserPassword).mockRejectedValue(new Error('Database error'));

            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ currentPassword: 'OldPass123!', newPassword: 'NewPass123!' });

            expect(response.status).toBe(500);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Database error');
        });
    });

    describe('POST /api/auth/refresh', () => {
        it('should return new access token for valid refresh token', async () => {
            const refreshTokenMocks = await import('../services/refresh-token-service.js');
            const mockValidate = (refreshTokenMocks as any).__mockValidate;
            const mockRotate = (refreshTokenMocks as any).__mockRotate;
            const mockGenerate = (refreshTokenMocks as any).__mockGenerate;
            const mockRevoke = (refreshTokenMocks as any).__mockRevoke;

            mockValidate.mockResolvedValue(1);
            mockRotate.mockResolvedValue('new-refresh-token-raw');

            vi.mocked(db.query).mockResolvedValue({
                rows: [{
                    id: 1,
                    username: 'testuser',
                    role_id: 2,
                    role_name: 'user',
                    is_system_role: false,
                }],
            });

            const response = await request(app)
                .post('/api/auth/refresh')
                .set('Cookie', 'refresh_token=valid-old-token');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.token).toBeDefined();
            expect(response.body.data.user.username).toBe('testuser');
            // Should set access_token cookie as httpOnly
            const setCookieHeaders = response.headers['set-cookie'];
            const cookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
            const accessTokenCookie = cookies.find((c: string) => c.startsWith('access_token='));
            expect(accessTokenCookie).toBeDefined();
            expect(accessTokenCookie).toContain('HttpOnly');
            expect(accessTokenCookie).toContain('SameSite=Lax');
            expect(mockRotate).toHaveBeenCalledWith(1, 'valid-old-token');
            expect(mockGenerate).not.toHaveBeenCalled();
            expect(mockRevoke).not.toHaveBeenCalled();
        });

        it('should return 401 if no refresh token cookie', async () => {
            const response = await request(app)
                .post('/api/auth/refresh');

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('No refresh token provided.');
        });

        it('should return 401 if refresh token is invalid', async () => {
            const refreshTokenMocks = await import('../services/refresh-token-service.js');
            const mockValidate = (refreshTokenMocks as any).__mockValidate;

            mockValidate.mockResolvedValue(null);

            const response = await request(app)
                .post('/api/auth/refresh')
                .set('Cookie', 'refresh_token=invalid-token');

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid or expired refresh token.');
        });
    });

    describe('POST /api/auth/logout', () => {
        it('should clear access_token and refresh_token cookies', async () => {
            const refreshTokenMocks = await import('../services/refresh-token-service.js');
            const mockRevoke = (refreshTokenMocks as any).__mockRevoke;
            mockRevoke.mockResolvedValue(undefined);

            const response = await request(app)
                .post('/api/auth/logout')
                .set('Cookie', 'refresh_token=some-token; access_token=some-access-token');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            const setCookieHeaders = response.headers['set-cookie'];
            const cookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];

            const accessTokenClear = cookies.find((c: string) => c.startsWith('access_token=;'));
            expect(accessTokenClear).toBeDefined();

            const refreshTokenClear = cookies.find((c: string) => c.startsWith('refresh_token=;'));
            expect(refreshTokenClear).toBeDefined();

            const csrfTokenClear = cookies.find((c: string) => c.startsWith('csrf_token=;'));
            expect(csrfTokenClear).toBeDefined();
        });

        it('should succeed even without cookies', async () => {
            const response = await request(app)
                .post('/api/auth/logout');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });

    describe('COOKIE_SECURE environment variable', () => {
        it('should set csrf_token with Secure flag by default (when COOKIE_SECURE not false)', async () => {
            // This test verifies the default behavior when COOKIE_SECURE is not explicitly set to 'false'
            const mockUser = await createMockUser('admin', 1, 'admin', true, 'password123');

            const response = await request(app)
                .post('/api/auth/login')
                .send({ username: 'admin', password: 'password123' });

            expect(response.status).toBe(200);
            const setCookieHeaders = response.headers['set-cookie'];
            const cookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];

            const csrfCookie = cookies.find((c: string) => c.startsWith('csrf_token='));
            expect(csrfCookie).toBeDefined();
            
            // If COOKIE_SECURE is not explicitly 'false', Secure flag should be present
            if (process.env.COOKIE_SECURE !== 'false') {
                expect(csrfCookie).toContain('Secure');
            } else {
                expect(csrfCookie).not.toContain('Secure');
            }
        });
    });
});
