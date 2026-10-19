import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../app.js';
import { prisma } from '../config/prisma.js';
import { OBJECTIONS_KEYS, OBJECTIONS_SLUG } from '../domain/objections.js';
import { activityIds, cleanupSuite, createTestUser, loginAgent, ORIGIN } from './helpers.js';

const SUITE = 'objeciones';
const BASE = '/api/training/objections';

// Asesor con los sellos de los módulos 1 y 2: el módulo 03 queda disponible.
async function readyAdvisor() {
  const user = await createTestUser(SUITE);
  const { modules } = await activityIds();
  await prisma.seal.create({ data: { userId: user.id, moduleId: modules.m1.id, status: 'ACTIVE' } });
  await prisma.seal.create({ data: { userId: user.id, moduleId: modules.induction.id, status: 'ACTIVE' } });
  const { agent } = await loginAgent(user.numeroDocumento, 'asesor');
  const module = await prisma.trainingModule.findUniqueOrThrow({ where: { slug: OBJECTIONS_SLUG }, include: { activities: true } });
  return { user, agent, module };
}

describe('módulo 03: Enfréntate a la objeción', () => {
  afterAll(() => cleanupSuite(SUITE));

  it('el catálogo expone el nombre nuevo y una lección obligatoria en lugar del marcador de posición', async () => {
    const module = await prisma.trainingModule.findUniqueOrThrow({ where: { slug: OBJECTIONS_SLUG }, include: { activities: true } });
    expect(module).toMatchObject({ name: 'Enfréntate a la objeción', order: 3, route: '/induccion/modulos/simulador-cobranzas' });
    const active = module.activities.filter((activity) => activity.status === 'ACTIVE');
    expect(active.filter((activity) => activity.isRequired)).toHaveLength(1);
    expect(active.find((activity) => activity.isRequired)).toMatchObject({ type: 'LESSON', order: 1 });
    expect(module.activities.some((activity) => activity.type === 'PLACEHOLDER' && activity.status === 'ACTIVE')).toBe(false);
  });

  it('exige sesión y mantiene el módulo bloqueado hasta aprobar la inducción', async () => {
    expect((await request(app).get(`${BASE}/module`)).status).toBe(401);
    const user = await createTestUser(SUITE);
    const { agent } = await loginAgent(user.numeroDocumento, 'asesor');
    expect((await agent.get(`${BASE}/module`)).body.code).toBe('MODULE_BLOCKED');
    const views = (await agent.get('/api/advisor/modules')).body.data;
    expect(views.find((m: { slug: string }) => m.slug === OBJECTIONS_SLUG)).toMatchObject({ name: 'Enfréntate a la objeción', enabled: false });
  });

  it('avanza por bloques en orden, guarda el progreso en el servidor y no tiene evaluaciones', async () => {
    const { agent, user } = await readyAdvisor();
    const initial = (await agent.get(`${BASE}/module`)).body.data;
    expect(initial).toMatchObject({ percent: 0, complete: false, currentBlock: 'comprender' });
    expect(initial).not.toHaveProperty('exam');
    expect(initial.blocks.map((block: { enabled: boolean }) => block.enabled)).toEqual([true, false, false, false]);
    expect((await agent.post(`${BASE}/blocks/criterio/complete`).set(ORIGIN).send({})).body.code).toBe('PREVIOUS_BLOCK_REQUIRED');
    expect((await agent.post(`${BASE}/blocks/inventado/complete`).set(ORIGIN).send({})).status).toBe(400);
    expect((await agent.post(`${BASE}/exam`).set(ORIGIN).send({ answers: {} })).status).toBe(404);
    for (const [index, key] of OBJECTIONS_KEYS.slice(0, 3).entries()) {
      const saved = (await agent.post(`${BASE}/blocks/${key}/complete`).set(ORIGIN).send({})).body.data;
      expect(saved).toMatchObject({ percent: (index + 1) * 25, complete: false });
    }
    // El avance persiste en una sesión nueva y todavía no hay sello ni «Tipificación».
    const resumed = await loginAgent(user.numeroDocumento, 'asesor');
    const state = (await resumed.agent.get(`${BASE}/module`)).body.data;
    expect(state).toMatchObject({ completedCount: 3, percent: 75, complete: false, currentBlock: 'casos' });
    const views = (await resumed.agent.get('/api/advisor/modules')).body.data;
    expect(views.find((m: { slug: string }) => m.slug === 'tipificacion-llamadas').enabled).toBe(false);
  });

  it('al terminar el cuarto bloque completa el módulo, emite el sello y habilita Tipificación', async () => {
    const { agent, user, module } = await readyAdvisor();
    for (const key of OBJECTIONS_KEYS.slice(0, 3)) await agent.post(`${BASE}/blocks/${key}/complete`).set(ORIGIN).send({});
    expect(await prisma.seal.count({ where: { userId: user.id, moduleId: module.id, status: 'ACTIVE' } })).toBe(0);
    const done = (await agent.post(`${BASE}/blocks/casos/complete`).set(ORIGIN).send({})).body.data;
    expect(done).toMatchObject({ percent: 100, complete: true, completedCount: 4 });
    expect(done.nextRoute).toBe('/induccion/modulos/tipificacion-llamadas');
    expect(await prisma.seal.count({ where: { userId: user.id, moduleId: module.id, status: 'ACTIVE' } })).toBe(1);
    const required = module.activities.filter((activity) => activity.status === 'ACTIVE' && activity.isRequired).map((activity) => activity.id);
    expect(await prisma.userActivityProgress.count({ where: { userId: user.id, activityId: { in: required }, status: 'PASSED' } })).toBe(required.length);
    const views = (await agent.get('/api/advisor/modules')).body.data;
    expect(views.find((m: { slug: string }) => m.slug === OBJECTIONS_SLUG)).toMatchObject({ status: 'PASSED', progressPercent: '100.00', enabled: true });
    expect(views.find((m: { slug: string }) => m.slug === 'tipificacion-llamadas').enabled).toBe(true);
    // Repetir un bloque ya completado no duplica el sello.
    expect((await agent.post(`${BASE}/blocks/casos/complete`).set(ORIGIN).send({})).status).toBe(200);
    expect(await prisma.seal.count({ where: { userId: user.id, moduleId: module.id, status: 'ACTIVE' } })).toBe(1);
  });
});
