import { prisma } from './prisma';

export interface AuditEntry {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      // SQLite has no native Json column type; metadata is stored as a JSON string.
      metadata: JSON.stringify(entry.metadata ?? {}),
    },
  });
}
