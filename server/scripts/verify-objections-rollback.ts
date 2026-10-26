// Verifica el recorrido real de PostgreSQL sin conservar cuentas, notas ni cambios de prueba.
// Ejecutar explícitamente: npx tsx server/scripts/verify-objections-rollback.ts --rollback
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { OBJECTIONS_CASES } from '../domain/objections-expert.js';
import { OBJECTIONS_KEYS } from '../domain/objections.js';
import { completeObjectionsBlock, objectionsState, practiceObjection, saveObjectionsAnswer, startObjectionsExam, submitObjectionsExam } from '../services/objections.service.js';
import { attemptResults } from '../services/evaluation-result.service.js';
import { retryReport } from '../services/retry-report.service.js';
import { certificationDossier } from '../services/certification.service.js';

if (!process.argv.includes('--rollback')) throw new Error('Usa --rollback para ejecutar esta verificación temporal.');
const ids = [randomUUID(), randomUUID(), randomUUID()];
const expectedRollback = new Error('ROLLBACK_VERIFICACION_OBJECIONES');
const briefAnswers = ['¿Qué día podría pagar?', 'Revisaré tus datos.', 'Envíame el comprobante.', '¿Qué horario prefiere?', '¿Cuándo recibe su sueldo?'];
let verified = false;
try {
  await prisma.$transaction(async tx => {
    const modules = await tx.trainingModule.findMany({ where: { slug: { in: ['ofimatica-mecanografia', 'induccion-cobranzas', 'simulador-cobranzas'] } } });
    const module = modules.find(m => m.slug === 'simulador-cobranzas')!;
    assert.ok(module);
    for (const id of ids) await tx.usuario.create({ data: { id, nombreCompleto: 'Asesor QA temporal de objeciones', numeroDocumento: `QA-OBJ-${id.slice(0, 12)}`,
      rol: 'asesor', estado: 'activo', passwordHash: 'QA-SIN-ACCESO', debeCompletarDatos: false, tieneExperienciaCobranzasDigitales: false } });
    await assert.rejects(() => startObjectionsExam(ids[2]!, tx), { code: 'MODULE_BLOCKED' });
    for (const [position, userId] of ids.slice(0, 2).entries()) {
      for (const prerequisite of modules.filter(m => m.id !== module.id)) await tx.seal.create({ data: { userId, moduleId: prerequisite.id } });
      let state = await objectionsState(userId, tx);
      assert.equal(state.percent, 0);
      assert.deepEqual(state.blocks.map(b => b.enabled), [true, true, true, true, true]);
      assert.equal(state.exam.canStart, true);
      // Las llamadas de pestañas antiguas tampoco deben escribir confirmaciones.
      state = await completeObjectionsBlock(userId, OBJECTIONS_KEYS[3], tx);
      assert.equal(state.percent, 0); assert.equal(state.complete, false);
      assert.equal(await tx.collectionsBlockProgress.count({ where: { userId, moduleId: module.id } }), 0);
      assert.equal(await tx.seal.count({ where: { userId, moduleId: module.id } }), 0);
      state = await startObjectionsExam(userId, tx);
      assert.equal(state.percent, 50);
      assert.equal(await tx.collectionsBlockProgress.count({ where: { userId, moduleId: module.id, blockKey: { in: [...OBJECTIONS_KEYS] } } }), 0);
      const attemptId = state.exam.draft!.attemptId;
      assert.equal((await startObjectionsExam(userId, tx)).exam.draft!.attemptId, attemptId);
      await assert.rejects(() => saveObjectionsAnswer(ids[2]!, attemptId, OBJECTIONS_KEYS[0], 'Texto de otra persona', tx));
      for (const [caseIndex, entry] of OBJECTIONS_CASES.slice(0, 4).entries()) await saveObjectionsAnswer(userId, attemptId, entry.key,
        position === 0 ? briefAnswers[caseIndex]! : 'Todavía no puedo desarrollar una gestión apropiada para esta situación de trabajo.', tx);
      await assert.rejects(() => submitObjectionsExam(userId, attemptId, tx), { code: 'VALIDATION_ERROR' });
      assert.equal((await tx.attempt.findUniqueOrThrow({ where: { id: attemptId } })).status, 'IN_PROGRESS');
      const last = OBJECTIONS_CASES[4];
      await saveObjectionsAnswer(userId, attemptId, last.key, position === 0 ? briefAnswers[4]! : 'Todavía no puedo desarrollar una gestión apropiada para esta situación de trabajo.', tx);
      const resumed = await objectionsState(userId, tx);
      assert.equal(resumed.exam.draft!.answers[last.key], position === 0 ? briefAnswers[4]! : 'Todavía no puedo desarrollar una gestión apropiada para esta situación de trabajo.');
      const sent = await submitObjectionsExam(userId, attemptId, tx);
      assert.equal(sent.result.score, position === 0 ? 100 : 0);
      assert.equal(sent.result.passed, position === 0);
      assert.equal(sent.result.version, 2);
      assert.equal(sent.state.complete, position === 0);
      assert.equal(await tx.seal.count({ where: { userId, moduleId: module.id, status: 'ACTIVE' } }), position === 0 ? 1 : 0);
      assert.equal((await submitObjectionsExam(userId, attemptId, tx)).alreadySubmitted, true);
      const details = (await attemptResults(tx, [attemptId])).get(attemptId)!;
      assert.equal(details.objections!.score, sent.result.score);
      assert.equal(details.objections!.cases.length, 5);
      assert.equal(details.objections!.version, 2);
      if (position === 0) assert.equal(details.objections!.cases[0]!.answer, briefAnswers[0]);
      const countBefore = await tx.attempt.count({ where: { userId } });
      await practiceObjection(userId, OBJECTIONS_KEYS[0], OBJECTIONS_CASES[0].example, tx);
      assert.equal(await tx.attempt.count({ where: { userId } }), countBefore);
      if (position === 1) {
        await assert.rejects(() => startObjectionsExam(userId, tx), { code: 'NO_ATTEMPTS_LEFT' });
        const report = await retryReport(userId, sent.state.exam.activityId, tx);
        assert.ok(report.recommendations.length > 0);
      }
      console.log(position === 0 ? 'Recorrido aprobado: borrador, recarga, 100 puntos, sello y doble envío verificados.' : 'Recorrido no aprobado: retroalimentación, intentos y constancia verificados.');
    }
    // Equivalencia histórica: se conserva el sello anterior sin fabricar una evaluación ni una nota.
    const historicalId = ids[2]!;
    for (const item of modules) await tx.seal.create({ data: { userId: historicalId, moduleId: item.id } });
    for (const activity of await tx.activity.findMany({ where: { moduleId: module.id, isRequired: true, status: 'ACTIVE' } })) {
      await tx.userActivityProgress.create({ data: { userId: historicalId, activityId: activity.id, status: 'PASSED' } });
    }
    const historical = await objectionsState(historicalId, tx);
    assert.equal(historical.complete, true); assert.equal(historical.reviewMode, true); assert.equal(historical.exam.result, null);
    await assert.rejects(() => startObjectionsExam(historicalId, tx), { code: 'REVIEW_MODE' });
    const dossier = await certificationDossier(historicalId, tx);
    const equivalent = dossier.activities.find(a => a.moduleSlug === 'simulador-cobranzas' && a.type === 'SIMULATOR')!;
    assert.equal(equivalent.passed, true); assert.equal(equivalent.evaluated, false); assert.equal(equivalent.lastScore, null);
    assert.equal(await tx.attempt.count({ where: { userId: historicalId } }), 0);
    console.log('Historial anterior conservado sin notas ficticias ni intentos nuevos.');
    verified = true;
    throw expectedRollback;
  }, { timeout: 240_000, maxWait: 15_000 });
} catch (error) {
  if (error !== expectedRollback) throw error;
} finally {
  const persisted = await prisma.usuario.count({ where: { id: { in: ids } } });
  await prisma.$disconnect();
  assert.equal(persisted, 0, 'Las cuentas QA deben revertirse.');
}
assert.equal(verified, true);
console.log('Verificación completa en PostgreSQL. Transacción revertida; 0 cuentas QA persistidas.');
