import { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '../types/api.js';
import type { PermissionName } from '../types/role.js';
import { getSecrets, verifyWithMultipleSecrets } from '../utils/jwt-secrets.js';

// Fail-fast: validate secrets at module load
getSecrets();

export interface AuthRequest extends Request {
    user?: {
        id: number;
        username: string;
        role_name: string;
        is_system_role: boolean;
        permissions: PermissionName[];
    };
}

function extractToken(req: AuthRequest): string | null {
    if (req.cookies?.access_token) {
        return req.cookies.access_token;
    }
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.split(' ')[1];
    }
    return null;
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction): void | Response => {
    const token = extractToken(req);

    if (!token) {
        const response: ApiResponse = {
            success: false,
            error: 'Authentication required. No token provided.',
        };
        return res.status(401).json(response);
    }

    try {
        const decoded = verifyWithMultipleSecrets(token, getSecrets()) as {
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
