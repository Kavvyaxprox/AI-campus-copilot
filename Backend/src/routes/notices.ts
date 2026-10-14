import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/http';
import { requireClaims } from '../middleware/auth';

export const noticesRouter = Router();

/**
 * Active announcements for the caller: institution-wide notices plus the
 * notices published by the caller's own department.
 */
noticesRouter.get(
  '/api/notices',
  asyncHandler(async (req, res) => {
    const claims = requireClaims(req);
    const now = new Date();

    const notices = await prisma.notice.findMany({
      where: {
        AND: [
          {
            OR: [
              { departmentId: null },
              ...(claims.departmentId ? [{ departmentId: { equals: claims.departmentId } }] : []),
            ],
          },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          ...(claims.role === 'STUDENT' && claims.semester
            ? [{ OR: [{ semester: null }, { semester: { equals: claims.semester } }] }]
            : []),
        ],
      },
      include: { department: { select: { code: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      notices: notices.map((notice) => ({
        id: notice.id,
        title: notice.title,
        body: notice.body,
        semester: notice.semester,
        expiresAt: notice.expiresAt,
        createdAt: notice.createdAt,
        scope: notice.department?.code ?? 'Campus-wide',
      })),
    });
  }),
);
