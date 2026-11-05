import { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '../types/api.js';
import type { PermissionName } from '../types/role.js';
import { getSecrets, verifyWithMultipleSecrets } from '../utils/jwt-secrets.js';
import { getUserTokenVersion } from '../db/user-queries.js';

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
        return authHeader.substring(7).trim();
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

/**
 * Verify the access token, then check that its `ver` claim still matches the
 * user's token version: a password change/reset or a role change bumps it,
 * so a token minted before is rejected at once (the client refreshes, or
 * re-logs in if its sessions were revoked). A deleted user is rejected too.
 */
export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response> => {
    const token = extractToken(req);

    if (!token) {
        const response: ApiResponse = {
            success: false,
            error: 'Authentication required. No token provided.',
        };
        return res.status(401).json(response);
    }

    const invalidToken: ApiResponse = {
        success: false,
        error: 'Invalid or expired token.',
    };

    let decoded: NonNullable<AuthRequest['user']> & { ver?: unknown };
    try {
        decoded = verifyWithMultipleSecrets(token, getSecrets()) as typeof decoded;
    } catch {
        return res.status(401).json(invalidToken);
    }

    try {
        const currentVersion = await getUserTokenVersion(req.app.get('db'), decoded.id);
        if (currentVersion === undefined || decoded.ver !== currentVersion) {
            return res.status(401).json(invalidToken);
        }
    } catch (error) {
        return next(error);
    }

    req.user = decoded;
    next();
};
