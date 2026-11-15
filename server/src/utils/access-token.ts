import type { Request } from 'express';
import type { PermissionName } from '../types/role.js';
import { getSecrets, verifyWithMultipleSecrets } from './jwt-secrets.js';
import { getUserTokenVersion } from '../db/user-queries.js';

/**
 * The claims of an access token. `AuthService.mintAccessToken` is the only
 * issuer, so a token whose signature verifies carries at least these claims
 * (the JWT library adds `iat` and `exp`). That is an assumption about the
 * issuer: the cast in `resolve` is not checked at runtime.
 */
export interface AccessTokenPayload {
    id: number;
    username: string;
    role_name: string;
    is_system_role: boolean;
    permissions: PermissionName[];
    /** The user's token version when the token was minted. */
    ver: number;
}

/** The access token of a request: the SPA's `access_token` cookie first, else a Bearer header. */
export function extractToken(req: Request): string | null {
    if (req.cookies?.access_token) {
        return req.cookies.access_token;
    }
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7).trim();
    }
    return null;
}

async function resolve(req: Request): Promise<AccessTokenPayload | null> {
    const token = extractToken(req);
    if (!token) return null;

    let decoded: AccessTokenPayload;
    try {
        decoded = verifyWithMultipleSecrets(token, getSecrets()) as AccessTokenPayload;
    } catch {
        return null;
    }

    // A password change/reset or a role change bumps the user's token version,
    // so a token minted before is no longer current. Neither is a deleted user's.
    const currentVersion = await getUserTokenVersion(req.app.get('db'), decoded.id);
    if (currentVersion === undefined || decoded.ver !== currentVersion) return null;
    return decoded;
}

const resolved = new WeakMap<Request, Promise<AccessTokenPayload | null>>();

/**
 * The payload of the request's access token, or null when there is no token,
 * its signature or expiry is invalid, or its `ver` claim is no longer current.
 * Rejects only when the token-version lookup fails.
 *
 * Resolved once per request: the rate-limit key generator and requireAuth
 * share one JWT verification and one database lookup.
 */
export function resolveAccessToken(req: Request): Promise<AccessTokenPayload | null> {
    let pending = resolved.get(req);
    if (!pending) {
        pending = resolve(req);
        resolved.set(req, pending);
    }
    return pending;
}
