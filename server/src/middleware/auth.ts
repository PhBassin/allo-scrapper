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
        /** Present in SaaS org-scoped JWTs; absent in standalone tokens */
        org_id?: number;
        /** Present in SaaS org-scoped JWTs; absent in standalone tokens */
        org_slug?: string;
    };
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction): void | Response => {
    // Prefer httpOnly cookie (XSS-resistant), fall back to Authorization header
    let token = req.cookies?.auth_token ?? null;

    if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
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
            org_id?: number;
            org_slug?: string;
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

export const optionalAuth = (req: AuthRequest, _res: Response, next: NextFunction): void => {
    // Prefer httpOnly cookie, fall back to Authorization header
    let token = req.cookies?.auth_token ?? null;

    if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
    }

    if (!token) {
        next();
        return;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as {
            id: number;
            username: string;
            role_name: string;
            is_system_role: boolean;
            permissions: PermissionName[];
            org_id?: number;
            org_slug?: string;
        };
        req.user = decoded;
    } catch {
        // Public routes under tenant scope must remain accessible even when a client
        // sends a stale or invalid bearer token; protected routes still enforce auth later.
    }

    next();
};
