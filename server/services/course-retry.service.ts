import type { Prisma } from '@prisma/client';
import { assertNotCertified } from './attempt.service.js';
import { audit, type ActionContext } from './audit.service.js';
import { attemptResults } from './evaluation-result.service.js';

export const jsonSnapshot = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));

// Se ejecuta con el usuario bloqueado, dentro de la aprobación. Primero archiva TODO el ciclo;
// solo después libera las tablas de trabajo. Si falla cualquier paso, se revierte la transacción.
export async function restartCourseForRetry(tx: Prisma.TransactionClient, userId: string, requestId: string, reason: string, context: ActionContext, now: Date) {
  await assertNotCertified(tx, userId);
  const attempts = await tx.attempt.findMany({ where: { userId }, include: {
    answers: true, typingResults: true, simulatorResults: true, typificationResults: true,
    typingInternal: true, excelResult: true, dictationResult: true, evaluation: { include: { activity: true } },
  } });
  const results = [...(await attemptResults(tx, attempts.map(a => a.id))).values()];
  const [modules, activities, sections, blocks, seals, overrides, limits, typing, profile, induction] = await Promise.all([
    tx.userModuleProgress.findMany({ where: { userId } }), tx.userActivityProgress.findMany({ where: { userId } }),
    tx.activitySectionView.findMany({ where: { userId } }), tx.collectionsBlockProgress.findMany({ where: { userId } }),
    tx.seal.findMany({ where: { userId } }), tx.userActivityOverride.findMany({ where: { userId } }),
    tx.userAttemptLimit.findMany({ where: { userId } }), tx.typingResult.findMany({ where: { userId } }),
    tx.advisorProfile.findUnique({ where: { userId } }),
    tx.usuario.findUnique({ where: { id: userId }, select: { tieneExperienciaCobranzasDigitales: true, fechaRespuestaExperiencia: true,
      fechaInduccionCompletada: true, fechaHistoriaCompletada: true, fechaMetodoCompletado: true } }),
  ]);
  await tx.reactivationRequest.update({ where: { id: requestId }, data: { courseArchive: jsonSnapshot({
    version: 1, archivedAt: now, userId, attempts, results, modules, activities, sections, blocks, seals, overrides, limits, typing, profile, induction,
  }) } });
  // Mantiene las solicitudes y sus constancias. Su evidencia original está íntegra en el archivo.
  await tx.reactivationRequest.updateMany({ where: { userId }, data: { attemptId: null, overrideId: null } });
  await tx.reactivationRequest.updateMany({ where: { userId, id: { not: requestId }, status: 'PENDING' }, data: {
    status: 'REJECTED', decisionReason: 'Sustituida por la aprobación del reinicio completo del recorrido.',
    decidedById: context.actorUserId, decidedAt: now,
  } });
  await tx.seal.deleteMany({ where: { userId } });
  const byAttempt = { attemptId: { in: attempts.map(a => a.id) } };
  await tx.typingResult.deleteMany({ where: { userId } });
  await tx.simulatorResult.deleteMany({ where: { userId } });
  await tx.typificationResult.deleteMany({ where: byAttempt });
  await tx.attemptAnswer.deleteMany({ where: byAttempt });
  await tx.typingAttemptResult.deleteMany({ where: byAttempt });
  await tx.excelAttemptResult.deleteMany({ where: byAttempt });
  await tx.dictationAttemptResult.deleteMany({ where: byAttempt });
  await tx.attempt.deleteMany({ where: { userId } });
  await tx.userActivityOverride.deleteMany({ where: { userId } });
  await tx.userAttemptLimit.deleteMany({ where: { userId } });
  await tx.collectionsBlockProgress.deleteMany({ where: { userId } });
  await tx.userActivityProgress.deleteMany({ where: { userId } });
  await tx.userModuleProgress.deleteMany({ where: { userId } });
  await tx.activitySectionView.deleteMany({ where: { userId } });
  await tx.advisorProfile.updateMany({ where: { userId }, data: { experienceLevel: null } });
  await tx.usuario.update({ where: { id: userId }, data: {
    tieneExperienciaCobranzasDigitales: null, fechaRespuestaExperiencia: null, fechaInduccionCompletada: null,
    fechaHistoriaCompletada: null, fechaMetodoCompletado: null,
  } });
  await audit(tx, context, { action: 'COURSE_RETRY_STARTED', entityType: 'ReactivationRequest', entityId: requestId, reason,
    after: { userId, archivedAttempts: attempts.length, allModulesReset: true } });
}
