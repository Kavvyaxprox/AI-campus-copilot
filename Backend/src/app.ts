import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { authenticate } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error';
import { authRouter } from './routes/auth';
import { chatRouter } from './routes/chat';
import { documentsRouter } from './routes/documents';
import { metaRouter } from './routes/meta';
import { noticesRouter } from './routes/notices';
import { reportsRouter } from './routes/reports';

// localhost, 127.0.0.1 and [::1] on any port, so the dev server, preview
// server and LAN demos all work without editing configuration.
const LOOPBACK_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

const configuredOrigins = env.corsOrigin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function isOriginAllowed(origin: string | undefined): boolean {
  // Non browser clients (curl, server to server) send no Origin header.
  if (!origin) return true;
  if (env.corsOrigin === '*') return true;
  if (configuredOrigins.includes(origin)) return true;
  if (LOOPBACK_ORIGIN.test(origin)) return true;
  // Development only: Vite may run on any host or port.
  return env.nodeEnv !== 'production';
}

export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    cors({
      origin: (origin, callback) => callback(null, isOriginAllowed(origin)),
      credentials: false,
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use('/uploads', express.static(env.uploadsDir, { fallthrough: true }));

  // Public
  app.use(metaRouter);
  app.use(authRouter);

  // Authenticated
  app.use(authenticate, noticesRouter);
  app.use(authenticate, documentsRouter);
  app.use(authenticate, chatRouter);
  app.use(authenticate, reportsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
