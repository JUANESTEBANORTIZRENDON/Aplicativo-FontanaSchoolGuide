import { Prisma, type ReactivationStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import type { Db } from '../config/prisma.js';
import { Role } from '../domain/enums.js';
import { ConflictError, NotFoundError } from '../domain/errors.js';
import { assertNotCertified } from './attempt.service.js';
import { audit, type ActionContext } from './audit.service.js';
import { attemptResults } from './evaluation-result.service.js';
import { createOverrideTx } from './override.service.js';
import { loadSnapshot } from './progress.service.js';
import { jsonSnapshot } from './course-retry.service.js';
import { selfRetryKey } from '../domain/evaluation-retry.js';
import { retryReport, type RetryReport } from './retry-report.service.js';

// El acompañamiento reactiva solo la evaluación pendiente y conserva todo el recorrido.

const PAGE_SIZE = 25;

const inTransaction = <T>(db: Db, run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> =>
  '$transaction' in db ? db.$transaction(run, { timeout: 60_000 }) : run(db);

const requestInclude = {
  user: { select: { id: true, nombreCompleto: true, numeroDocumento: true } },
  activity: { select: { id: true, title: true, type: true, module: { select: { slug: true, name: true, order: true } } } },
  decidedBy: { select: { nombreCompleto: true } },
} satisfies Prisma.ReactivationRequestInclude;

type RequestRow = Prisma.ReactivationRequestGetPayload<{ include: typeof requestInclude }>;

function present(row: RequestRow) {
  return {
    id: row.id, status: row.status, createdAt: row.createdAt.toISOString(), advisorNote: row.advisorNote,
    decisionReason: row.decisionReason, decidedAt: row.decidedAt?.toISOString() ?? null, decidedBy: row.decidedBy?.nombreCompleto ?? null,
    attemptId: row.attemptId, overrideId: row.overrideId,
    restartCourse: row.restartCourse, report: row.report as RetryReport | null, hasArchive: Boolean(row.courseArchive),
    advisor: { id: row.user.id, name: row.user.nombreCompleto, document: row.user.numeroDocumento },
    activity: { id: row.activity.id, title: row.activity.title, type: row.activity.type, moduleSlug: row.activity.module.slug, moduleName: row.activity.module.name, moduleOrder: row.activity.module.order },
  };
}

// Pide la reactivación de una actividad. Idempotente: si ya hay una pendiente, devuelve esa misma.
export async function requestReactivation(userId: string, activityId: string, note: string | null, now = new Date(), db: Db = prisma) {
  try {
    return await inTransaction(db, async (tx) => {
      await tx.$queryRaw`SELECT id FROM induccion.usuarios WHERE id = ${userId}::uuid FOR UPDATE`;
      const pending = await tx.reactivationRequest.findFirst({ where: { userId, status: 'PENDING', OR: [{ activityId }, { restartCourse: true }] }, include: requestInclude });
      if (pending) return { request: present(pending), created: false };
      await assertNotCertified(tx, userId);
      const snapshot = await loadSnapshot(tx, userId, now);
      const availability = snapshot.availability.get(activityId);
      const activity = snapshot.modules.flatMap((module) => module.activities).find((item) => item.id === activityId);
      if (!activity) throw new NotFoundError('La actividad no existe.', 'ACTIVITY_NOT_FOUND');
      if (activity.type === 'TYPIFICATION') throw new ConflictError('Tipifica no se aprueba ni se reprueba: no necesita reactivación.', 'REACTIVATION_NOT_APPLICABLE');
      if (!availability?.exhausted) {
        throw new ConflictError(availability?.passed ? 'Ya aprobaste esta actividad.' : 'Todavía tienes un intento disponible en esta actividad.', 'REACTIVATION_NOT_NEEDED');
      }
      const selfRetry = await tx.userActivityOverride.findUnique({ where: { idempotencyKey: selfRetryKey(userId, activityId) } });
      if (!selfRetry) throw new ConflictError('Primero activa tu único reintento desde el resultado de la evaluación.', 'SELF_RETRY_AVAILABLE');
      const last = await tx.attempt.findFirst({ where: { userId, evaluation: { activityId }, submittedAt: { not: null } }, orderBy: { submittedAt: 'desc' }, select: { id: true } });
      const report = await retryReport(userId, activityId, tx, now);
      const created = await tx.reactivationRequest.create({
        data: { userId, activityId, attemptId: last?.id ?? null, advisorNote: note?.trim() || null, createdAt: now,
          restartCourse: false, report: jsonSnapshot(report) },
        include: requestInclude,
      });
      return { request: present(created), created: true };
    });
  } catch (error) {
    // Dos clics simultáneos: el índice único parcial deja una sola pendiente y la otra petición la recibe.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.reactivationRequest.findFirst({ where: { userId, activityId, status: 'PENDING' }, include: requestInclude });
      if (existing) return { request: present(existing), created: false };
    }
    throw error;
  }
}

export async function myReactivationRequests(userId: string) {
  const rows = await prisma.reactivationRequest.findMany({ where: { userId }, include: requestInclude, orderBy: { createdAt: 'desc' }, take: 50 });
  return rows.map(present);
}

export async function listReactivationRequests(filter: { status?: ReactivationStatus; userId?: string; cursor?: string }) {
  const rows = await prisma.reactivationRequest.findMany({
    where: { status: filter.status, userId: filter.userId },
    include: requestInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: PAGE_SIZE + 1,
    ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, PAGE_SIZE).map(present);
  const pending = await prisma.reactivationRequest.count({ where: { status: 'PENDING' } });
  return { items: page, nextCursor: rows.length > PAGE_SIZE ? page.at(-1)!.id : null, pendingTotal: pending };
}

// Detalle para decidir: la solicitud, el resultado del intento que la originó y los intentos anteriores.
export async function reactivationRequestDetail(id: string) {
  const row = await prisma.reactivationRequest.findUnique({ where: { id }, include: requestInclude });
  if (!row) throw new NotFoundError('Solicitud no encontrada.', 'REACTIVATION_NOT_FOUND');
  const attempts = await prisma.attempt.findMany({ where: { userId: row.userId, evaluation: { activityId: row.activityId } }, orderBy: { number: 'asc' }, select: { id: true } });
  const results = await attemptResults(prisma, attempts.map((attempt) => attempt.id));
  const report = row.report as RetryReport | null;
  return { ...present(row), attempts: report?.attempts ?? attempts.map((attempt) => results.get(attempt.id)!) };
}

export async function reactivationArchive(id: string) {
  const row = await prisma.reactivationRequest.findUnique({ where: { id }, select: { courseArchive: true } });
  if (!row?.courseArchive) throw new NotFoundError('No hay un recorrido archivado para esta solicitud.');
  return row.courseArchive;
}

export async function myRequestReport(userId: string, id: string) {
  const row = await prisma.reactivationRequest.findFirst({ where: { id, userId }, select: { id: true, report: true } });
  if (!row?.report) throw new NotFoundError('Constancia no encontrada.');
  return { code: row.id, report: row.report as RetryReport };
}

async function lockRequest(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM induccion.solicitudes_reactivacion WHERE id = ${id}::uuid FOR UPDATE`;
  const row = await tx.reactivationRequest.findUnique({ where: { id }, include: requestInclude });
  if (!row) throw new NotFoundError('Solicitud no encontrada.', 'REACTIVATION_NOT_FOUND');
  return row;
}

// Bloquea primero al usuario, como el envío de exámenes: serializa aprobación, solicitud e intentos.
export async function approveReactivation(id: string, reason: string, context: ActionContext, now = new Date(), db: Db = prisma) {
  return inTransaction(db, async (tx) => {
    const initial = await tx.reactivationRequest.findUnique({ where: { id }, select: { userId: true } });
    if (!initial) throw new NotFoundError('Solicitud no encontrada.', 'REACTIVATION_NOT_FOUND');
    await tx.$queryRaw`SELECT id FROM induccion.usuarios WHERE id = ${initial.userId}::uuid FOR UPDATE`;
    const row = await lockRequest(tx, id);
    const actor = await tx.usuario.findUnique({ where: { id: context.actorUserId }, select: { rol: true } });
    if (actor?.rol !== Role.ADMIN) throw new ConflictError('Solo un administrador decide las solicitudes.', 'ADMIN_REQUIRED');
    if (row.status === 'APPROVED') return present(row);
    if (row.status !== 'PENDING') throw new ConflictError('La solicitud ya fue rechazada.', 'REACTIVATION_DECIDED');
    // Incluso una solicitud pendiente del flujo anterior se resuelve sin borrar módulos.
    const overrideId = (await createOverrideTx(tx, row.userId, row.activityId, { action: 'REACTIVATE', reason, extraAttempts: 1 }, `reactivation-request:${row.id}`, context, now)).id;
    const updated = await tx.reactivationRequest.update({
      where: { id }, include: requestInclude,
      data: { status: 'APPROVED', decisionReason: reason, decidedById: context.actorUserId, decidedAt: now, overrideId, restartCourse: false },
    });
    await audit(tx, context, {
      action: 'REACTIVATION_REQUEST_APPROVED', entityType: 'ReactivationRequest', entityId: id, reason,
      before: { status: row.status, restartCourse: row.restartCourse }, after: { status: 'APPROVED', overrideId, restartCourse: false, userId: row.userId, activityId: row.activityId },
    });
    return present(updated);
  });
}

export async function rejectReactivation(id: string, reason: string, context: ActionContext, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const row = await lockRequest(tx, id);
    const actor = await tx.usuario.findUnique({ where: { id: context.actorUserId }, select: { rol: true } });
    if (actor?.rol !== Role.ADMIN) throw new ConflictError('Solo un administrador decide las solicitudes.', 'ADMIN_REQUIRED');
    if (row.status === 'REJECTED') return present(row);
    if (row.status !== 'PENDING') throw new ConflictError('La solicitud ya fue aprobada.', 'REACTIVATION_DECIDED');
    const updated = await tx.reactivationRequest.update({
      where: { id }, include: requestInclude,
      data: { status: 'REJECTED', decisionReason: reason, decidedById: context.actorUserId, decidedAt: now },
    });
    await audit(tx, context, {
      action: 'REACTIVATION_REQUEST_REJECTED', entityType: 'ReactivationRequest', entityId: id, reason,
      before: { status: row.status }, after: { status: 'REJECTED', userId: row.userId, activityId: row.activityId },
    });
    return present(updated);
  });
}
