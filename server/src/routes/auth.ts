import express, { Request, Response, NextFunction } from 'express';
import { authLimiter } from '../middleware/rate-limit.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { SessionService } from '../services/session-service.js';

const router = express.Router();

// POST /api/auth/login - Login user
router.post('/login', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const session = new SessionService(req.app.get('db'), res);
        await session.login(req.body.username, req.body.password);
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/change-password - Change user password (protected)
router.post('/change-password', authLimiter, requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const session = new SessionService(req.app.get('db'), res);
        await session.changePassword(
            req.user!.id,
            req.user!.username,
            req.body.currentPassword,
            req.body.newPassword,
        );
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/refresh - Refresh access token using refresh token cookie
router.post('/refresh', authLimiter, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const session = new SessionService(req.app.get('db'), res);
        await session.refresh(req.cookies?.refresh_token);
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/logout - Logout and revoke refresh token
router.post('/logout', async (req: Request, res: Response) => {
    const session = new SessionService(req.app.get('db'), res);
    await session.logout(req.cookies?.refresh_token);
});

// GET /api/auth/me - Validate current session (cookie-based)
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
    res.json({
        success: true,
        data: {
            user: {
                id: req.user!.id,
                username: req.user!.username,
            },
        },
    });
});

export default router;
