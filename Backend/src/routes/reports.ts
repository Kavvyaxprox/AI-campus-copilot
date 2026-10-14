import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { writeAudit } from '../lib/audit';
import { asyncHandler, badRequest, forbidden, notFound } from '../lib/http';
import { requireClaims, requireRole } from '../middleware/auth';

export const reportsRouter = Router();

const REPORT_REASONS = [
  'Incorrect information',
  'Outdated information',
  'Answer not supported by the cited source',
  'Wrong department or semester scope',
  'Other',
] as const;

/** Students flag an inaccurate or outdated copilot answer. */
reportsRouter.post(
  '/api/reports',
  requireRole('STUDENT'),
  asyncHandler(async (req, res) => {
    const claims = requireClaims(req);

    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    const answer = typeof req.body?.answer === 'string' ? req.body.answer.trim() : '';
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    const detail = typeof req.body?.detail === 'string' ? req.body.detail.trim() : '';
    const documentId =
      typeof req.body?.documentId === 'string' && req.body.documentId.length > 0
        ? req.body.documentId
        : null;

    if (!query) throw badRequest('The original question is required.');
    if (!reason) throw badRequest('A reason is required.');
    if (detail.length > 1000) throw badRequest('Detail must be 1000 characters or fewer.');
    if (!(REPORT_REASONS as readonly string[]).includes(reason)) {
      throw badRequest(`Reason must be one of: ${REPORT_REASONS.join(', ')}.`);
    }

    if (documentId) {
      const document = await prisma.document.findUnique({ where: { id: documentId } });
      if (!document) throw badRequest('Referenced document does not exist.');
    }

    const report = await prisma.contentReport.create({
      data: {
        query,
        answer: answer ? answer.slice(0, 4000) : null,
        reason,
        detail: detail || null,
        documentId,
        studentId: claims.id,
        status: 'OPEN',
      },
    });

    res.status(201).json({ report });
  }),
);

/** Open dispute queue for admins. */
reportsRouter.get(
  '/api/admin/reports',
  requireRole('SUPER_ADMIN', 'DEPT_ADMIN'),
  asyncHandler(async (req, res) => {
    const claims = requireClaims(req);
    const statusFilter =
      typeof req.query.status === 'string' && req.query.status.toUpperCase() === 'RESOLVED'
        ? 'RESOLVED'
        : 'OPEN';

    const scoped =
      claims.role === 'DEPT_ADMIN'
        ? {
            student: { departmentId: { equals: claims.departmentId } },
          }
        : {};

    const reports = await prisma.contentReport.findMany({
      where: { status: statusFilter, ...scoped },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            semester: true,
            department: { select: { code: true } },
          },
        },
        document: {
          select: {
            id: true,
            title: true,
            version: true,
            status: true,
            departmentId: true,
            semester: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ reports, status: statusFilter });
  }),
);

async function assertReportAccess(
  role: 'SUPER_ADMIN' | 'DEPT_ADMIN',
  departmentId: string | null,
  reportId: string,
) {
  const report = await prisma.contentReport.findUnique({
    where: { id: reportId },
    include: {
      document: { select: { id: true, title: true, departmentId: true, semester: true } },
      student: { select: { id: true, departmentId: true } },
    },
  });

  if (!report) throw notFound('Report not found.');

  if (role === 'DEPT_ADMIN') {
    const docScope = report.document?.departmentId ?? null;
    const studentScope = report.student.departmentId ?? null;
    const inScope =
      (docScope !== null && docScope === departmentId) ||
      (docScope === null && studentScope === departmentId);
    if (!inScope) {
      throw forbidden('This report is outside your department scope.');
    }
  }

  return report;
}

reportsRouter.post(
  '/api/admin/reports/:id/resolve',
  requireRole('SUPER_ADMIN', 'DEPT_ADMIN'),
  asyncHandler(async (req, res) => {
    const claims = requireClaims(req);
    const report = await assertReportAccess(
      claims.role as 'SUPER_ADMIN' | 'DEPT_ADMIN',
      claims.departmentId,
      req.params.id,
    );

    if (report.status === 'RESOLVED') {
      throw badRequest('This report has already been resolved.');
    }

    const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 500) : '';

    const updated = await prisma.contentReport.update({
      where: { id: report.id },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });

    await writeAudit({
      actorId: claims.id,
      action: 'REPORT_RESOLVED',
      entityType: 'ContentReport',
      entityId: report.id,
      metadata: {
        previousStatus: 'OPEN',
        newStatus: 'RESOLVED',
        reason: report.reason,
        query: report.query,
        documentId: report.documentId,
        documentTitle: report.document?.title ?? null,
        resolutionNote: note || null,
      },
    });

    res.json({ report: updated });
  }),
);
