import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ certified: vi.fn(), audit: vi.fn(), results: vi.fn() }));
vi.mock('../services/attempt.service.js', () => ({ assertNotCertified: mocks.certified }));
vi.mock('../services/audit.service.js', () => ({ audit: mocks.audit }));
vi.mock('../services/evaluation-result.service.js', () => ({ attemptResults: mocks.results }));
import { restartCourseForRetry } from '../services/course-retry.service.js';

describe('reinicio completo autorizado y archivo', () => {
  let tx: any;
  const context = { actorUserId: 'admin' };
  const now = new Date('2026-10-23T18:00:00Z');
  beforeEach(() => {
    vi.resetAllMocks();
    tx = {};
    for (const name of ['attempt', 'reactivationRequest', 'userModuleProgress', 'userActivityProgress', 'activitySectionView',
      'collectionsBlockProgress', 'seal', 'userActivityOverride', 'userAttemptLimit', 'typingResult', 'simulatorResult',
      'typificationResult', 'attemptAnswer', 'typingAttemptResult', 'excelAttemptResult', 'dictationAttemptResult', 'advisorProfile', 'usuario']) {
      tx[name] = { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() };
    }
    tx.attempt.findMany.mockResolvedValue([{ id: 'old-attempt', answers: [{ questionId: 'q', optionId: 'B' }] }]);
    mocks.results.mockResolvedValue(new Map([['old-attempt', { score: '40.00', passed: false }]]));
  });
  const reset = () => restartCourseForRetry(tx, 'advisor', 'request', 'Refuerzo completo', context, now);
  it('guarda respuestas y resultados antes de retirar el progreso activo', async () => {
    await reset();
    const archive = tx.reactivationRequest.update.mock.calls[0][0].data.courseArchive;
    expect(archive).toMatchObject({ version: 1, userId: 'advisor', archivedAt: now.toISOString(),
      attempts: [{ id: 'old-attempt', answers: [{ questionId: 'q', optionId: 'B' }] }], results: [{ score: '40.00', passed: false }] });
    for (const name of ['seal', 'attempt', 'userModuleProgress', 'userActivityProgress', 'activitySectionView', 'collectionsBlockProgress',
      'userActivityOverride', 'userAttemptLimit', 'typingResult', 'simulatorResult']) {
      expect(tx[name].deleteMany).toHaveBeenCalledWith({ where: { userId: 'advisor' } });
      expect(tx.reactivationRequest.update.mock.invocationCallOrder[0]).toBeLessThan(tx[name].deleteMany.mock.invocationCallOrder[0]);
    }
  });
  it('libera los enlaces antes de borrar intentos y borra resultados antes del intento', async () => {
    await reset();
    expect(tx.reactivationRequest.updateMany).toHaveBeenCalledWith({ where: { userId: 'advisor' }, data: { attemptId: null, overrideId: null } });
    expect(tx.reactivationRequest.updateMany.mock.invocationCallOrder[0]).toBeLessThan(tx.attempt.deleteMany.mock.invocationCallOrder[0]);
    for (const name of ['typificationResult', 'attemptAnswer', 'typingAttemptResult', 'excelAttemptResult', 'dictationAttemptResult']) {
      expect(tx[name].deleteMany).toHaveBeenCalledWith({ where: { attemptId: { in: ['old-attempt'] } } });
      expect(tx[name].deleteMany.mock.invocationCallOrder[0]).toBeLessThan(tx.attempt.deleteMany.mock.invocationCallOrder[0]);
    }
  });
  it('restablece inducción, experiencia y memoria de los principios, conservando la cuenta', async () => {
    await reset();
    expect(tx.usuario.update).toHaveBeenCalledWith({ where: { id: 'advisor' }, data: {
      tieneExperienciaCobranzasDigitales: null, fechaRespuestaExperiencia: null, fechaInduccionCompletada: null,
      fechaHistoriaCompletada: null, fechaMetodoCompletado: null,
    } });
    expect(mocks.audit).toHaveBeenCalledWith(tx, context, expect.objectContaining({ action: 'COURSE_RETRY_STARTED' }));
  });
  it('un fallo al archivar impide comenzar a retirar datos', async () => {
    tx.reactivationRequest.update.mockRejectedValue(new Error('No disponible'));
    await expect(reset()).rejects.toThrow('No disponible');
    expect(tx.attempt.deleteMany).not.toHaveBeenCalled();
    expect(tx.seal.deleteMany).not.toHaveBeenCalled();
  });
  it('no permite reiniciar a un asesor certificado', async () => {
    mocks.certified.mockRejectedValue(new Error('Certificado'));
    await expect(reset()).rejects.toThrow('Certificado');
    expect(tx.reactivationRequest.update).not.toHaveBeenCalled();
  });
});
