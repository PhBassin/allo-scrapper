import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { ApiResponse } from '../types/api.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';

export interface AuthRequest extends Request {
    user?: {
        id: number;
        username: string;
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
        const decoded = jwt.verify(token, JWT_SECRET) as { id: number; username: string };
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
