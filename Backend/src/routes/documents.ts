import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { writeAudit } from '../lib/audit';
import { extractPdfPages } from '../lib/pdf';
import { asyncHandler, badRequest, forbidden, notFound } from '../lib/http';
import { requireClaims, requireRole, type Role } from '../middleware/auth';
import { ingestDocument } from '../services/ingest';
import { markPayloadByDocument } from '../lib/qdrant';

const ADMIN_ROLES: Role[] = ['SUPER_ADMIN', 'DEPT_ADMIN'];

fs.mkdirSync(env.uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, env.uploadsDir),
  filename: (_req, file, callback) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    callback(null, `${Date.now()}-${randomUUID().slice(0, 8)}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const isPdf =
      file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      callback(badRequest('Only PDF files are accepted.'));
      return;
    }
    callback(null, true);
  },
});

export const documentsRouter = Router();

function parseOptionalInt(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  return parsed;
}

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ');
}

/** Returns the documents that make up the same "document family". */
async function findFamily(
  title: string,
  departmentId: string | null,
  semester: number | null,
  excludeId?: string,
) {
  // SQLite has no case-insensitive comparison (`mode: 'insensitive'` is
  // PostgreSQL-only), so matching on the title is done in JavaScript.
  const candidates = await prisma.document.findMany({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      departmentId: { equals: departmentId },
      semester: { equals: semester },
    },
    select: { id: true, title: true, version: true, status: true, semester: true },
    orderBy: { version: 'asc' },
  });
  const normalized = title.toLowerCase();
  return candidates.filter((doc) => doc.title.toLowerCase() === normalized);
}

documentsRouter.post(
  '/api/admin/documents',
  requireRole(...ADMIN_ROLES),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const claims = requireClaims(req);
    const file = req.file;

    if (!file) throw badRequest('A PDF file is required under the "file" field.');

    const title = normalizeTitle(String(req.body?.title ?? ''));
    const category = String(req.body?.category ?? '').trim();
    const semester = parseOptionalInt(req.body?.semester);
    const requestedVersion = parseOptionalInt(req.body?.version) ?? 1;

    if (!title) throw badRequest('Document title is required.');
    if (!category) throw badRequest('Document category is required.');
    if (requestedVersion < 1) throw badRequest('Version must be 1 or greater.');

    // ---------------------------------------------------------------- RBAC scope
    let departmentId: string | null = null;
    const requestedDepartment = String(req.body?.departmentId ?? 'institution').trim();

    if (requestedDepartment && requestedDepartment !== 'institution') {
      const department = await prisma.department.findUnique({
        where: { id: requestedDepartment },
      });
      if (!department) throw badRequest('Unknown department for the given scope.');
      departmentId = department.id;
    }

    if (claims.role === 'DEPT_ADMIN') {
      if (!claims.departmentId) {
        throw forbidden('This department admin account is not linked to a department.');
      }
      if (departmentId !== null && departmentId !== claims.departmentId) {
        throw forbidden('Department admins can only publish into their own department.');
      }
      departmentId = claims.departmentId;
    }

    // ---------------------------------------------------------------- Extract
    const absolutePath = file.path;
    let extracted;
    try {
      const buffer = fs.readFileSync(absolutePath);
      extracted = await extractPdfPages(buffer);
    } catch (error) {
      fs.rmSync(absolutePath, { force: true });
      throw badRequest(
        `The PDF could not be parsed: ${(error as Error).message}`,
      );
    }

    if (extracted.pages.every((page) => page.trim().length === 0)) {
      fs.rmSync(absolutePath, { force: true });
      throw badRequest('No selectable text was found in the PDF. Scanned images are not supported.');
    }

    // ---------------------------------------------------------------- Publish
    const family = await findFamily(title, departmentId, semester);
    const version =
      family.length > 0 ? Math.max(requestedVersion, ...family.map((doc) => doc.version + 1)) : requestedVersion;

    const document = await prisma.document.create({
      data: {
        title,
        category,
        fileUrl: `/uploads/${file.filename}`,
        fileName: file.originalname,
        departmentId,
        semester,
        version,
        status: 'PROCESSING',
        pageCount: extracted.pageCount,
        uploadedByUserId: claims.id,
      },
    });

    try {
      const ingest = await ingestDocument({
        documentId: document.id,
        title,
        category,
        departmentId,
        semester,
        version,
        pages: extracted.pages,
      });

      await prisma.document.update({
        where: { id: document.id },
        data: { status: 'PUBLISHED', chunkCount: ingest.chunkCount, pageCount: ingest.pageCount },
      });

      const superseded: string[] = [];
      for (const previous of family) {
        if (previous.status !== 'PUBLISHED') continue;
        await prisma.document.update({
          where: { id: previous.id },
          data: { status: 'SUPERSEDED' },
        });
        await markPayloadByDocument(previous.id, { status: 'SUPERSEDED' });
        superseded.push(previous.id);
      }

      await writeAudit({
        actorId: claims.id,
        action: 'DOCUMENT_PUBLISHED',
        entityType: 'Document',
        entityId: document.id,
        metadata: {
          title,
          version,
          departmentId,
          semester,
          chunkCount: ingest.chunkCount,
          supersededDocumentIds: superseded,
        },
      });

      const created = await prisma.document.findUnique({
        where: { id: document.id },
        include: { uploadedBy: { select: { id: true, name: true, email: true } } },
      });

      res.status(201).json({
        document: created,
        supersededIds: superseded,
        chunks: ingest.chunkCount,
        pages: ingest.pageCount,
      });
    } catch (error) {
      await prisma.document
        .update({ where: { id: document.id }, data: { status: 'PROCESSING' } })
        .catch(() => undefined);
      throw error;
    }
  }),
);

documentsRouter.get(
  '/api/admin/documents',
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const claims = requireClaims(req);

    const documents = await prisma.document.findMany({
      where:
        claims.role === 'DEPT_ADMIN'
          ? { OR: [{ departmentId: { equals: claims.departmentId } }, { departmentId: null }] }
          : {},
      include: {
        department: { select: { code: true, name: true } },
        uploadedBy: { select: { id: true, name: true, email: true } },
        reports: { where: { status: 'OPEN' }, select: { id: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    // Resolve which published document superseded an archived one.
    const supersedeMap = new Map<string, string>();
    const publishedByKey = new Map<string, { id: string; version: number }>();
    for (const doc of documents) {
      if (doc.status !== 'PUBLISHED') continue;
      const key = `${doc.title.toLowerCase()}|${doc.departmentId ?? 'all'}|${doc.semester ?? 'all'}`;
      const current = publishedByKey.get(key);
      if (!current || doc.version > current.version) publishedByKey.set(key, doc);
    }
    for (const doc of documents) {
      if (doc.status !== 'SUPERSEDED') continue;
      const key = `${doc.title.toLowerCase()}|${doc.departmentId ?? 'all'}|${doc.semester ?? 'all'}`;
      const winner = publishedByKey.get(key);
      if (winner && winner.version > doc.version) supersedeMap.set(doc.id, winner.id);
    }

    res.json({
      documents: documents.map((doc) => ({
        ...doc,
        openReports: doc.reports.length,
        reports: undefined,
        scope: doc.department?.code ?? 'Institution-wide',
        supersededBy: supersedeMap.get(doc.id) ?? null,
      })),
    });
  }),
);

documentsRouter.get(
  '/api/admin/documents/:id',
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const claims = requireClaims(req);
    const document = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!document) throw notFound('Document not found.');
    if (
      claims.role === 'DEPT_ADMIN' &&
      document.departmentId !== null &&
      document.departmentId !== claims.departmentId
    ) {
      throw forbidden('This document belongs to another department.');
    }
    res.json({ document });
  }),
);
