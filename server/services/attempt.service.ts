import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { Role, UserStatus } from '../domain/enums.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../domain/errors.js';
import { computeAvailability, grantedAttempts, type Availability } from '../domain/progress.js';
import { activeEvaluations, findActivityById } from '../repositories/catalog.repository.js';
import {
  findModuleProgress, lockActivityProgress, overridesForUser, upsertActivityProgress, upsertModuleProgress,
} from '../repositories/progress.repository.js';
import { formatLocal } from '../utils/time.js';
import { completeModule, loadSnapshot, refreshModulePercent } from './progress.service.js';

// Sin rutas públicas todavía: lo usan las pruebas, el seed demo y, más adelante, los módulos de contenido.

type Tx = Prisma.TransactionClient;

async function availabilityFor(tx: Tx, userId: string, activityId: string, evaluation: Parameters<typeof computeAvailability>[0] & { id: string }, now: Date): Promise<Availability> {
  const [attempts, overrides] = await Promise.all([
    tx.attempt.findMany({ where: { userId, evaluationId: evaluation.id }, select: { id: true, number: true, status: true, overrideId: true, submittedAt: true, startedAt: true } }),
    overridesForUser(tx, userId).then((rows) => rows.filter((row) => row.activityId === activityId)),
  ]);
  return computeAvailability(evaluation, attempts, overrides, now);
}

export async function startAttempt(userId: string, activityId: string, options: { now?: Date } = {}) {
  const now = options.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const user = await tx.usuario.findUnique({ where: { id: userId }, select: { rol: true, estado: true } });
    if (!user || user.rol !== Role.ADVISOR || user.estado !== UserStatus.ACTIVE) throw new ForbiddenError('El usuario no puede iniciar intentos.', 'USER_NOT_ALLOWED');
    const activity = await findActivityById(tx, activityId);
    if (!activity) throw new NotFoundError('La actividad no existe.', 'ACTIVITY_NOT_FOUND');
    if (activity.status !== 'ACTIVE') throw new ForbiddenError('Actividad no disponible temporalmente.', 'ACTIVITY_INACTIVE');

    // Fila de progreso creada y bloqueada: serializa intentos simultáneos del mismo usuario.
    await tx.userActivityProgress.upsert({ where: { userId_activityId: { userId, activityId } }, create: { userId, activityId, status: 'AVAILABLE' }, update: {} });
    await lockActivityProgress(tx, userId, activityId);

    const view = (await loadSnapshot(tx, userId, now)).views.find((module) => module.moduleId === activity.moduleId);
    if (view?.status === 'FAILED') throw new ConflictError('No tienes intentos disponibles. Solicita una reactivación al administrador.', 'NO_ATTEMPTS_LEFT');
    if (!view || !view.enabled) {
      throw new ForbiddenError(view?.blockedReason ?? 'Módulo no disponible.', 'MODULE_BLOCKED', { blockedReason: view?.blockedReason ?? null });
    }
    const evaluation = (await activeEvaluations(tx, [activityId])).get(activityId);
    if (!evaluation) throw new ConflictError('La actividad todavía no tiene una evaluación configurada.', 'NO_EVALUATION');

    const availability = await availabilityFor(tx, userId, activityId, evaluation, now);
    if (availability.openAttemptId) {
      return { attempt: await tx.attempt.findUniqueOrThrow({ where: { id: availability.openAttemptId } }), resumed: true };
    }
    if (availability.passed) throw new ConflictError('Ya aprobaste esta actividad.', 'ALREADY_PASSED');
    if (availability.remaining === 0) throw new ConflictError('No tienes intentos disponibles. Solicita una reactivación al administrador.', 'NO_ATTEMPTS_LEFT');
    if (availability.waitUntil) {
      throw new ConflictError(`Debes esperar para un nuevo intento. Podrás intentarlo desde ${formatLocal(availability.waitUntil)}.`, 'WAIT_ACTIVE', { waitUntil: availability.waitUntil.toISOString() });
    }

    const attempt = await tx.attempt.create({
      data: { userId, evaluationId: evaluation.id, number: availability.nextNumber, status: 'IN_PROGRESS', startedAt: now, overrideId: availability.grantOverrideId },
    });

    // La excepción usada se marca consumida cuando agota los intentos que concedía.
    if (availability.grantOverrideId) {
      const grant = await tx.userActivityOverride.findUniqueOrThrow({ where: { id: availability.grantOverrideId } });
      const used = await tx.attempt.count({ where: { overrideId: grant.id, status: { not: 'CANCELLED' } } });
      if (used >= grantedAttempts(grant)) await tx.userActivityOverride.update({ where: { id: grant.id }, data: { consumedAt: now } });
    }
    if (availability.resetWaitOverrideId) {
      await tx.userActivityOverride.update({ where: { id: availability.resetWaitOverrideId }, data: { consumedAt: now } });
    }

    const activityProgress = await tx.userActivityProgress.findUniqueOrThrow({ where: { userId_activityId: { userId, activityId } } });
    await upsertActivityProgress(tx, userId, activityId, { status: 'IN_PROGRESS', startedAt: activityProgress.startedAt ?? now, lastActivityAt: now });
    const moduleProgress = await findModuleProgress(tx, userId, activity.moduleId);
    await upsertModuleProgress(tx, userId, activity.moduleId, {
      status: moduleProgress?.status === 'PASSED' ? 'PASSED' : 'IN_PROGRESS',
      startedAt: moduleProgress?.startedAt ?? now,
      lastActivityAt: now,
    });
    return { attempt, resumed: false };
  });
}

export type AnswerInput = { questionId: string; optionId?: string | null; isCorrect?: boolean | null; awardedScore?: number | string | null };
export type SubmitInput = { answers?: AnswerInput[]; score?: number | string; durationSeconds?: number; now?: Date };

// Nota en Decimal(5,2): puntaje explícito, suma de puntajes otorgados o proporción de aciertos.
export function scoreFrom(input: SubmitInput): Prisma.Decimal {
  const clamp = (value: Prisma.Decimal) => Prisma.Decimal.min(100, Prisma.Decimal.max(0, value)).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  if (input.score !== undefined) return clamp(new Prisma.Decimal(input.score));
  const answers = input.answers ?? [];
  if (answers.some((answer) => answer.awardedScore !== undefined && answer.awardedScore !== null)) {
    return clamp(answers.reduce((sum, answer) => sum.add(answer.awardedScore ?? 0), new Prisma.Decimal(0)));
  }
  if (answers.length === 0) throw new ValidationError('El intento no tiene respuestas ni puntaje.', { answers: 'Sin respuestas.' });
  return clamp(new Prisma.Decimal(answers.filter((answer) => answer.isCorrect).length).div(answers.length).mul(100));
}

export async function submitAttempt(userId: string, attemptId: string, input: SubmitInput) {
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM induccion.intentos WHERE id = ${attemptId}::uuid FOR UPDATE`;
    const attempt = await tx.attempt.findUnique({ where: { id: attemptId }, include: { evaluation: { include: { activity: true } } } });
    if (!attempt || attempt.userId !== userId) throw new NotFoundError('Intento no encontrado.', 'ATTEMPT_NOT_FOUND');
    if (attempt.status !== 'IN_PROGRESS') throw new ConflictError('El intento ya fue enviado.', 'ATTEMPT_CLOSED');

    const score = scoreFrom(input);
    const passed = score.greaterThanOrEqualTo(attempt.evaluation.minimumScore);
    const durationSeconds = input.durationSeconds ?? Math.max(0, Math.round((now.getTime() - attempt.startedAt.getTime()) / 1000));
    if (input.answers?.length) {
      await tx.attemptAnswer.createMany({ data: input.answers.map((answer) => ({
        attemptId, questionId: answer.questionId, optionId: answer.optionId ?? null, isCorrect: answer.isCorrect ?? null,
        awardedScore: answer.awardedScore === undefined || answer.awardedScore === null ? null : new Prisma.Decimal(answer.awardedScore),
      })) });
    }
    const closed = await tx.attempt.update({
      where: { id: attemptId },
      data: { status: passed ? 'PASSED' : 'FAILED', score, submittedAt: now, durationSeconds },
    });

    const activity = attempt.evaluation.activity;
    const availability = await availabilityFor(tx, userId, activity.id, attempt.evaluation, now);
    const activityProgress = await tx.userActivityProgress.findUnique({ where: { userId_activityId: { userId, activityId: activity.id } } });
    await upsertActivityProgress(tx, userId, activity.id, {
      status: passed ? 'PASSED' : availability.exhausted ? 'FAILED' : 'IN_PROGRESS',
      attemptsUsed: (activityProgress?.attemptsUsed ?? 0) + 1,
      completedAt: passed ? now : activityProgress?.completedAt ?? null,
      lastActivityAt: now,
    });

    const { percent, complete } = await refreshModulePercent(tx, userId, activity.moduleId);
    const moduleProgress = await findModuleProgress(tx, userId, activity.moduleId);
    if (complete && moduleProgress?.status !== 'PASSED') {
      await completeModule(tx, userId, activity.moduleId, attemptId, now);
    } else {
      await upsertModuleProgress(tx, userId, activity.moduleId, {
        status: moduleProgress?.status === 'PASSED' ? 'PASSED' : (!passed && availability.exhausted ? 'FAILED' : 'IN_PROGRESS'),
        percent,
        lastActivityAt: now,
      });
    }
    return { attempt: closed, passed };
  });
}
