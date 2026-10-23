import { Prisma, type OverrideAction, type UserActivityOverride } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { Role, UserStatus } from '../domain/enums.js';
import { ConflictError, NotFoundError, ValidationError } from '../domain/errors.js';
import { isOverrideActive } from '../domain/progress.js';
import { activeEvaluations, findActivityById } from '../repositories/catalog.repository.js';
import { findModuleProgress, upsertActivityProgress, upsertModuleProgress } from '../repositories/progress.repository.js';
import { audit, type ActionContext } from './audit.service.js';
import { loadSnapshot } from './progress.service.js';

export type ReactivateInput = { action: OverrideAction; reason: string; extraAttempts?: number; expiresAt?: Date };

function sameRequest(existing: UserActivityOverride, userId: string, activityId: string, input: ReactivateInput): boolean {
  return existing.userId === userId && existing.activityId === activityId && existing.action === input.action;
}

// Crea una excepción individual. Idempotente por Idempotency-Key: repetir la clave devuelve la existente.
export async function reactivate(userId: string, activityId: string, input: ReactivateInput, idempotencyKey: string, context: ActionContext, now = new Date()): Promise<{ override: UserActivityOverride; created: boolean }> {
  const previous = await prisma.userActivityOverride.findUnique({ where: { idempotencyKey } });
  if (previous) {
    if (!sameRequest(previous, userId, activityId, input)) throw new ConflictError('La clave de idempotencia ya se usó con otra solicitud.', 'IDEMPOTENCY_KEY_REUSED');
    return { override: previous, created: false };
  }
  try {
    return await prisma.$transaction(async (tx) => ({ override: await createOverrideTx(tx, userId, activityId, input, idempotencyKey, context, now), created: true }));
  } catch (error) {
    // Dos solicitudes simultáneas con la misma clave: gana una y la otra recibe la existente.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.userActivityOverride.findUnique({ where: { idempotencyKey } });
      if (existing && sameRequest(existing, userId, activityId, input)) return { override: existing, created: false };
    }
    throw error;
  }
}

// Crea la excepción dentro de una transacción abierta. La aprobación de una solicitud de reactivación la usa para
// guardar la solicitud y la excepción juntas.
export async function createOverrideTx(tx: Prisma.TransactionClient, userId: string, activityId: string, input: ReactivateInput, idempotencyKey: string, context: ActionContext, now = new Date()): Promise<UserActivityOverride> {
  if (input.expiresAt && input.expiresAt <= now) throw new ValidationError('La fecha de vencimiento debe ser futura.', { expiresAt: 'Debe ser una fecha futura.' });
  if (input.action === 'EXTRA_ATTEMPT' && (!input.extraAttempts || input.extraAttempts < 1)) {
    throw new ValidationError('Indica cuántos intentos adicionales conceder (mínimo 1).', { extraAttempts: 'Mínimo 1.' });
  }
  await tx.$queryRaw`SELECT id FROM induccion.usuarios WHERE id = ${userId}::uuid FOR UPDATE`;
  const user = await tx.usuario.findUnique({ where: { id: userId }, select: { id: true, rol: true, estado: true } });
  if (!user || user.rol !== Role.ADVISOR) throw new NotFoundError('Asesor no encontrado.', 'ADVISOR_NOT_FOUND');
  if (user.estado === UserStatus.INACTIVE) throw new ConflictError('El asesor está inactivo. Actívalo antes de crear una excepción.', 'ADVISOR_INACTIVE');
  const activity = await findActivityById(tx, activityId);
  if (!activity) throw new NotFoundError('La actividad no existe.', 'ACTIVITY_NOT_FOUND');

  const snapshot = await loadSnapshot(tx, userId, now);
  const view = snapshot.views.find((module) => module.moduleId === activity.moduleId);
  const availability = snapshot.availability.get(activityId);
  const hasEvaluation = (await activeEvaluations(tx, [activityId])).has(activityId);
  const invalid = (message: string) => new ConflictError(message, 'ACTION_NOT_APPLICABLE');
  switch (input.action) {
    case 'EXTRA_ATTEMPT':
      if (!hasEvaluation) throw invalid('La actividad no tiene evaluación configurada; no hay intentos que ampliar.');
      break;
    case 'REACTIVATE':
      if (!hasEvaluation || !availability?.exhausted) throw invalid('Solo se reactiva una actividad con los intentos agotados.');
      break;
    case 'RESET_WAIT':
      if (!availability?.waitUntil) throw invalid('El asesor no tiene un tiempo de espera activo en esta actividad.');
      break;
    case 'UNLOCK':
      if (view?.status !== 'BLOCKED' || view.catalogStatus !== 'ACTIVE') throw invalid('El módulo no está bloqueado por prerrequisitos.');
      break;
    case 'REOPEN_MODULE':
      if (view?.status !== 'PASSED') throw invalid('Solo se reabre un módulo aprobado.');
      break;
  }

  const duplicate = snapshot.overrides.find((override) => override.activityId === activityId && override.action === input.action && isOverrideActive(override, now));
  if (duplicate) throw new ConflictError('Ya existe una excepción vigente igual para este asesor y actividad.', 'OVERRIDE_DUPLICATE', { overrideId: duplicate.id });

  const override = await tx.userActivityOverride.create({
    data: {
      userId, activityId, action: input.action, reason: input.reason,
      extraAttempts: input.action === 'EXTRA_ATTEMPT' ? input.extraAttempts! : input.action === 'REACTIVATE' ? Math.max(1, input.extraAttempts ?? 1) : 0,
      expiresAt: input.expiresAt ?? null, createdById: context.actorUserId, idempotencyKey, createdAt: now,
    },
  });

  // Devuelve el acceso; los intentos anteriores no se tocan y la numeración continúa.
  if (input.action === 'EXTRA_ATTEMPT' || input.action === 'REACTIVATE') {
    await upsertActivityProgress(tx, userId, activityId, { status: 'AVAILABLE', lastActivityAt: now });
    const moduleProgress = await findModuleProgress(tx, userId, activity.moduleId);
    if (!moduleProgress || moduleProgress.status === 'FAILED' || moduleProgress.status === 'BLOCKED') await upsertModuleProgress(tx, userId, activity.moduleId, { status: 'AVAILABLE' });
  } else if (input.action === 'UNLOCK') {
    await upsertModuleProgress(tx, userId, activity.moduleId, { status: 'AVAILABLE' });
  }

  await audit(tx, context, {
    action: 'OVERRIDE_CREATED', entityType: 'UserActivityOverride', entityId: override.id, reason: input.reason,
    before: { userId, activityId, moduleStatus: view?.status ?? null, attemptsRemaining: availability?.remaining ?? null },
    after: { ...override },
  });
  return override;
}

// Revocar no borra: deja revokedAt y el motivo en el historial.
export async function revoke(id: string, reason: string, context: ActionContext, now = new Date()): Promise<UserActivityOverride> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM induccion.excepciones_actividad WHERE id = ${id}::uuid FOR UPDATE`;
    const before = await tx.userActivityOverride.findUnique({ where: { id } });
    if (!before) throw new NotFoundError('Excepción no encontrada.', 'OVERRIDE_NOT_FOUND');
    if (before.revokedAt) throw new ConflictError('La excepción ya estaba revocada.', 'OVERRIDE_ALREADY_REVOKED');
    const after = await tx.userActivityOverride.update({ where: { id }, data: { revokedAt: now, revokeReason: reason } });
    await audit(tx, context, { action: 'OVERRIDE_REVOKED', entityType: 'UserActivityOverride', entityId: id, before: { ...before }, after: { ...after }, reason });
    return after;
  });
}
