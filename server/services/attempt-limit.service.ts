import { prisma } from '../config/prisma.js';
import { Role, UserStatus } from '../domain/enums.js';
import { ConflictError, NotFoundError } from '../domain/errors.js';
import { activeEvaluations, findActivityById } from '../repositories/catalog.repository.js';
import { findModuleProgress, upsertActivityProgress, upsertModuleProgress } from '../repositories/progress.repository.js';
import { audit, type ActionContext } from './audit.service.js';
import { loadSnapshot } from './progress.service.js';

// Fija cuántos intentos tiene un asesor en una actividad (más o menos que el valor de la evaluación).
// Los intentos ya usados se conservan: si el nuevo cupo es mayor que lo usado, la actividad vuelve a estar disponible.
// maxAttempts null restablece el valor de la evaluación.
export async function setAttemptLimit(userId: string, activityId: string, maxAttempts: number | null, reason: string, context: ActionContext, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM induccion.usuarios WHERE id = ${userId}::uuid FOR UPDATE`;
    const user = await tx.usuario.findUnique({ where: { id: userId }, select: { id: true, rol: true, estado: true } });
    if (!user || user.rol !== Role.ADVISOR) throw new NotFoundError('Asesor no encontrado.', 'ADVISOR_NOT_FOUND');
    if (user.estado === UserStatus.INACTIVE) throw new ConflictError('El asesor está inactivo. Actívalo antes de cambiar sus intentos.', 'ADVISOR_INACTIVE');
    const activity = await findActivityById(tx, activityId);
    if (!activity) throw new NotFoundError('La actividad no existe.', 'ACTIVITY_NOT_FOUND');
    if (!(await activeEvaluations(tx, [activityId])).has(activityId)) throw new ConflictError('La actividad no tiene evaluación configurada; no hay intentos que cambiar.', 'ACTION_NOT_APPLICABLE');

    const before = await tx.userAttemptLimit.findUnique({ where: { userId_activityId: { userId, activityId } } });
    if (maxAttempts === null) {
      if (before) await tx.userAttemptLimit.delete({ where: { id: before.id } });
    } else {
      await tx.userAttemptLimit.upsert({
        where: { userId_activityId: { userId, activityId } },
        create: { userId, activityId, maxAttempts, reason, createdById: context.actorUserId },
        update: { maxAttempts, reason, createdById: context.actorUserId },
      });
    }

    // Con cupo disponible el asesor puede volver a intentar aunque la actividad estuviera sin intentos.
    const snapshot = await loadSnapshot(tx, userId, now);
    const availability = snapshot.availability.get(activityId);
    if (availability && !availability.passed && availability.remaining > 0) {
      await upsertActivityProgress(tx, userId, activityId, { status: 'AVAILABLE', lastActivityAt: now });
      const moduleProgress = await findModuleProgress(tx, userId, activity.moduleId);
      if (moduleProgress && (moduleProgress.status === 'FAILED')) await upsertModuleProgress(tx, userId, activity.moduleId, { status: 'AVAILABLE' });
    }

    await audit(tx, context, {
      action: 'ATTEMPT_LIMIT_SET', entityType: 'UserAttemptLimit', entityId: before?.id ?? userId, reason,
      before: { userId, activityId, maxAttempts: before?.maxAttempts ?? null },
      after: { userId, activityId, maxAttempts, attemptsRemaining: availability?.remaining ?? null },
    });
    return { activityId, maxAttempts, attemptsRemaining: availability?.remaining ?? null };
  });
}
