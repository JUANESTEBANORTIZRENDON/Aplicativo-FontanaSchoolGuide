import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../app.js';
import { prisma } from '../config/prisma.js';
import { COLLECTIONS_BLOCKS, COLLECTIONS_EXAM, EXAM_SECTIONS } from '../domain/collections.js';
import { activityIds, cleanupSuite, createTestUser, loginAgent, ORIGIN } from './helpers.js';

const SUITE = 'cobranzas';
const BASE = '/api/training/collections';
// Las primeras `wrong` preguntas del examen se responden mal y el resto bien.
const examAnswers = (wrong = 0) => Object.fromEntries(COLLECTIONS_EXAM.map((q, index) => [q.key, q.kind === 'text' ? (index >= wrong ? q.example : 'No s\u00e9.') : q.options.find((o) => o.correct === (index >= wrong) && (index >= wrong || !o.critical))!.id]));
const correct = (index: number) => Object.fromEntries(COLLECTIONS_BLOCKS[index]!.questions.map((q) => [q.key, q.options.find((o) => o.correct)!.id]));

async function sendExam(agent: Awaited<ReturnType<typeof loginAgent>>['agent'], answers: Record<string, string>) {
  expect((await agent.post(`${BASE}/exam/start`).set(ORIGIN).send({})).status).toBe(200);
  for (const section of EXAM_SECTIONS) {
    const saved = await agent.post(`${BASE}/exam/sections/${section.key}`).set(ORIGIN).send({ answers: Object.fromEntries(section.questions.map((q) => [q.key, answers[q.key]])) });
    expect(saved.status).toBe(200);
    expect(saved.body.data).not.toHaveProperty('result');
  }
  return agent.post(`${BASE}/exam`).set(ORIGIN).send({ answers });
}

describe('módulo 02: práctica de cobranzas', () => {
  afterAll(() => cleanupSuite(SUITE));

  it('guarda las secciones sin calificar y exige orden antes de permitir el envío final', async () => {
    const user = await createTestUser(SUITE);
    const { modules } = await activityIds();
    await prisma.usuario.update({ where: { id: user.id }, data: { tieneExperienciaCobranzasDigitales: true } });
    await prisma.seal.create({ data: { userId: user.id, moduleId: modules.m1.id, status: 'ACTIVE' } });
    const { agent } = await loginAgent(user.numeroDocumento, 'asesor');
    expect((await agent.post(`${BASE}/exam/start`).set(ORIGIN).send({})).status).toBe(200);
    const answers = examAnswers();
    const later = EXAM_SECTIONS[1]!;
    expect((await agent.post(`${BASE}/exam/sections/${later.key}`).set(ORIGIN).send({ answers: Object.fromEntries(later.questions.map((q) => [q.key, answers[q.key]])) })).body.code).toBe('PREVIOUS_SECTION_REQUIRED');
    const first = { 'inicio-accion': 'saldo', 'inicio-guion': 'No sé.' };
    const saved = await agent.post(`${BASE}/exam/sections/inicio`).set(ORIGIN).send({ answers: first });
    expect(saved.status).toBe(200); expect(saved.body.data.sectionIndex).toBe(1);
    expect(saved.body.data).not.toHaveProperty('result'); expect(saved.body.data).not.toHaveProperty('score');
    const resumed = (await agent.get(`${BASE}/module`)).body.data;
    expect(resumed.exam.draft.answers).toEqual(first); expect(resumed.exam.attempts).toBe(0);
    expect(resumed.exam.lastResult).toBeNull(); expect(resumed.completedCount).toBe(0);
    expect((await agent.post(`${BASE}/exam`).set(ORIGIN).send({ answers })).status).toBe(400);
    expect((await agent.post(`${BASE}/exam/sections/inicio`).set(ORIGIN).send({ answers: { ...first, 'inicio-accion': 'identificar' } })).body.code).toBe('PREVIOUS_SECTION_REQUIRED');
  });

  it('exige sesión, perfil completo y experiencia declarada', async () => {
    expect((await request(app).get(`${BASE}/module`)).status).toBe(401);
    const user = await createTestUser(SUITE);
    const { agent } = await loginAgent(user.numeroDocumento, 'asesor');
    expect((await agent.get(`${BASE}/module`)).status).toBe(403);
    await prisma.usuario.update({ where: { id: user.id }, data: { tieneExperienciaCobranzasDigitales: true } });
    expect((await agent.get(`${BASE}/module`)).body.code).toBe('MODULE_BLOCKED');
    await prisma.usuario.update({ where: { id: user.id }, data: { tieneExperienciaCobranzasDigitales: false, debeCompletarDatos: true } });
    expect((await agent.get(`${BASE}/module`)).body.code).toBe('PROFILE_INCOMPLETE');
  });

  it('valida prerrequisitos, reintentos, persistencia, secuencia y sello único', async () => {
    const user = await createTestUser(SUITE);
    await prisma.usuario.update({ where: { id: user.id }, data: { tieneExperienciaCobranzasDigitales: false } });
    const { agent } = await loginAgent(user.numeroDocumento, 'asesor');
    expect((await agent.get(`${BASE}/module`)).body.code).toBe('MODULE_BLOCKED');
    const admin = await createTestUser(SUITE, { rol: 'administrador' });
    const { agent: adminAgent } = await loginAgent(admin.numeroDocumento, 'administrador');
    const { induction, modules } = await activityIds();
    const unlocked = await adminAgent.post(`/api/admin/advisors/${user.id}/activities/${induction}/reactivate`).set(ORIGIN).set('Idempotency-Key', randomUUID()).send({ action: 'UNLOCK', reason: 'Prueba aislada del avance de los cinco bloques de inducción' });
    expect(unlocked.status).toBe(201);
    const initial = (await agent.get(`${BASE}/module`)).body.data;
    expect(initial.blocks[0].enabled).toBe(true);
    expect(initial.blocks[1].content).toBeNull();
    expect((await agent.post(`${BASE}/blocks/preparacion`).set(ORIGIN).send({ answers: correct(1) })).body.code).toBe('PREVIOUS_BLOCK_REQUIRED');
    expect((await agent.post(`${BASE}/blocks/conceptos`).set(ORIGIN).send({ answers: {}, passed: true })).status).toBe(400);
    const wrong = { ...correct(0), promesa: 'confirmado' };
    for (let attempt = 0; attempt < 4; attempt++) {
      const failed = await agent.post(`${BASE}/blocks/conceptos`).set(ORIGIN).send({ answers: wrong });
      expect(failed.status).toBe(200);
      expect(failed.body.data.passed).toBe(false);
      expect(failed.body.data.percent).toBe(0);
    }
    for (let index = 0; index < COLLECTIONS_BLOCKS.length; index++) {
      const saved = await agent.post(`${BASE}/blocks/${COLLECTIONS_BLOCKS[index]!.key}`).set(ORIGIN).send({ answers: correct(index) });
      expect(saved.status).toBe(200);
      expect(saved.body.data.percent).toBe((index + 1) * 16);
    }
    // La teoría completa no emite el sello: falta aprobar el examen final (80/100 y sin errores criticos).
    expect(await prisma.seal.count({ where: { userId: user.id, moduleId: modules.induction.id, status: 'ACTIVE' } })).toBe(0);
    const failedExam = await sendExam(agent, examAnswers(4));
    expect(failedExam.body.data.result).toMatchObject({ passed: false, score: 75 });
    expect(failedExam.body.data.state.complete).toBe(false);
    const passedExam = await sendExam(agent, examAnswers(2));
    expect(passedExam.body.data.result).toMatchObject({ passed: true, score: 85 });
    const historyUrl = `/api/admin/advisors/${user.id}/collections-exams`;
    expect((await request(app).get(historyUrl)).status).toBe(401);
    expect((await agent.get(historyUrl)).status).toBe(403);
    const history = await adminAgent.get(historyUrl);
    expect(history.status).toBe(200);
    expect(history.body.data.advisor.id).toBe(user.id);
    expect(history.body.data.items.map((item: { attempt: number }) => item.attempt)).toEqual([2, 1]);
    expect(history.body.data.items[0]).toMatchObject({ score: 85, verdict: 'Apto' });
    const report = await adminAgent.get(`${historyUrl}/${history.body.data.items[1].id}`);
    expect(report.status).toBe(200);
    expect(report.body.data.result.sections).toHaveLength(7);
    expect(report.body.data.result).toMatchObject({ score: 75, verdict: 'Requiere refuerzo' });
    expect(report.body.data.coaching.improvements.length).toBeGreaterThan(0);
    expect(report.body.data.coachingSaved).toBe(true);
    const resumed = await loginAgent(user.numeroDocumento, 'asesor');
    const state = (await resumed.agent.get(`${BASE}/module`)).body.data;
    expect(state.complete).toBe(true);
    expect(state.blocks[0].attempts).toBe(5);
    expect(state.blocks.every((block: { completed: boolean }) => block.completed)).toBe(true);
    expect(await prisma.seal.count({ where: { userId: user.id, moduleId: modules.induction.id, status: 'ACTIVE' } })).toBe(1);
    await resumed.agent.post(`${BASE}/blocks/seguimiento`).set(ORIGIN).send({ answers: correct(4) });
    expect(await prisma.seal.count({ where: { userId: user.id, moduleId: modules.induction.id, status: 'ACTIVE' } })).toBe(1);
    expect((await resumed.agent.get('/api/advisor/modules')).body.data.find((m: { slug: string }) => m.slug === 'induccion-cobranzas')).toMatchObject({ status: 'PASSED', progressPercent: '100.00', enabled: false });
  });

  it('guarda cada pregunta, conserva aciertos y mantiene cerrado el bloque siguiente hasta resolver todas', async () => {
    const user = await createTestUser(SUITE);
    const { modules } = await activityIds();
    await prisma.usuario.update({ where: { id: user.id }, data: { tieneExperienciaCobranzasDigitales: false } });
    await prisma.seal.create({ data: { userId: user.id, moduleId: modules.m1.id, status: 'ACTIVE' } });
    const { agent } = await loginAgent(user.numeroDocumento, 'asesor');
    const endpoint = `${BASE}/blocks/conceptos/questions/cartera`;
    const failed = await agent.post(endpoint).set(ORIGIN).send({ answer: 'saldo' });
    expect(failed.status).toBe(200);
    expect(failed.body.data.questionResult.correct).toBe(false);
    expect(failed.body.data.correctCount).toBe(0);
    expect((await agent.post(endpoint).set(ORIGIN).send({ answer: 'cartera' })).body.data.correctCount).toBe(1);
    const retained = await agent.post(endpoint).set(ORIGIN).send({ answer: 'saldo' });
    expect(retained.body.data.answers.cartera).toBe('cartera');
    expect(retained.body.data.correctKeys).toEqual(['cartera']);
    const state = (await agent.get(`${BASE}/module`)).body.data;
    expect(state.blocks[0].feedback.correctKeys).toEqual(['cartera']);
    expect(state.blocks[1].enabled).toBe(false);
    expect(state.blocks[1].content).toBeNull();
    expect((await agent.post(`${BASE}/blocks/conceptos/questions/inventada`).set(ORIGIN).send({ answer: 'cartera' })).status).toBe(400);
    for (const question of COLLECTIONS_BLOCKS[0]!.questions.slice(1)) {
      expect((await agent.post(`${BASE}/blocks/conceptos/questions/${question.key}`).set(ORIGIN).send({ answer: question.options.find((option) => option.correct)!.id })).status).toBe(200);
    }
    const resumed = await loginAgent(user.numeroDocumento, 'asesor');
    const saved = (await resumed.agent.get(`${BASE}/module`)).body.data;
    expect(saved.blocks[0].completed).toBe(true);
    expect(saved.blocks[1].enabled).toBe(true);
    expect(saved.percent).toBe(16);
  });

  it('permite continuar desde las tarjetas sin cuestionario y conserva el avance al repetir', async () => {
    const user = await createTestUser(SUITE);
    const { modules } = await activityIds();
    await prisma.usuario.update({ where: { id: user.id }, data: { tieneExperienciaCobranzasDigitales: false } });
    await prisma.seal.create({ data: { userId: user.id, moduleId: modules.m1.id, status: 'ACTIVE' } });
    const { agent } = await loginAgent(user.numeroDocumento, 'asesor');
    const endpoint = `${BASE}/blocks/conceptos/complete`;
    expect((await request(app).post(endpoint).set(ORIGIN).send({})).status).toBe(401);
    expect((await agent.post(endpoint).set(ORIGIN).send({ completedKeys: ['seguimiento'] })).status).toBe(400);
    const continued = await agent.post(endpoint).set(ORIGIN).send({});
    expect(continued.status).toBe(200);
    expect(continued.body.data).toMatchObject({ percent: 16, complete: false, currentBlock: 'preparacion' });
    expect(continued.body.data.blocks[0]).toMatchObject({ completed: true, attempts: 0, answers: {} });
    expect(continued.body.data.blocks[1].enabled).toBe(true);
    expect(continued.body.data.blocks[2].enabled).toBe(false);
    expect((await agent.get('/api/advisor/modules')).body.data.find((module: { slug: string }) => module.slug === 'induccion-cobranzas').progressPercent).toBe('16.00');
    expect((await agent.post(`${BASE}/blocks/contacto`).set(ORIGIN).send({ answers: correct(2) })).body.code).toBe('PREVIOUS_BLOCK_REQUIRED');
    expect((await agent.post(`${BASE}/blocks/preparacion`).set(ORIGIN).send({ answers: correct(1) })).status).toBe(200);
    const repeated = await agent.post(endpoint).set(ORIGIN).send({});
    expect(repeated.body.data.percent).toBe(32);
    expect(repeated.body.data.blocks[1]).toMatchObject({ completed: true, enabled: true });
    expect((await agent.post(`${BASE}/blocks/conceptos/reset`).set(ORIGIN).send({ confirm: true })).status).toBe(404);
    const resumed = await loginAgent(user.numeroDocumento, 'asesor');
    expect((await resumed.agent.get(`${BASE}/module`)).body.data.blocks[1]).toMatchObject({ completed: true, enabled: true });
    // Los demás bloques también se completan con su reto rápido, en orden.
    expect((await resumed.agent.post(`${BASE}/blocks/alternativas/complete`).set(ORIGIN).send({})).body.code).toBe('PREVIOUS_BLOCK_REQUIRED');
    expect((await resumed.agent.post(`${BASE}/blocks/contacto/complete`).set(ORIGIN).send({})).body.data).toMatchObject({ percent: 48, currentBlock: 'alternativas' });
    expect(await prisma.seal.count({ where: { userId: user.id, moduleId: modules.induction.id, status: 'ACTIVE' } })).toBe(0);
  });

  it('quien tiene experiencia empieza por el examen y, si no lo aprueba, recorre la teoría', async () => {
    const user = await createTestUser(SUITE);
    const { modules } = await activityIds();
    await prisma.usuario.update({ where: { id: user.id }, data: { tieneExperienciaCobranzasDigitales: true } });
    await prisma.seal.create({ data: { userId: user.id, moduleId: modules.m1.id, status: 'ACTIVE' } });
    const { agent } = await loginAgent(user.numeroDocumento, 'asesor');
    const initial = (await agent.get(`${BASE}/module`)).body.data;
    expect(initial).toMatchObject({ experienced: true, theoryRequired: false, currentBlock: 'examen', percent: 0 });
    expect(initial.exam.enabled).toBe(true);
    expect(initial.blocks.every((block: { enabled: boolean }) => !block.enabled)).toBe(true);
    expect((await agent.post(`${BASE}/blocks/conceptos/complete`).set(ORIGIN).send({})).body.code).toBe('EXAM_FIRST');
    expect((await agent.post(`${BASE}/exam`).set(ORIGIN).send({ answers: { reporte: 'reportado' } })).status).toBe(400);
    const failed = (await sendExam(agent, examAnswers(5))).body.data;
    expect(failed.result.passed).toBe(false);
    expect(failed.state).toMatchObject({ theoryRequired: true, currentBlock: 'conceptos' });
    expect(failed.state.exam.enabled).toBe(false);
    expect(failed.state.blocks[0].enabled).toBe(true);
    expect((await agent.post(`${BASE}/exam/start`).set(ORIGIN).send({})).body.code).toBe('THEORY_REQUIRED');
    for (let index = 0; index < COLLECTIONS_BLOCKS.length; index++) {
      expect((await agent.post(`${BASE}/blocks/${COLLECTIONS_BLOCKS[index]!.key}`).set(ORIGIN).send({ answers: correct(index) })).status).toBe(200);
    }
    const passed = (await sendExam(agent, examAnswers())).body.data;
    expect(passed.result).toMatchObject({ passed: true, score: 100 });
    expect(passed.state).toMatchObject({ complete: true, percent: 100 });
    expect(await prisma.seal.count({ where: { userId: user.id, moduleId: modules.induction.id, status: 'ACTIVE' } })).toBe(1);
  });

  it('quien tiene experiencia y aprueba el examen pasa directo al simulador', async () => {
    const user = await createTestUser(SUITE);
    const { modules } = await activityIds();
    await prisma.usuario.update({ where: { id: user.id }, data: { tieneExperienciaCobranzasDigitales: true } });
    await prisma.seal.create({ data: { userId: user.id, moduleId: modules.m1.id, status: 'ACTIVE' } });
    const { agent } = await loginAgent(user.numeroDocumento, 'asesor');
    const passed = (await sendExam(agent, examAnswers(2))).body.data;
    expect(passed.result.passed).toBe(true);
    expect(passed.state).toMatchObject({ complete: true, percent: 100, theoryRequired: false });
    const views = (await agent.get('/api/advisor/modules')).body.data;
    expect(views.find((m: { slug: string }) => m.slug === 'induccion-cobranzas')).toMatchObject({ status: 'PASSED' });
    expect(views.find((m: { slug: string }) => m.slug === 'simulador-cobranzas').enabled).toBe(true);
  });
});
