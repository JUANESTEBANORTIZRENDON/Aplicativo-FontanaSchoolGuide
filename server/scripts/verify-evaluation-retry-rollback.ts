// Verificación transaccional real: no conserva cuentas, notas ni solicitudes QA.
// npx tsx server/scripts/verify-evaluation-retry-rollback.ts --rollback
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { activateSelfRetry, evaluationRetryState } from '../services/evaluation-retry.service.js';
import { approveReactivation, requestReactivation } from '../services/reactivation.service.js';
import { objectionsState, startObjectionsExam, saveObjectionsAnswer, submitObjectionsExam } from '../services/objections.service.js';
import { OBJECTIONS_CASES } from '../domain/objections-expert.js';
import { selfRetryKey } from '../domain/evaluation-retry.js';

if (!process.argv.includes('--rollback')) throw new Error('Ejecuta con --rollback.');
const userId = randomUUID(), adminId = randomUUID();
const rollback = new Error('ROLLBACK_VERIFICACION_REINTENTO');
let verified = false;
try {
  await prisma.$transaction(async tx => {
    for (const [id, rol] of [[userId, 'asesor'], [adminId, 'administrador']] as const) {
      await tx.usuario.create({ data: { id, rol, nombreCompleto: 'QA temporal de reintento', numeroDocumento: `QA-RETRY-${id.slice(0, 12)}`,
        estado: 'activo', passwordHash: 'QA-SIN-ACCESO', debeCompletarDatos: false, tieneExperienciaCobranzasDigitales: false } });
    }
    const prerequisites = await tx.trainingModule.findMany({ where: { slug: { in: ['ofimatica-mecanografia', 'induccion-cobranzas'] } } });
    assert.equal(prerequisites.length, 2);
    for (const module of prerequisites) await tx.seal.create({ data: { userId, moduleId: module.id } });
    const originalSeals = await tx.seal.findMany({ where: { userId }, orderBy: { id: 'asc' } });
    let state = await objectionsState(userId, tx);
    const activityId = state.exam.activityId;
    for (let number = 1; number <= 2; number++) {
      state = await startObjectionsExam(userId, tx);
      assert.equal(state.exam.draft!.number, number);
      for (const entry of OBJECTIONS_CASES) await saveObjectionsAnswer(userId, state.exam.draft!.attemptId, entry.key,
        'Todavía no puedo desarrollar una gestión apropiada para esta situación de trabajo.', tx);
      const result = await submitObjectionsExam(userId, state.exam.draft!.attemptId, tx);
      assert.equal(result.result.passed, false);
      assert.equal(result.result.score, 0);
      await assert.rejects(() => startObjectionsExam(userId, tx), { code: 'NO_ATTEMPTS_LEFT' });
      const retry = await evaluationRetryState(userId, activityId, tx);
      assert.equal(retry.phase, number === 1 ? 'SELF_RETRY_AVAILABLE' : 'SUPPORT_REQUIRED');
      if (number === 1) {
        await assert.rejects(() => requestReactivation(userId, activityId, null, new Date(), tx), { code: 'SELF_RETRY_AVAILABLE' });
        assert.equal((await activateSelfRetry(userId, activityId, new Date(), tx)).activated, true);
        assert.equal((await activateSelfRetry(userId, activityId, new Date(), tx)).alreadyActivated, true);
        assert.equal((await evaluationRetryState(userId, activityId, tx)).phase, 'RETRY_READY');
      } else {
        assert.equal((await activateSelfRetry(userId, activityId, new Date(), tx)).activated, false);
      }
    }
    assert.equal(await tx.userActivityOverride.count({ where: { idempotencyKey: selfRetryKey(userId, activityId) } }), 1);
    const support = await requestReactivation(userId, activityId, 'Necesito acompañamiento.', new Date(), tx);
    assert.equal(support.request.restartCourse, false);
    assert.equal(support.created, true);
    assert.equal((await requestReactivation(userId, activityId, null, new Date(), tx)).created, false);
    assert.equal((await evaluationRetryState(userId, activityId, tx)).phase, 'SUPPORT_PENDING');
    await assert.rejects(() => activateSelfRetry(userId, activityId, new Date(), tx), { code: 'SUPPORT_PENDING' });
    const approved = await approveReactivation(support.request.id, 'Acompañamiento realizado.', { actorUserId: adminId }, new Date(), tx);
    assert.equal(approved.restartCourse, false);
    assert.equal(approved.hasArchive, false);
    assert.ok(approved.overrideId);
    assert.equal((await approveReactivation(support.request.id, 'Doble clic.', { actorUserId: adminId }, new Date(), tx)).overrideId, approved.overrideId);
    state = await startObjectionsExam(userId, tx);
    assert.equal(state.exam.draft!.number, 3);
    assert.equal(await tx.attempt.count({ where: { userId, submittedAt: { not: null } } }), 2);
    assert.equal(await tx.userActivityOverride.count({ where: { userId } }), 2);
    assert.deepEqual(await tx.seal.findMany({ where: { userId }, orderBy: { id: 'asc' } }), originalSeals);
    assert.equal(await tx.certificate.count({ where: { userId } }), 0);
    console.log('Verificados: dos intentos, cupo único, bloqueo del tercero, acompañamiento, autorización individual, idempotencia e historial conservado.');
    verified = true;
    throw rollback;
  }, { timeout: 240_000, maxWait: 15_000 });
} catch (error) {
  if (error !== rollback) throw error;
} finally { await prisma.$disconnect(); }
assert.ok(verified);
console.log('ROLLBACK completado: no se conservaron datos temporales.');
