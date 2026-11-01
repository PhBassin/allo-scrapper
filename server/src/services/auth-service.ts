import jwt from 'jsonwebtoken';
import { getUserByUsername, createUser, updateUserPassword } from '../db/user-queries.js';
import { getPermissionNamesByRoleId } from '../db/role-queries.js';
import type { DB } from '../db/index.js';
import { validatePasswordStrength } from '../utils/security.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { logger } from '../utils/logger.js';
import { getJwtExpiresIn, parseJwtExpiration } from '../utils/jwt-config.js';
import type { PermissionName } from '../types/role.js';
import { getCurrentSecret } from '../utils/jwt-secrets.js';
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
}

/**
 * The public user view returned in login/refresh responses: the access-token
 * subject plus its resolved permissions. Built in one place (`toSessionUser`)
 * so every response that shows a user agrees on the shape.
 */
export interface SessionUser extends AccessTokenSubject {
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
   * Mint an HS256 access token for `user`. The canonical payload shape
   * ({ id, username, role_name, is_system_role, permissions }) lives here
   * — every code path that issues an access token MUST go through this
   * method so the claim set stays in lockstep.
   *
   * @param user - Subject of the token. `db` is passed explicitly so the
   *               refresh route can mint against the same DB handle it
   *               already loaded the user from, without re-deriving it
   *               from the service's constructor-injected DB.
   */
  async mintAccessToken(user: AccessTokenSubject, db: DB): Promise<string> {
    const permissions = (await getPermissionNamesByRoleId(db, user.role_id)) as PermissionName[];

    const secret = getCurrentSecret();

    const expiresIn = parseJwtExpiration(getJwtExpiresIn());

    return jwt.sign(
      {
        id: user.id,
        username: user.username,
        role_name: user.role_name,
        is_system_role: user.is_system_role,
        permissions,
      },
      secret,
      { algorithm: 'HS256', expiresIn: expiresIn as any }
    );
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

  async register(username?: string, password?: string) {
    if (!username || !password) {
      throw new ValidationError('Username and password are required');
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      throw new ValidationError(passwordError);
    }

    const existingUser = await getUserByUsername(this.db, username);
    if (existingUser) {
      throw new ValidationError('Username already exists');
    }

    const passwordHash = await hashPassword(password);

    const user = await createUser(this.db, username, passwordHash);

    return {
      id: user.id,
      username: user.username,
      role_id: user.role_id,
      role_name: user.role_name,
    };
  }

  async changePassword(currentUsername: string, currentPassword?: string, newPassword?: string) {
    if (!currentPassword || !newPassword) {
      throw new ValidationError('Current password and new password are required');
    }

    const passwordError = validatePasswordStrength(newPassword);
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

    await updateUserPassword(this.db, user.id, newPasswordHash);
    logger.info(`Password changed for user: ${user.username}`);
  }
}
