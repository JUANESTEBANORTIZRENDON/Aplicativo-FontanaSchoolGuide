import { Prisma } from '@prisma/client';
import { prisma, type Db } from '../config/prisma.js';
import type { Cursor } from '../utils/cursor.js';

export type AuditInsert = {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson: Prisma.InputJsonValue | null;
  afterJson: Prisma.InputJsonValue | null;
  reason: string | null;
  requestId: string | null;
  ip: string | null;
};

// Solo inserción: este repositorio no expone actualización ni borrado.
export function insertAudit(db: Db, entry: AuditInsert) {
  return db.adminAuditLog.create({
    data: {
      ...entry,
      beforeJson: entry.beforeJson ?? Prisma.DbNull,
      afterJson: entry.afterJson ?? Prisma.DbNull,
    },
  });
}

export type AuditFilters = { actorUserId?: string; entityType?: string; entityId?: string; action?: string; from?: Date; to?: Date };

export function listAudit(filters: AuditFilters, cursor: Cursor | null, limit: number) {
  return prisma.adminAuditLog.findMany({
    where: {
      AND: [
        filters.actorUserId ? { actorUserId: filters.actorUserId } : {},
        filters.entityType ? { entityType: filters.entityType } : {},
        filters.entityId ? { entityId: filters.entityId } : {},
        filters.action ? { action: filters.action } : {},
        filters.from || filters.to ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lt: filters.to } : {}) } } : {},
        cursor ? { OR: [{ createdAt: { lt: cursor.at } }, { createdAt: cursor.at, id: { lt: cursor.id } }] } : {},
      ],
    },
    include: { actor: { select: { id: true, nombreCompleto: true } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });
}

export function latestForEntities(entityIds: string[], take: number) {
  return prisma.adminAuditLog.findMany({
    where: { entityId: { in: entityIds } },
    include: { actor: { select: { id: true, nombreCompleto: true } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take,
  });
}
