import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { ApiResponse } from '../types/api.js';
import type { PermissionName } from '../types/role.js';
import { validateJWTSecret } from '../utils/jwt-secret-validator.js';

const JWT_SECRET = validateJWTSecret();

export interface AuthRequest extends Request {
    user?: {
        id: number;
        username: string;
        role_name: string;
        is_system_role: boolean;
        permissions: PermissionName[];
    };
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction): void | Response => {
    // 1. Try Authorization header first (Bearer token)
    let token: string | null = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }

    // 2. Fallback: cookie-based access token
    if (!token && req.cookies?.auth_token) {
        token = req.cookies.auth_token;
    }

    if (!token) {
        const response: ApiResponse = {
            success: false,
            error: 'Authentication required. No token provided.',
        };
        return res.status(401).json(response);
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as {
            id: number;
            username: string;
            role_name: string;
            is_system_role: boolean;
            permissions: PermissionName[];
        };
        req.user = decoded;
        next();
    } catch (error) {
        const response: ApiResponse = {
            success: false,
            error: 'Invalid or expired token.',
        };
        return res.status(401).json(response);
    }
};
