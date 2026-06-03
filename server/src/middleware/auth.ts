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
        return authHeader.substring(7);
    }
    return null;
}

/**
 * Check if the given user object represents a system administrator.
 *
 * A user is considered admin when:
 * - role_name === 'admin' (string comparison against the role name — prefers
 *   future migration to role ID for immutability)
 * - is_system_role === true (prevents privilege escalation by users who
 *   name their custom role 'admin')
 *
 * This is the single source of truth for admin bypass logic used by
 * requirePermission middleware and any route that performs inline
 * admin checks.
 */
export function isAdminUser(
  user: AuthRequest['user'] | null | undefined,
): boolean {
  return user?.role_name === 'admin' && user?.is_system_role === true;
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
