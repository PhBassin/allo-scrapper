/**
 * Authentication middleware for superadmin routes.
 * Verifies JWT token contains scope='superadmin'.
 */
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface SuperadminPayload {
  id: string;
  username: string;
  scope: string;
}

declare global {
  namespace Express {
    interface Request {
      superadmin?: {
        id: string;
        username: string;
      };
    }
  }
}

/**
 * Middleware to protect superadmin-only routes.
 * Validates Bearer token and checks for scope='superadmin'.
 */
export async function requireSuperadmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_REQUIRED',
      });
      return;
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    let decoded: SuperadminPayload;
    try {
      decoded = jwt.verify(token, secret) as SuperadminPayload;
    } catch (error) {
      res.status(401).json({
        success: false,
        error: 'INVALID_TOKEN',
      });
      return;
    }

    // Check scope is 'superadmin'
    if (decoded.scope !== 'superadmin') {
      res.status(403).json({
        success: false,
        error: 'INSUFFICIENT_PRIVILEGES',
      });
      return;
    }

    // Attach superadmin info to request
    req.superadmin = {
      id: decoded.id,
      username: decoded.username,
    };

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
    });
  }
}
