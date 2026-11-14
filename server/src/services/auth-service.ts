import jwt from 'jsonwebtoken';
import { getUserByUsername, updateUserPassword } from '../db/user-queries.js';
import { getPermissionNamesByRoleId } from '../db/role-queries.js';
import type { DB } from '../db/index.js';
import { validatePasswordStrength } from '../utils/security.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { logger } from '../utils/logger.js';
import { getJwtSignExpiresIn } from '../utils/jwt-config.js';
import type { PermissionName } from '../types/role.js';
import { getCurrentSecret } from '../utils/jwt-secrets.js';
import type { AccessTokenPayload } from '../utils/access-token.js';
import { revokeAllUserTokens } from '../repositories/refresh-token-repository.js';
import { ValidationError, AuthError, NotFoundError } from '../utils/errors.js';

// Pre-computed hash for 'dummy' (cost 10) to prevent timing attacks
const DUMMY_HASH = 'scrypt:16384:8:1:00000000000000000000000000000000:00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

/**
 * Minimum user shape required to mint an access token. Both UserRow and
 * UserWithRoleRow extend this — callers pass whichever they already hold.
 */
export interface AccessTokenSubject {
  id: number;
  username: string;
  role_id: number;
  role_name: string;
  is_system_role: boolean;
  /** Credential version the token is bound to (`ver` claim, see `requireAuth`). */
  token_version: number;
}

/**
 * The public user view returned in login/refresh responses: the access-token
 * subject plus its resolved permissions. Built in one place (`toSessionUser`)
 * so every response that shows a user agrees on the shape.
 */
export interface SessionUser extends Omit<AccessTokenSubject, 'token_version'> {
  permissions: PermissionName[];
}

/**
 * The login/refresh response payload: a fresh access token and the public
 * user view. Emitted by `AuthService.login` and `SessionService.refresh`.
 */
export interface AuthResponse {
  token: string;
  user: SessionUser;
}

/** Build the canonical public user view from an access-token subject. */
export function toSessionUser(
  subject: AccessTokenSubject,
  permissions: PermissionName[],
): SessionUser {
  return {
    id: subject.id,
    username: subject.username,
    role_id: subject.role_id,
    role_name: subject.role_name,
    is_system_role: subject.is_system_role,
    permissions,
  };
}

export class AuthService {
  constructor(private db: DB) {}

  /**
   * Mint an HS256 access token for `user`. Its payload is the canonical
   * `AccessTokenPayload` — every code path that issues an access token MUST
   * go through this method so the claim set stays in lockstep.
   *
   * @param user - Subject of the token. `db` is passed explicitly so the
   *               refresh route can mint against the same DB handle it
   *               already loaded the user from, without re-deriving it
   *               from the service's constructor-injected DB.
   */
  async mintAccessToken(user: AccessTokenSubject, db: DB): Promise<string> {
    const permissions = (await getPermissionNamesByRoleId(db, user.role_id)) as PermissionName[];

    const secret = getCurrentSecret();

    const expiresIn = getJwtSignExpiresIn();

    const payload: AccessTokenPayload = {
      id: user.id,
      username: user.username,
      role_name: user.role_name,
      is_system_role: user.is_system_role,
      permissions,
      ver: user.token_version,
    };

    return jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: expiresIn as any });
  }

  async login(username?: string, password?: string): Promise<AuthResponse> {
    if (!username || !password) {
      throw new ValidationError('Username and password are required');
    }

    const user = await getUserByUsername(this.db, username);
    const hashToCompare = user ? user.password_hash : DUMMY_HASH;
    const isMatch = await comparePassword(password, hashToCompare);

    if (!user || !isMatch) {
      throw new AuthError('Invalid credentials');
    }

    const token = await this.mintAccessToken(user, this.db);
    const permissions = (await getPermissionNamesByRoleId(
      this.db,
      user.role_id,
    )) as PermissionName[];

    return { token, user: toSessionUser(user, permissions) };
  }

  async changePassword(currentUsername: string, currentPassword?: string, newPassword?: string) {
    if (!currentPassword || !newPassword) {
      throw new ValidationError('Current password and new password are required');
    }

    const passwordError = validatePasswordStrength(newPassword, currentUsername);
    if (passwordError) {
      throw new ValidationError(passwordError);
    }

    const user = await getUserByUsername(this.db, currentUsername);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isMatch = await comparePassword(currentPassword, user.password_hash);
    if (!isMatch) {
      throw new AuthError('Current password is incorrect');
    }

    const newPasswordHash = await hashPassword(newPassword);

    // Every Session dies with the old password, atomically with the change.
    await this.db.transaction(async (tx) => {
      await updateUserPassword(tx, user.id, newPasswordHash);
      await revokeAllUserTokens(tx, user.id);
    });
    logger.info(`Password changed for user: ${user.username}`);
  }
}
