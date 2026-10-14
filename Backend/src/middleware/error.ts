import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ApiError } from '../lib/http';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ApiError) {
    res.status(error.status).json({ error: error.message, details: error.details });
    return;
  }

  const bodyError = error as { type?: string };
  if (bodyError.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Request body is not valid JSON.' });
    return;
  }

  const multerError = error as { name?: string; message?: string };
  if (multerError.name === 'MulterError') {
    res.status(400).json({ error: `Upload failed: ${multerError.message}` });
    return;
  }

  const prismaError = error as { code?: string };
  if (prismaError.code === 'P2002') {
    res.status(409).json({ error: 'A record with the same unique value already exists.' });
    return;
  }

  console.error('[api] unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
};
