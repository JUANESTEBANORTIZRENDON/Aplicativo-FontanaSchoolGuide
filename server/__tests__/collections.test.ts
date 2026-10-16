import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../app.js';
import { prisma } from '../config/prisma.js';
import { COLLECTIONS_BLOCKS } from '../domain/collections.js';
import { activityIds, cleanupSuite, createTestUser, loginAgent, ORIGIN } from './helpers.js';

const SUITE = 'cobranzas';
const BASE = '/api/training/collections';
const correct = (index: number) => Object.fromEntries(COLLECTIONS_BLOCKS[index]!.questions.map((q) => [q.key, q.options.find((o) => o.correct)!.id]));

describe('módulo 02: práctica de cobranzas', () => {
  afterAll(() => cleanupSuite(SUITE));

  it('exige sesión, perfil completo y experiencia declarada como nueva', async () => {
    expect((await request(app).get(`${BASE}/module`)).status).toBe(401);
    const user = await createTestUser(SUITE);
    const { agent } = await loginAgent(user.numeroDocumento, 'asesor');
    expect((await agent.get(`${BASE}/module`)).status).toBe(403);
    await prisma.usuario.update({ where: { id: user.id }, data: { tieneExperienciaCobranzasDigitales: true } });
    expect((await agent.get(`${BASE}/module`)).body.code).toBe('NEW_ADVISOR_REQUIRED');
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
      expect(saved.body.data.percent).toBe((index + 1) * 20);
    }
    const resumed = await loginAgent(user.numeroDocumento, 'asesor');
    const state = (await resumed.agent.get(`${BASE}/module`)).body.data;
    expect(state.complete).toBe(true);
    expect(state.blocks[0].attempts).toBe(5);
    expect(state.blocks.every((block: { completed: boolean }) => block.completed)).toBe(true);
    expect(await prisma.seal.count({ where: { userId: user.id, moduleId: modules.induction.id, status: 'ACTIVE' } })).toBe(1);
    await resumed.agent.post(`${BASE}/blocks/seguimiento`).set(ORIGIN).send({ answers: correct(4) });
    expect(await prisma.seal.count({ where: { userId: user.id, moduleId: modules.induction.id, status: 'ACTIVE' } })).toBe(1);
    expect((await resumed.agent.get('/api/advisor/modules')).body.data.find((m: { slug: string }) => m.slug === 'induccion-cobranzas')).toMatchObject({ status: 'PASSED', progressPercent: '100.00', enabled: true });
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
    expect(saved.percent).toBe(20);
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
    expect(continued.body.data).toMatchObject({ percent: 20, complete: false, currentBlock: 'preparacion' });
    expect(continued.body.data.blocks[0]).toMatchObject({ completed: true, attempts: 0, answers: {} });
    expect(continued.body.data.blocks[1].enabled).toBe(true);
    expect(continued.body.data.blocks[2].enabled).toBe(false);
    expect((await agent.post(`${BASE}/blocks/contacto`).set(ORIGIN).send({ answers: correct(2) })).body.code).toBe('PREVIOUS_BLOCK_REQUIRED');
    expect((await agent.post(`${BASE}/blocks/preparacion`).set(ORIGIN).send({ answers: correct(1) })).status).toBe(200);
    const repeated = await agent.post(endpoint).set(ORIGIN).send({});
    expect(repeated.body.data.percent).toBe(40);
    expect(repeated.body.data.blocks[1]).toMatchObject({ completed: true, enabled: true });
    expect((await agent.post(`${BASE}/blocks/conceptos/reset`).set(ORIGIN).send({ confirm: true })).status).toBe(404);
    const resumed = await loginAgent(user.numeroDocumento, 'asesor');
    expect((await resumed.agent.get(`${BASE}/module`)).body.data.blocks[1]).toMatchObject({ completed: true, enabled: true });
    expect(await prisma.seal.count({ where: { userId: user.id, moduleId: modules.induction.id, status: 'ACTIVE' } })).toBe(0);
  });
});
