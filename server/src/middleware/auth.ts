import { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '../types/api.js';
import { getSecrets } from '../utils/jwt-secrets.js';
import { extractToken, resolveAccessToken, type AccessTokenPayload } from '../utils/access-token.js';

// Fail-fast: validate secrets at module load
getSecrets();

export interface AuthRequest extends Request {
    /** The claims of the verified access token. Handlers have no use for `ver`: `requireAuth` checked it. */
    user?: Omit<AccessTokenPayload, 'ver'>;
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

    let decoded: AccessTokenPayload | null;
    try {
        decoded = await resolveAccessToken(req);
    } catch (error) {
        return next(error);
    }
    if (!decoded) {
        return res.status(401).json(invalidToken);
    }

    req.user = decoded;
    next();
};
