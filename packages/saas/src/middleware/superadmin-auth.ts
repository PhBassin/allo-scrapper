import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

export interface SuperadminPayload {
  id: number;
  username: string;
  scope: string;
}

// Augment Express Request to carry the verified superadmin payload
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      superadmin?: SuperadminPayload;
    }
  }
}

/**
 * Express middleware that validates a superadmin JWT.
 *
 * - Reads Bearer token from Authorization header
 * - Verifies signature with SUPERADMIN_JWT_SECRET
 * - Rejects tokens whose scope !== 'superadmin' with 403
 * - Attaches verified payload to req.superadmin
 */
export async function requireSuperadmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization ?? '';
  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    res.status(401).json({ success: false, error: 'Missing or malformed Authorization header' });
    return;
  }

  const token = parts[1];
  const secret = process.env.SUPERADMIN_JWT_SECRET?.trim();

  if (!secret || secret.length < 32) {
    res.status(500).json({ success: false, error: 'Server misconfiguration: missing SUPERADMIN_JWT_SECRET' });
    return;
  }

  let payload: SuperadminPayload;
  try {
    payload = jwt.verify(token, secret) as SuperadminPayload;
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
    return;
  }

  if (payload.scope !== 'superadmin') {
    res.status(403).json({ success: false, error: 'Token scope is not superadmin' });
    return;
  }

  req.superadmin = payload;
  next();
}
