import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/http';

export const metaRouter = Router();

metaRouter.get(
  '/api/departments',
  asyncHandler(async (_req, res) => {
    const departments = await prisma.department.findMany({ orderBy: { code: 'asc' } });
    res.json({ departments });
  }),
);

metaRouter.get(
  '/api/health',
  asyncHandler(async (_req, res) => {
    res.json({ status: 'ok', service: 'ai-campus-copilot-api', time: new Date().toISOString() });
  }),
);
