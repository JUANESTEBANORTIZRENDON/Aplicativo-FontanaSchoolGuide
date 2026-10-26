import type { Db } from '../config/prisma.js';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../domain/errors.js';
import { selfRetryKey } from '../domain/evaluation-retry.js';
import { assertNotCertified } from './attempt.service.js';
import { audit } from './audit.service.js';
import { createOverrideTx } from './override.service.js';
import { loadSnapshot } from './progress.service.js';
import { retryReport } from './retry-report.service.js';

async function context(db: Db, userId: string, activityId: string, now: Date) {
  const user = await db.usuario.findUnique({ where: { id: userId }, select: { rol: true, estado: true, debeCompletarDatos: true } });
  if (!user || user.rol !== 'asesor' || user.estado !== 'activo' || user.debeCompletarDatos) throw new ForbiddenError('Completa tu perfil e inicia sesión como asesor activo.');
  const snapshot = await loadSnapshot(db, userId, now);
  const module = snapshot.modules.find(m => m.activities.some(a => a.id === activityId));
  const activity = module?.activities.find(a => a.id === activityId);
  if (!activity || !snapshot.evaluations.has(activityId)) throw new NotFoundError('Evaluación no encontrada.', 'ACTIVITY_NOT_FOUND');
  const view = snapshot.views.find(v => v.moduleId === module!.id);
  if (activity.status !== 'ACTIVE' || !view?.enabled) throw new ForbiddenError(view?.blockedReason ?? 'Evaluación no disponible.', 'MODULE_BLOCKED');
  const [grant, request] = await Promise.all([
    db.userActivityOverride.findUnique({ where: { idempotencyKey: selfRetryKey(userId, activityId) } }),
    db.reactivationRequest.findFirst({ where: { userId, activityId }, orderBy: { createdAt: 'desc' }, select: { id: true, status: true, decisionReason: true, createdAt: true } }),
  ]);
  const availability = snapshot.availability.get(activityId)!;
  return { activity, availability, grant, pending: request?.status === 'PENDING' ? request : null,
    rejectionReason: request?.status === 'REJECTED' ? request.decisionReason : null, certified: Boolean(snapshot.activeCertificateId) };
}

export async function evaluationRetryState(userId: string, activityId: string, db: Db = prisma, now = new Date()) {
  const ctx = await context(db, userId, activityId, now);
  if (ctx.certified || ctx.availability.passed) return { phase: 'PASSED' as const, selfRetryUsed: Boolean(ctx.grant), report: null, requestId: null };
  const report = await retryReport(userId, activityId, db, now);
  const phase = ctx.pending ? 'SUPPORT_PENDING'
    : ctx.availability.openAttemptId ? 'IN_PROGRESS'
    : ctx.availability.remaining > 0 ? 'RETRY_READY'
    : ctx.grant ? 'SUPPORT_REQUIRED' : 'SELF_RETRY_AVAILABLE';
  return { phase, selfRetryUsed: Boolean(ctx.grant), report, requestId: ctx.pending?.id ?? null, rejectionReason: ctx.rejectionReason };
}

// La identidad se toma de la sesión. Bloqueo de usuario + clave única impiden
// conceder dos reintentos por doble clic, dos pestañas o una petición repetida.
export async function activateSelfRetry(userId: string, activityId: string, now = new Date(), db: Db = prisma) {
  const activate = async (tx: Prisma.TransactionClient) => {
    await tx.$queryRaw`SELECT id FROM induccion.usuarios WHERE id = ${userId}::uuid FOR UPDATE`;
    await assertNotCertified(tx, userId);
    const ctx = await context(tx, userId, activityId, now);
    if (ctx.pending) throw new ConflictError('Tu solicitud de acompañamiento está pendiente.', 'SUPPORT_PENDING');
    if (ctx.grant) return { activated: false, alreadyActivated: true };
    if (!ctx.availability.exhausted) throw new ConflictError('La evaluación ya está aprobada o tienes un intento disponible.', 'SELF_RETRY_NOT_NEEDED');
    await retryReport(userId, activityId, tx, now); // Debe existir un resultado fallido propio.
    const grant = await createOverrideTx(tx, userId, activityId,
      { action: 'REACTIVATE', extraAttempts: 1, reason: 'Único reintento solicitado por el asesor.' },
      selfRetryKey(userId, activityId), { actorUserId: userId }, now);
    await audit(tx, { actorUserId: userId }, { action: 'SELF_RETRY_ACTIVATED', entityType: 'UserActivityOverride', entityId: grant.id,
      after: { userId, activityId, extraAttempts: 1 } });
    return { activated: true, alreadyActivated: false };
  };
  return '$transaction' in db ? db.$transaction(activate) : activate(db);
}
