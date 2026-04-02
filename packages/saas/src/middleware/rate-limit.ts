import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for public onboarding routes (email verification, invitation accept).
 * These routes do lightweight token-based "authorization" and are exposed publicly,
 * so we restrict to 10 attempts per IP per 15 minutes to prevent token brute-forcing.
 */
export const onboardingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !req.ip, // skip in test environments where ip may be undefined
  message: { success: false, error: 'Too many requests, please try again later' },
});

/**
 * Rate limiter for the superadmin login route.
 * Tight limit to slow down brute-force attacks against the superadmin credential endpoint.
 */
export const superadminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !req.ip, // skip in test environments where ip may be undefined
  message: { success: false, error: 'Too many login attempts, please try again later' },
});

/**
 * Rate limiter for superadmin protected routes.
 * Generous limit since these are authenticated calls, but still bounded to
 * prevent abuse if a superadmin token is compromised.
 */
export const superadminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !req.ip, // skip in test environments where ip may be undefined
  message: { success: false, error: 'Too many requests, please try again later' },
});
