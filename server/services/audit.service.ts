import type { Prisma } from '@prisma/client';
import type { Db } from '../config/prisma.js';
import { sinCamposSensibles } from '../domain/usuario.js';
import { insertAudit, listAudit } from '../repositories/audit.repository.js';
import { decodeCursor, pageOf } from '../utils/cursor.js';
import { rangeToUtc } from '../utils/time.js';

// Contexto de la solicitud que origina una escritura administrativa.
export type ActionContext = { actorUserId: string; requestId?: string; ip?: string };

type AuditEntry = {
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
};

function toJson(value: Record<string, unknown> | null | undefined): Prisma.InputJsonValue | null {
  const safe = sinCamposSensibles(value);
  return safe ? (JSON.parse(JSON.stringify(safe)) as Prisma.InputJsonValue) : null;
}

// Se llama dentro de la misma transacción que la escritura auditada.
export function audit(db: Db, context: ActionContext, entry: AuditEntry) {
  return insertAudit(db, {
    actorUserId: context.actorUserId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    beforeJson: toJson(entry.before),
    afterJson: toJson(entry.after),
    reason: entry.reason ?? null,
    requestId: context.requestId ?? null,
    ip: context.ip ?? null,
  });
}

export type AuditPageQuery = {
  actorUserId?: string; entityType?: string; entityId?: string; action?: string; from?: string; to?: string; cursor?: string; limit: number;
};

// Consulta de solo lectura con filtros y cursor.
export async function listAuditPage(query: AuditPageQuery) {
  const { from, to, cursor, limit, ...filters } = query;
  const rows = await listAudit({ ...filters, ...rangeToUtc(from, to) }, decodeCursor(cursor), limit);
  return pageOf(rows, limit, (row) => ({ at: row.createdAt, id: row.id }));
}
