import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export interface AuditEntry {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: entry.metadata ?? {},
    },
  });
}
