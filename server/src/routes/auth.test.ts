import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import authRouter from './auth.js';
import { db } from '../db/client.js';
import * as queries from '../db/queries.js';
import bcrypt from 'bcryptjs';

vi.mock('../db/client.js', () => ({
    db: {
        query: vi.fn(),
    },
}));

vi.mock('../db/queries.js');

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

describe('Auth Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';
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
});
