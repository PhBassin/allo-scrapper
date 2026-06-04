import { CorsOptions } from 'cors';

export interface CorsConfigOptions {
  strict?: boolean;
}

export const getCorsOptions = (opts: CorsConfigOptions = {}): CorsOptions => {
  const { strict = false } = opts;
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
  const allowedOrigins = allowedOriginsEnv
    ? allowedOriginsEnv.split(',').map((origin) => origin.trim())
    : ['http://localhost:5173']; // Default to Vite dev server

  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Strict mode: block requests with no origin (prevents sandboxed iframe attacks)
      if (strict && (!origin || origin === 'null')) {
        return callback(
          new Error(
            `CORS blocked request with no or null origin in strict mode. ` +
            `Requests to this endpoint must include a valid Origin header.`
          )
        );
      }

      // Lenient mode: allow requests with no origin (mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      } else {
        return callback(
          new Error(
            `CORS blocked request from origin '${origin}'. ` +
            `Add this origin to ALLOWED_ORIGINS in your .env file. ` +
            `Current ALLOWED_ORIGINS: ${allowedOrigins.join(',')}. ` +
            `See docs/guides/deployment/networking.md for details.`
          )
        );
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  };
};
