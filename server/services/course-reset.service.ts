import { prisma } from '../config/prisma.js';
import { Role } from '../domain/enums.js';
import { ForbiddenError, NotFoundError } from '../domain/errors.js';
import { audit, type ActionContext } from './audit.service.js';

// Reinicio del curso para pruebas: solo existe para esta cuenta. El servidor lo exige además del panel.
export const COURSE_RESET_DOCUMENT = '1021803088';

// Borra todo el progreso del asesor para empezar de cero: intentos y resultados, sellos, certificados,
// excepciones, cupos, avance, lecciones vistas y la inducción inicial. Conserva la cuenta, sus datos y la
// auditoría (que es solo de inserción y registra este reinicio). Todo en una transacción: o se borra todo o nada.
export async function resetCourse(userId: string, reason: string, context: ActionContext) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM induccion.usuarios WHERE id = ${userId}::uuid FOR UPDATE`;
    const user = await tx.usuario.findUnique({ where: { id: userId }, select: { id: true, rol: true, numeroDocumento: true } });
    if (!user || user.rol !== Role.ADVISOR) throw new NotFoundError('Asesor no encontrado.', 'ADVISOR_NOT_FOUND');
    if (user.numeroDocumento !== COURSE_RESET_DOCUMENT) throw new ForbiddenError('El reinicio del curso no está habilitado para este usuario.', 'COURSE_RESET_NOT_ALLOWED');

    const attemptIds = (await tx.attempt.findMany({ where: { userId }, select: { id: true } })).map((row) => row.id);
    const byAttempt = { attemptId: { in: attemptIds } };
    // Los certificados reemitidos se enlazan entre sí: se sueltan antes de borrarlos.
    await tx.certificate.updateMany({ where: { userId }, data: { previousCertificateId: null } });
    const certificates = (await tx.certificate.deleteMany({ where: { userId } })).count;
    const seals = (await tx.seal.deleteMany({ where: { userId } })).count;
    // Resultados de cada intento antes que los intentos.
    await tx.typingResult.deleteMany({ where: { userId } });
    await tx.simulatorResult.deleteMany({ where: { userId } });
    await tx.typificationResult.deleteMany({ where: byAttempt });
    await tx.attemptAnswer.deleteMany({ where: byAttempt });
    await tx.typingAttemptResult.deleteMany({ where: byAttempt });
    await tx.excelAttemptResult.deleteMany({ where: byAttempt });
    await tx.dictationAttemptResult.deleteMany({ where: byAttempt });
    const attempts = (await tx.attempt.deleteMany({ where: { userId } })).count;
    // Las excepciones se borran después de los intentos que las usaron.
    const overrides = (await tx.userActivityOverride.deleteMany({ where: { userId } })).count;
    const limits = (await tx.userAttemptLimit.deleteMany({ where: { userId } })).count;
    await tx.userActivityProgress.deleteMany({ where: { userId } });
    await tx.userModuleProgress.deleteMany({ where: { userId } });
    await tx.activitySectionView.deleteMany({ where: { userId } });
    await tx.usuario.update({
      where: { id: userId },
      data: {
        tieneExperienciaCobranzasDigitales: null, fechaRespuestaExperiencia: null, fechaInduccionCompletada: null,
        fechaHistoriaCompletada: null, fechaMetodoCompletado: null,
      },
    });
    await audit(tx, context, {
      action: 'COURSE_RESET', entityType: 'Usuario', entityId: userId, reason,
      after: { intentosBorrados: attempts, excepcionesBorradas: overrides, cuposBorrados: limits, certificadosBorrados: certificates, sellosBorrados: seals },
    });
    return { attemptsDeleted: attempts, overridesDeleted: overrides };
  }, { timeout: 30_000 });
}
