import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../app.js';
import { prisma } from '../config/prisma.js';
import { OBJECTIONS_KEYS, OBJECTIONS_SLUG } from '../domain/objections.js';
import { OBJECTIONS_CASES } from '../domain/objections-expert.js';
import { activityIds, cleanupSuite, createTestUser, loginAgent, ORIGIN } from './helpers.js';
const SUITE = 'objeciones';
const BASE = '/api/training/objections';
async function readyAdvisor() {
  const user = await createTestUser(SUITE);
  const { modules } = await activityIds();
  for (const moduleId of [modules.m1.id, modules.induction.id]) await prisma.seal.create({ data: { userId: user.id, moduleId } });
  const { agent } = await loginAgent(user.numeroDocumento, 'asesor');
  const module = await prisma.trainingModule.findUniqueOrThrow({ where: { slug: OBJECTIONS_SLUG }, include: { activities: true } });
  return { user, agent, module };
}
describe('objeciones: cinco sliders y evaluación escrita', () => {
  afterAll(() => cleanupSuite(SUITE));
  it('conserva módulo, ruta y prerrequisitos e incorpora la evaluación obligatoria', async () => {
    const module = await prisma.trainingModule.findUniqueOrThrow({ where: { slug: OBJECTIONS_SLUG }, include: { activities: true } });
    expect(module).toMatchObject({ name: 'Enfréntate a la objeción', order: 3 });
    const active = module.activities.filter(a => a.status === 'ACTIVE' && a.isRequired);
    expect(active).toHaveLength(2);
    expect(active.map(a => a.type).sort()).toEqual(['LESSON', 'SIMULATOR']);
  });
  it('exige sesión y aprobar la inducción, sin acceso a intentos ajenos', async () => {
    expect((await request(app).get(`${BASE}/module`)).status).toBe(401);
    const user = await createTestUser(SUITE);
    const { agent } = await loginAgent(user.numeroDocumento, 'asesor');
    expect((await agent.get(`${BASE}/module`)).body.code).toBe('MODULE_BLOCKED');
  });
  it('permite sliders libres sin guardar lectura y persiste el borrador del examen', async () => {
    const { agent, user, module } = await readyAdvisor();
    const initial = (await agent.get(`${BASE}/module`)).body.data;
    expect(initial.blocks).toHaveLength(5);
    expect(initial.blocks.map((b: { enabled: boolean }) => b.enabled)).toEqual([true, true, true, true, true]);
    expect(initial.exam.canStart).toBe(true);
    for (const key of OBJECTIONS_KEYS) expect((await agent.post(`${BASE}/blocks/${key}/complete`).set(ORIGIN).send({})).status).toBe(200);
    const state = (await agent.get(`${BASE}/module`)).body.data;
    expect(state).toMatchObject({ percent: 0, complete: false, completedCount: 0 });
    expect(await prisma.collectionsBlockProgress.count({ where: { userId: user.id, moduleId: module.id } })).toBe(0);
    expect(await prisma.seal.count({ where: { userId: user.id, moduleId: module.id } })).toBe(0);
    const started = (await agent.post(`${BASE}/exam/start`).set(ORIGIN).send({})).body.data;
    const attemptId = started.exam.draft.attemptId;
    const first = OBJECTIONS_CASES[0];
    expect((await agent.put(`${BASE}/exam/answer`).set(ORIGIN).send({ attemptId, key: first.key, text: first.example })).status).toBe(200);
    const fresh = await loginAgent(user.numeroDocumento, 'asesor');
    expect((await fresh.agent.get(`${BASE}/module`)).body.data.exam.draft.answers[first.key]).toBe(first.example);
    expect((await agent.post(`${BASE}/exam/submit`).set(ORIGIN).send({ attemptId, score: 100 })).status).toBe(400);
    expect((await agent.post(`${BASE}/exam/submit`).set(ORIGIN).send({ attemptId })).status).toBe(400);
    expect((await prisma.attempt.findUniqueOrThrow({ where: { id: attemptId } })).status).toBe('IN_PROGRESS');
  });
  it('califica en servidor, conserva el texto, no duplica el envío y habilita Tipifica', async () => {
    const { user, agent, module } = await readyAdvisor();
    const attemptId = (await agent.post(`${BASE}/exam/start`).set(ORIGIN).send({})).body.data.exam.draft.attemptId;
    for (const entry of OBJECTIONS_CASES) await agent.put(`${BASE}/exam/answer`).set(ORIGIN).send({ attemptId, key: entry.key, text: entry.example });
    const sent = (await agent.post(`${BASE}/exam/submit`).set(ORIGIN).send({ attemptId })).body.data;
    expect(sent.result).toMatchObject({ score: 100, passed: true });
    expect(sent.result.cases).toHaveLength(5);
    expect(sent.result.cases[0].answer).toBe(OBJECTIONS_CASES[0].example);
    expect(sent.state.complete).toBe(true);
    expect((await agent.post(`${BASE}/exam/submit`).set(ORIGIN).send({ attemptId })).body.data.alreadySubmitted).toBe(true);
    expect(await prisma.seal.count({ where: { userId: user.id, moduleId: module.id, status: 'ACTIVE' } })).toBe(1);
    const views = (await agent.get('/api/advisor/modules')).body.data;
    expect(views.find((m: { slug: string }) => m.slug === 'tipificacion-llamadas').enabled).toBe(true);
    const count = await prisma.attempt.count({ where: { userId: user.id } });
    expect((await agent.post(`${BASE}/practice`).set(ORIGIN).send({ key: OBJECTIONS_KEYS[0], text: OBJECTIONS_CASES[0].example })).status).toBe(200);
    expect(await prisma.attempt.count({ where: { userId: user.id } })).toBe(count);
  });
});
