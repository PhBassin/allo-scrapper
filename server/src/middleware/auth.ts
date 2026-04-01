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
        /** Present in SaaS mode JWTs — undefined in standalone mode */
        org_id?: string;
        /** Present in SaaS mode JWTs — undefined in standalone mode */
        org_slug?: string;
    };
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction): void | Response => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const response: ApiResponse = {
            success: false,
            error: 'Authentication required. No token provided.',
        };
        return res.status(401).json(response);
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as {
            id: number;
            username: string;
            role_name: string;
            is_system_role?: boolean;
            permissions: PermissionName[];
            org_id?: string;
            org_slug?: string;
        };
        req.user = {
            id: decoded.id,
            username: decoded.username,
            role_name: decoded.role_name,
            is_system_role: decoded.is_system_role ?? false,
            permissions: decoded.permissions ?? [],
            // SaaS fields — only set when present in the token
            ...(decoded.org_id !== undefined && { org_id: decoded.org_id }),
            ...(decoded.org_slug !== undefined && { org_slug: decoded.org_slug }),
        };
        next();
    } catch (error) {
        const response: ApiResponse = {
            success: false,
            error: 'Invalid or expired token.',
        };
        return res.status(401).json(response);
    }
};
