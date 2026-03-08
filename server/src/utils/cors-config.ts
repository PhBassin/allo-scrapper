import { CorsOptions } from 'cors';

export const getCorsOptions = (): CorsOptions => {
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
  const allowedOrigins = allowedOriginsEnv
    ? allowedOriginsEnv.split(',').map((origin) => origin.trim())
    : ['http://localhost:5173']; // Default to Vite dev server

  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like mobile apps or curl requests)
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
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
};
