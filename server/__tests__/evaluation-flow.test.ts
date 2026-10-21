import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma.js';
import { COLLECTIONS_KEYS } from '../domain/collections.js';
import { EXAM_SECTIONS } from '../domain/collections-exam.js';
import { FINAL_EXAM_BANK } from '../domain/final-exam-bank.js';
import { OPTION_LETTERS } from '../domain/final-exam.js';
import { OBJECTIONS_KEYS } from '../domain/objections.js';
import type { TypificationDraft } from '../domain/tipifica/draft.js';
import { startAttempt } from '../services/attempt.service.js';
import { approveCertification, certificationDossier, myCertification } from '../services/certification.service.js';
import { completeCollectionsBlock, saveCollectionsExamSection, startCollectionsExam, submitCollectionsExam } from '../services/collections.service.js';
import { saveFinalExamAnswer, startFinalExam, submitFinalExam } from '../services/final-exam.service.js';
import { completeObjectionsBlock } from '../services/objections.service.js';
import { computeModuleState } from '../services/progress.service.js';
import { approveReactivation, requestReactivation } from '../services/reactivation.service.js';
import { submitTipificaExercise, tipificaState } from '../services/tipifica.service.js';
import { ORIGIN, createTestUser, loginAgent, passOfficeModule, resetRateLimits } from './helpers.js';

// Recorrido completo con evaluaciones oficiales: perfiles, un intento, Tipifica en la base, reactivaciones,
// examen general, validación del administrador, certificado único, modo repaso y resumen consolidado.

const SUITE = 'eval';
const base = { action: 'hacer-llamada', channel: 'telefonico', location: false, promiseDate: '', promiseAmount: '', callbackAt: '' } as const;
// Una tipificación correcta de cada audio (las mismas del sistema experto).
const GOOD: Record<number, TypificationDraft> = {
  1: { ...base, contact: 'directo', profile: 'No hubo acuerdo', reason: 'No cuenta con el dinero', phone: '3105550142', note: '3105550142 // TT VALIDA IDENTIDAD, SE INFORMA SALDO DE 285.000. INDICA QUE HA TENIDO GASTOS Y NO PUEDE COMPROMETERSE CON UNA FECHA, SE COMUNICARA POR LOS CANALES OFICIALES.' },
  2: { ...base, contact: 'indirecto', profile: 'Mensaje con tercero', reason: 'Ocupado', phone: '3125550216', note: '3125550216 // CONTESTA LA HERMANA, INDICA QUE EL TITULAR ESTA TRABAJANDO Y CASI NO CONTESTA EN EL DIA. NO SE DA INFORMACION DE LA OBLIGACION.' },
  3: { ...base, contact: 'directo', profile: 'Acuerdo de pago Abono', reason: 'Confirmar pago', phone: '3155550327', promiseDate: '2026-10-21', promiseAmount: '180000', note: '3155550327 // TT INDICA QUE REALIZARA UN ABONO DE 180.000 EL MIERCOLES 21 DE OCTUBRE POR CANALES OFICIALES.' },
  4: { ...base, contact: 'directo', profile: 'Volver a llamar', reason: 'Ocupado', phone: '3185550408', callbackAt: '2026-10-19T10:00', note: '3185550408 // TT INDICA QUE ESTA EN REUNION, SOLICITA VOLVER A LLAMAR EL LUNES A LAS 10 AM.' },
  5: { ...base, contact: 'directo', profile: 'PQR', reason: 'Con recibo', phone: '3115550593', note: '3115550593 // TT INDICA QUE PAGO 250 MIL EL 15 DE OCTUBRE POR TRANSFERENCIA, TIENE COMPROBANTE Y LO ENVIARA. QUEDA PENDIENTE DE VALIDACION.' },
  6: { ...base, contact: 'sin-contacto', profile: 'Número equivocado', reason: 'Número equivocado', phone: '3165550654', note: '3165550654 // CONTESTA UNA PERSONA QUE NO CONOCE AL TITULAR, NUMERO EQUIVOCADO. SE REPORTA PARA ACTUALIZAR.' },
};
// Válida para el formulario pero incorrecta para el audio 1 (perfil y motivo equivocados).
const WRONG_1: TypificationDraft = { ...GOOD[1]!, profile: 'Paz y Salvo', reason: 'Confirmar pago', note: '3105550142 // TT INDICA QUE YA PAGO TODO' };

const created: string[] = [];
let adminId = '';
let adminDocument = '';
const ctx = () => ({ actorUserId: adminId, requestId: 'eval-test', ip: '127.0.0.1' });

async function advisor(experienced: boolean) {
  const user = await createTestUser(SUITE);
  created.push(user.id);
  await prisma.usuario.update({ where: { id: user.id }, data: { tieneExperienciaCobranzasDigitales: experienced, fechaRespuestaExperiencia: new Date() } });
  return user.id;
}

async function passTheory(userId: string) {
  for (const key of COLLECTIONS_KEYS) await completeCollectionsBlock(userId, key);
}

async function presentDiagnostic(userId: string, correct: boolean) {
  await startCollectionsExam(userId);
  const answers: Record<string, string> = {};
  for (const section of EXAM_SECTIONS) {
    const own = Object.fromEntries(section.questions.map((question) => [question.key, question.kind === 'text'
      ? (correct ? question.example : 'No sé qué responder aquí.')
      : (correct ? question.options.find((option) => option.correct)! : question.options.find((option) => !option.correct)!).id]));
    await saveCollectionsExamSection(userId, section.key, own);
    Object.assign(answers, own);
  }
  return submitCollectionsExam(userId, answers);
}

async function reachTipifica(userId: string, experienced: boolean) {
  await passOfficeModule(userId);
  if (experienced) await presentDiagnostic(userId, false);
  await passTheory(userId);
  for (const key of OBJECTIONS_KEYS) await completeObjectionsBlock(userId, key);
}

async function passTipifica(userId: string) {
  for (const number of [1, 2, 3, 4, 5, 6]) await submitTipificaExercise(userId, number, GOOD[number]!);
}

async function passFinalExam(userId: string, correct = true) {
  const { questions } = await startFinalExam(userId);
  for (const { question } of questions) {
    const answer = FINAL_EXAM_BANK.find((item) => item.id === question.id)!.answer;
    await saveFinalExamAnswer(userId, question.id, OPTION_LETTERS[correct ? answer : (answer + 1) % 4]!);
  }
  return submitFinalExam(userId);
}

const attemptsOf = (userId: string, slug: string) => prisma.attempt.findMany({ where: { userId, evaluation: { activity: { module: { slug } } } }, orderBy: [{ startedAt: 'asc' }] });

beforeAll(async () => {
  resetRateLimits();
  const admin = await createTestUser(SUITE, { rol: 'administrador' });
  adminId = admin.id;
  adminDocument = admin.numeroDocumento;
  created.push(admin.id);
});

afterAll(async () => {
  // Limpieza de lo creado por la suite (de hijos a padres).
  const users = { userId: { in: created } };
  const attempts = (await prisma.attempt.findMany({ where: users, select: { id: true } })).map((row) => row.id);
  await prisma.reactivationRequest.deleteMany({ where: users });
  await prisma.trainingCompletionSummary.deleteMany({ where: users });
  await prisma.certificationDecision.deleteMany({ where: users });
  await prisma.certificate.deleteMany({ where: users });
  await prisma.seal.deleteMany({ where: users });
  await prisma.typificationResult.deleteMany({ where: { attemptId: { in: attempts } } });
  await prisma.attemptAnswer.deleteMany({ where: { attemptId: { in: attempts } } });
  await prisma.attempt.deleteMany({ where: users });
  await prisma.userActivityOverride.deleteMany({ where: users });
  await prisma.collectionsBlockProgress.deleteMany({ where: users });
  await prisma.userActivityProgress.deleteMany({ where: users });
  await prisma.userModuleProgress.deleteMany({ where: users });
  await prisma.adminAuditLog.deleteMany({ where: { actorUserId: { in: created } } });
  await prisma.usuario.deleteMany({ where: { id: { in: created } } });
});

describe('recorridos por perfil', () => {
  it('1. el asesor nuevo completa la inducción con la teoría, sin examen inicial', async () => {
    const userId = await advisor(false);
    await passOfficeModule(userId);
    await passTheory(userId);
    const induction = (await computeModuleState(userId)).find((view) => view.slug === 'induccion-cobranzas')!;
    expect(induction.hasSeal).toBe(true);
    await expect(startCollectionsExam(userId)).rejects.toMatchObject({ code: 'DIAGNOSTIC_NOT_APPLICABLE' });
    expect(await attemptsOf(userId, 'induccion-cobranzas')).toHaveLength(0);
  });

  it('2. el asesor con experiencia presenta el diagnóstico (un intento) y aun así debe hacer la teoría', async () => {
    const userId = await advisor(true);
    await passOfficeModule(userId);
    await expect(completeCollectionsBlock(userId, 'conceptos')).rejects.toMatchObject({ code: 'EXAM_FIRST' });
    const { result } = await presentDiagnostic(userId, true);
    expect(result.passed).toBe(true);
    // Aprobar el diagnóstico no completa el módulo ni abre el siguiente.
    let views = await computeModuleState(userId);
    expect(views.find((view) => view.slug === 'induccion-cobranzas')!.hasSeal).toBe(false);
    expect(views.find((view) => view.slug === 'simulador-cobranzas')!.enabled).toBe(false);
    await expect(startCollectionsExam(userId)).rejects.toMatchObject({ code: 'ALREADY_PASSED' });
    await passTheory(userId);
    views = await computeModuleState(userId);
    expect(views.find((view) => view.slug === 'induccion-cobranzas')!.hasSeal).toBe(true);
    const diagnostic = await attemptsOf(userId, 'induccion-cobranzas');
    expect(diagnostic).toHaveLength(1);
    expect(diagnostic[0]!.status).toBe('PASSED');
  });

  it('2b. si no aprueba el diagnóstico continúa su formación y no puede repetirlo sin autorización', async () => {
    const userId = await advisor(true);
    await passOfficeModule(userId);
    const { result } = await presentDiagnostic(userId, false);
    expect(result.passed).toBe(false);
    await expect(startCollectionsExam(userId)).rejects.toMatchObject({ code: 'NO_ATTEMPTS_LEFT' });
    await passTheory(userId);
    expect((await computeModuleState(userId)).find((view) => view.slug === 'induccion-cobranzas')!.hasSeal).toBe(true);
  });
});

describe('Tipifica oficial', () => {
  it('3, 4 y 5. un envío por ejercicio, doble clic sin doble consumo y seis resultados en PostgreSQL', async () => {
    const userId = await advisor(false);
    await reachTipifica(userId, false);
    // Un formulario incompleto no consume el intento.
    await expect(submitTipificaExercise(userId, 1, { ...GOOD[1]!, action: '' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(await attemptsOf(userId, 'tipificacion-llamadas')).toHaveLength(0);
    // Doble clic simultáneo: un solo intento.
    const [first, second] = await Promise.all([submitTipificaExercise(userId, 1, GOOD[1]!), submitTipificaExercise(userId, 1, GOOD[1]!)]);
    expect(first.result.attemptId).toBe(second.result.attemptId);
    expect([first.alreadySubmitted, second.alreadySubmitted].sort()).toEqual([false, true]);
    // Un segundo envío (otro navegador, recarga) devuelve el resultado guardado.
    const again = await submitTipificaExercise(userId, 1, WRONG_1);
    expect(again.alreadySubmitted).toBe(true);
    expect(again.result.passed).toBe(true);
    for (const number of [2, 3, 4, 5, 6]) await submitTipificaExercise(userId, number, GOOD[number]!);
    const attempts = await attemptsOf(userId, 'tipificacion-llamadas');
    expect(attempts).toHaveLength(6);
    const results = await prisma.typificationResult.findMany({ where: { attemptId: { in: attempts.map((attempt) => attempt.id) } } });
    expect(results).toHaveLength(6);
    expect(results.every((row) => row.unmetCount === 0 && row.rulesVersion === 1 && Array.isArray(row.checks))).toBe(true);
    const state = await tipificaState(userId);
    expect(state.passed).toBe(true);
    expect((await computeModuleState(userId)).find((view) => view.slug === 'tipificacion-llamadas')!.hasSeal).toBe(true);
  });

  it('6. la reactivación de un ejercicio conserva los anteriores y su intento fallido', async () => {
    const userId = await advisor(false);
    await reachTipifica(userId, false);
    const failed = await submitTipificaExercise(userId, 1, WRONG_1);
    expect(failed.result.passed).toBe(false);
    expect(Number(failed.result.score)).toBeLessThan(100);
    for (const number of [2, 3, 4, 5, 6]) await submitTipificaExercise(userId, number, GOOD[number]!);
    let state = await tipificaState(userId);
    expect(state.exercises[0]!.status).toBe('NO_APROBADO');
    expect(state.passed).toBe(false);
    // Sin autorización no hay segundo envío: devuelve el intento fallido.
    expect((await submitTipificaExercise(userId, 1, GOOD[1]!)).alreadySubmitted).toBe(true);
    // Solicitud: dos clics simultáneos dejan una sola pendiente.
    const activityId = state.exercises[0]!.activityId!;
    const [r1, r2] = await Promise.all([requestReactivation(userId, activityId, 'Me equivoqué de perfil'), requestReactivation(userId, activityId, null)]);
    expect(r1.request.id).toBe(r2.request.id);
    expect(await prisma.reactivationRequest.count({ where: { userId, status: 'PENDING' } })).toBe(1);
    expect((await tipificaState(userId)).exercises[0]!.status).toBe('REACTIVACION_SOLICITADA');
    const approved = await approveReactivation(r1.request.id, 'Autorizado por coordinación', ctx());
    expect(approved.status).toBe('APPROVED');
    expect((await approveReactivation(r1.request.id, 'Autorizado por coordinación', ctx())).overrideId).toBe(approved.overrideId);
    state = await tipificaState(userId);
    expect(state.exercises[0]!.status).toBe('REACTIVADO');
    expect(state.exercises.slice(1).every((exercise) => exercise.status === 'APROBADO')).toBe(true);
    const retry = await submitTipificaExercise(userId, 1, GOOD[1]!);
    expect(retry.alreadySubmitted).toBe(false);
    expect(retry.result.number).toBe(2);
    expect(retry.result.reactivated).toBe(true);
    const attempts = await attemptsOf(userId, 'tipificacion-llamadas');
    expect(attempts).toHaveLength(7);
    expect(attempts.filter((attempt) => attempt.status === 'FAILED')).toHaveLength(1);
    expect((await tipificaState(userId)).passed).toBe(true);
    const audit = await prisma.adminAuditLog.findMany({ where: { entityId: r1.request.id } });
    expect(audit.map((row) => row.action)).toContain('REACTIVATION_REQUEST_APPROVED');
  });
});

describe('examen general y certificación', () => {
  let certifiedUser = '';

  it('7 y 8. el examen general es obligatorio para los dos perfiles y no se certifica sin él', async () => {
    for (const experienced of [false, true]) {
      const userId = await advisor(experienced);
      await reachTipifica(userId, experienced);
      await passTipifica(userId);
      const status = await myCertification(userId);
      expect(status.status).toBe('EN_FORMACION');
      expect(status.missing.join(' ')).toContain('Examen general');
      await expect(approveCertification(userId, null, ctx())).rejects.toMatchObject({ code: 'CERTIFICATE_NOT_ELIGIBLE' });
      const start = await startFinalExam(userId);
      expect(start.questions).toHaveLength(30);
      // Las respuestas correctas nunca viajan al navegador durante el examen.
      expect(JSON.stringify(start.questions)).not.toMatch(/"answer"|explanation/);
      const exam = await passFinalExam(userId);
      expect(exam.result.passed).toBe(true);
      expect((await myCertification(userId)).status).toBe('PENDIENTE_VALIDACION');
      certifiedUser = userId;
    }
  });

  it('9. solo un administrador autorizado aprueba la certificación', async () => {
    const advisorUser = await prisma.usuario.findUniqueOrThrow({ where: { id: certifiedUser } });
    const { agent } = await loginAgent(advisorUser.numeroDocumento, 'asesor');
    const denied = await agent.post(`/api/admin/certifications/${certifiedUser}/approve`).set(ORIGIN).send({});
    expect(denied.status).toBe(403);
    await expect(approveCertification(certifiedUser, null, { actorUserId: certifiedUser })).rejects.toMatchObject({ code: 'ADMIN_REQUIRED' });
    expect(await prisma.certificate.count({ where: { userId: certifiedUser } })).toBe(0);
  });

  it('10. la emisión es única e idempotente aunque lleguen dos aprobaciones a la vez', async () => {
    const [a, b] = await Promise.all([approveCertification(certifiedUser, 'Cumple', ctx()), approveCertification(certifiedUser, 'Cumple', ctx())]);
    expect(a.certificate.id).toBe(b.certificate.id);
    expect([a.created, b.created].sort()).toEqual([false, true]);
    expect(await prisma.certificate.count({ where: { userId: certifiedUser } })).toBe(1);
    expect(await prisma.trainingCompletionSummary.count({ where: { userId: certifiedUser } })).toBe(1);
    const { agent } = await loginAgent(adminDocument, 'administrador');
    const again = await agent.post(`/api/admin/certifications/${certifiedUser}/approve`).set(ORIGIN).send({});
    expect(again.status).toBe(200);
    const pdf = await agent.get(`/api/admin/certificates/${a.certificate.id}/pdf`).set(ORIGIN);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(Buffer.from(pdf.body).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('11. el certificado repasa todos los módulos sin cambiar los resultados oficiales', async () => {
    const before = await prisma.attempt.count({ where: { userId: certifiedUser } });
    const views = await computeModuleState(certifiedUser);
    expect(views.every((view) => view.enabled)).toBe(true);
    const typing = (await prisma.activity.findFirstOrThrow({ where: { type: 'TYPING' } })).id;
    await expect(startAttempt(certifiedUser, typing)).rejects.toMatchObject({ code: 'REVIEW_MODE' });
    await expect(startFinalExam(certifiedUser)).rejects.toMatchObject({ code: 'REVIEW_MODE' });
    const tipifica = await tipificaState(certifiedUser);
    expect(tipifica.reviewMode).toBe(true);
    await completeCollectionsBlock(certifiedUser, 'conceptos');
    expect(await prisma.attempt.count({ where: { userId: certifiedUser } })).toBe(before);
    expect((await myCertification(certifiedUser)).status).toBe('CERTIFICADO');
  });

  it('12. el historial consolidado conserva la trazabilidad', async () => {
    const summary = await prisma.trainingCompletionSummary.findFirstOrThrow({ where: { userId: certifiedUser } });
    const certificate = await prisma.certificate.findFirstOrThrow({ where: { userId: certifiedUser, status: 'ACTIVE' } });
    expect(summary).toMatchObject({ certificateId: certificate.id, certificateCode: certificate.code, approvedById: adminId, typificationPassed: 6, typificationTotal: 6, trainingProfile: 'CON_EXPERIENCIA', planVersion: 1, cycle: 1 });
    expect(Number(summary.finalExamScore)).toBe(100);
    expect(summary.diagnosticScore).not.toBeNull();
    // Los datos originales siguen ahí: intentos, auditoría y decisión.
    expect(await prisma.attempt.count({ where: { userId: certifiedUser } })).toBeGreaterThanOrEqual(11);
    expect(await prisma.adminAuditLog.count({ where: { action: { in: ['CERTIFICATION_APPROVED', 'CERTIFICATE_ISSUED'] }, OR: [{ entityId: certificate.id }, { afterJson: { path: ['userId'], equals: certifiedUser } }] } })).toBe(2);
    const dossier = await certificationDossier(certifiedUser);
    expect(dossier.status).toBe('CERTIFICADO');
    expect(dossier.typification.every((activity) => activity.passed)).toBe(true);
    expect(dossier.summaries).toHaveLength(1);
  });
});
