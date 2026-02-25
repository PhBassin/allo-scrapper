import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/client.js';
import { getUserByUsername, createUser } from '../db/queries.js';
import type { ApiResponse } from '../types/api.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';
const JWT_EXPIRES_IN = '24h';

export interface AuthResponse {
    token: string;
    user: {
        id: number;
        username: string;
    };
}

// POST /api/auth/login - Login user
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            const response: ApiResponse = {
                success: false,
                error: 'Username and password are required',
            };
            return res.status(400).json(response);
        }

        const user = await getUserByUsername(db, username);

        if (!user) {
            const response: ApiResponse = {
                success: false,
                error: 'Invalid credentials',
            };
            return res.status(401).json(response);
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            const response: ApiResponse = {
                success: false,
                error: 'Invalid credentials',
            };
            return res.status(401).json(response);
        }

        const token = jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        const response: ApiResponse<AuthResponse> = {
            success: true,
            data: {
                token,
                user: {
                    id: user.id,
                    username: user.username
                }
            }
        };

        return res.json(response);
    } catch (error) {
        logger.error('Login error:', error);
        const response: ApiResponse = {
            success: false,
            error: 'Authentication failed',
        };
        return res.status(500).json(response);
    }
});

// POST /api/auth/register - Register a new user (can be disabled or protected later)
router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            const response: ApiResponse = {
                success: false,
                error: 'Username and password are required',
            };
            return res.status(400).json(response);
        }

        const existingUser = await getUserByUsername(db, username);
        if (existingUser) {
            const response: ApiResponse = {
                success: false,
                error: 'Username already exists',
            };
            return res.status(409).json(response);
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const user = await createUser(db, username, passwordHash);

        const response: ApiResponse = {
            success: true,
            data: {
                message: 'User registered successfully',
                user: {
                    id: user.id,
                    username: user.username
                }
            }
        };

        return res.status(201).json(response);
    } catch (error) {
        logger.error('Registration error:', error);
        const response: ApiResponse = {
            success: false,
            error: 'Registration failed',
        };
        return res.status(500).json(response);
    }
});

export default router;
