// IMPORTANT: Set JWT_SECRET BEFORE any imports
// The auth middleware reads process.env.JWT_SECRET at module load time
process.env.JWT_SECRET = 'test-secret';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import authRouter from './auth.js';
import { db } from '../db/client.js';
import * as queries from '../db/queries.js';
import type { AuthRequest } from '../middleware/auth.js';

const TEST_JWT_SECRET = 'test-secret';

vi.mock('../db/client.js', () => ({
    db: {
        query: vi.fn(),
    },
}));

vi.mock('../db/queries.js');

// Mock the auth middleware with proper JWT verification using test secret
vi.mock('../middleware/auth.js', () => ({
    requireAuth: vi.fn((req: AuthRequest, res, next) => {
        const authHeader = req.headers.authorization as string | undefined;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required. No token provided.',
            });
        }

        const token = authHeader.split(' ')[1];

        try {
            const decoded = jwt.verify(token, 'test-secret') as { id: number; username: string };
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

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

describe('Auth Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('POST /api/auth/login', () => {
        it('should return a user and token for valid credentials', async () => {
            const mockUser = {
                id: 1,
                username: 'admin',
                password_hash: await bcrypt.hash('password123', 10),
                created_at: new Date().toISOString()
            };
            vi.mocked(queries.getUserByUsername).mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/api/auth/login')
                .send({ username: 'admin', password: 'password123' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.token).toBeDefined();
            expect(response.body.data.user.username).toBe('admin');
            expect(response.body.data.user.password_hash).toBeUndefined(); // Should not expose hash
        });

        it('should return 401 for invalid password', async () => {
            const mockUser = {
                id: 1,
                username: 'admin',
                password_hash: await bcrypt.hash('password123', 10),
                created_at: new Date().toISOString()
            };
            vi.mocked(queries.getUserByUsername).mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/api/auth/login')
                .send({ username: 'admin', password: 'wrongpassword' });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid credentials');
        });

        it('should execute constant-time comparison for unknown user', async () => {
            vi.mocked(queries.getUserByUsername).mockResolvedValue(undefined);
            const compareSpy = vi.spyOn(bcrypt, 'compare');

            const response = await request(app)
                .post('/api/auth/login')
                .send({ username: 'unknown', password: 'password123' });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid credentials');

            // Verify that bcrypt.compare was called even though user was not found
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
        const JWT_SECRET = 'test-secret';
        let validToken: string;

        beforeEach(() => {
            // Create a valid token for testing
            validToken = jwt.sign(
                { id: 1, username: 'testuser' },
                JWT_SECRET,
                { expiresIn: '24h' }
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
            const mockUser = {
                id: 1,
                username: 'testuser',
                password_hash: await bcrypt.hash('OldPass123!', 10),
                created_at: new Date().toISOString()
            };
            vi.mocked(queries.getUserByUsername).mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ currentPassword: 'OldPass123!', newPassword: 'Short1!' });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Password must be at least 8 characters');
        });

        it('should return 400 if newPassword lacks uppercase', async () => {
            const mockUser = {
                id: 1,
                username: 'testuser',
                password_hash: await bcrypt.hash('OldPass123!', 10),
                created_at: new Date().toISOString()
            };
            vi.mocked(queries.getUserByUsername).mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ currentPassword: 'OldPass123!', newPassword: 'newpass123!' });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Password must be at least 8 characters');
        });

        it('should return 400 if newPassword lacks lowercase', async () => {
            const mockUser = {
                id: 1,
                username: 'testuser',
                password_hash: await bcrypt.hash('OldPass123!', 10),
                created_at: new Date().toISOString()
            };
            vi.mocked(queries.getUserByUsername).mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ currentPassword: 'OldPass123!', newPassword: 'NEWPASS123!' });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Password must be at least 8 characters');
        });

        it('should return 400 if newPassword lacks digit', async () => {
            const mockUser = {
                id: 1,
                username: 'testuser',
                password_hash: await bcrypt.hash('OldPass123!', 10),
                created_at: new Date().toISOString()
            };
            vi.mocked(queries.getUserByUsername).mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ currentPassword: 'OldPass123!', newPassword: 'NewPassword!' });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Password must be at least 8 characters');
        });

        it('should return 400 if newPassword lacks special character', async () => {
            const mockUser = {
                id: 1,
                username: 'testuser',
                password_hash: await bcrypt.hash('OldPass123!', 10),
                created_at: new Date().toISOString()
            };
            vi.mocked(queries.getUserByUsername).mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ currentPassword: 'OldPass123!', newPassword: 'NewPass123' });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Password must be at least 8 characters');
        });

        it('should return 401 if currentPassword is incorrect', async () => {
            const mockUser = {
                id: 1,
                username: 'testuser',
                password_hash: await bcrypt.hash('OldPass123!', 10),
                created_at: new Date().toISOString()
            };
            vi.mocked(queries.getUserByUsername).mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ currentPassword: 'WrongPass123!', newPassword: 'NewPass123!' });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Current password is incorrect');
        });

        it('should change password successfully with valid inputs', async () => {
            const mockUser = {
                id: 1,
                username: 'testuser',
                password_hash: await bcrypt.hash('OldPass123!', 10),
                created_at: new Date().toISOString()
            };
            vi.mocked(queries.getUserByUsername).mockResolvedValue(mockUser);
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

        it('should hash the new password with bcrypt', async () => {
            const mockUser = {
                id: 1,
                username: 'testuser',
                password_hash: await bcrypt.hash('OldPass123!', 10),
                created_at: new Date().toISOString()
            };
            vi.mocked(queries.getUserByUsername).mockResolvedValue(mockUser);
            vi.mocked(queries.updateUserPassword).mockResolvedValue(undefined);

            const bcryptHashSpy = vi.spyOn(bcrypt, 'hash');

            await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ currentPassword: 'OldPass123!', newPassword: 'NewPass123!' });

            // bcrypt.hash can be called with (password, saltRounds) or (password, salt)
            // Our implementation uses genSalt first, so the second arg is a salt string
            expect(bcryptHashSpy).toHaveBeenCalledWith(
                'NewPass123!',
                expect.stringMatching(/^\$2[aby]\$\d+\$/) // bcrypt salt format
            );
        });

        it('should not expose password hash in response', async () => {
            const mockUser = {
                id: 1,
                username: 'testuser',
                password_hash: await bcrypt.hash('OldPass123!', 10),
                created_at: new Date().toISOString()
            };
            vi.mocked(queries.getUserByUsername).mockResolvedValue(mockUser);
            vi.mocked(queries.updateUserPassword).mockResolvedValue(undefined);

            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ currentPassword: 'OldPass123!', newPassword: 'NewPass123!' });

            expect(response.body.data.password_hash).toBeUndefined();
            expect(response.body.data.newPasswordHash).toBeUndefined();
        });

        it('should return 500 on database error', async () => {
            const mockUser = {
                id: 1,
                username: 'testuser',
                password_hash: await bcrypt.hash('OldPass123!', 10),
                created_at: new Date().toISOString()
            };
            vi.mocked(queries.getUserByUsername).mockResolvedValue(mockUser);
            vi.mocked(queries.updateUserPassword).mockRejectedValue(new Error('Database error'));

            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ currentPassword: 'OldPass123!', newPassword: 'NewPass123!' });

            expect(response.status).toBe(500);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Failed to change password');
        });
    });
});
