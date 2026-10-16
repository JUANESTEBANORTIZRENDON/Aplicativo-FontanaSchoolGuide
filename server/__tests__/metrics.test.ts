import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma.js';
import { ratio } from '../services/metrics.service.js';
import { zonedToUtc } from '../utils/time.js';
import { activityIds, cleanupSuite, createTestUser, loginAgent } from './helpers.js';

const SUITE = 'met';
type Agent = Awaited<ReturnType<typeof loginAgent>>['agent'];

describe('métricas', () => {
  let agent: Agent;
  beforeAll(async () => {
    const admin = await createTestUser(SUITE, { rol: 'administrador' });
    agent = (await loginAgent(admin.numeroDocumento, 'administrador')).agent;
  });
  afterAll(() => cleanupSuite(SUITE));

  it('divide sin errores cuando no hay datos', () => {
    expect(ratio(1, 0)).toEqual({ value: null, sinDatos: true });
    expect(ratio(1, 3)).toEqual({ value: '33.33', sinDatos: false });
  });

  it('interpreta las fechas en APP_TIMEZONE (America/Bogota, UTC-5)', () => {
    expect(zonedToUtc('2026-03-01', 'America/Bogota').toISOString()).toBe('2026-03-01T05:00:00.000Z');
  });

  it('calcula el resumen con los datos sembrados', async () => {
    const response = await agent.get('/api/admin/metrics/summary').query({ days: 7, limit: 100 });
    expect(response.status).toBe(200);
    const data = response.body.data;
    const active = await prisma.usuario.count({ where: { rol: 'asesor', estado: 'activo' } });
    expect(data.activeAdvisors).toBe(active);
    expect(data.overallProgress.sinDatos).toBe(false);
    expect(Number(data.overallProgress.value)).toBeGreaterThan(0);
    expect(data.approvalByModule).toHaveLength(5);
    expect(data.approvalByModule[0].participants).toBeGreaterThan(0);
    expect(data.distribution.length).toBeGreaterThan(0);
    expect(Number(data.attempts.averagePerAdvisor.value)).toBeGreaterThan(1);
    expect(data.score.average.sinDatos).toBe(false);
    expect(data.time.byActivity[0].medianSeconds).not.toBeNull();
    expect(data.typing.results).toBeGreaterThanOrEqual(10);
    expect(data.reactivations.total).toBeGreaterThan(0);
    expect(data.location.items.length).toBeGreaterThan(0);
    const stalledDocs = data.stalled.items.map((row: { numeroDocumento: string }) => row.numeroDocumento);
    expect(stalledDocs).toContain('1000000112');
  });

  it('aplica filtros y marca sinDatos en rangos vacíos', async () => {
    const empty = await agent.get('/api/admin/metrics/summary').query({ from: '2000-01-01', to: '2000-01-31' });
    expect(empty.status).toBe(200);
    expect(empty.body.data.score.average).toEqual({ value: null, sinDatos: true });
    expect(empty.body.data.attempts.averagePerAdvisor.sinDatos).toBe(true);
    expect(empty.body.data.typing.sinDatos).toBe(true);
    const { modules } = await activityIds();
    const byModule = await agent.get('/api/admin/metrics/summary').query({ moduleId: modules.m2.id });
    expect(byModule.body.data.approvalByModule).toHaveLength(1);
    const inactive = await agent.get('/api/admin/metrics/summary').query({ advisorStatus: 'inactivo' });
    expect(inactive.status).toBe(200);
    expect((await agent.get('/api/admin/metrics/summary').query({ from: 'ayer' })).status).toBe(400);
  });

  it('devuelve el detalle de un módulo', async () => {
    const { modules } = await activityIds();
    const response = await agent.get(`/api/admin/metrics/modules/${modules.m1.id}`);
    expect(response.status).toBe(200);
    expect(response.body.data.module.slug).toBe('ofimatica-mecanografia');
    expect(response.body.data.approval.participants).toBeGreaterThan(0);
    expect(response.body.data.activities.length).toBeGreaterThan(0);
  });

  it('pagina la ubicación actual por cursor', async () => {
    const first = await agent.get('/api/admin/metrics/location').query({ limit: 5 });
    expect(first.body.data).toHaveLength(5);
    const second = await agent.get('/api/admin/metrics/location').query({ limit: 5, cursor: first.body.meta.nextCursor });
    expect(second.body.data[0].userId > first.body.data[4].userId).toBe(true);
  });

  it('el repositorio de métricas solo usa consultas agregadas', () => {
    const source = readFileSync(new URL('../repositories/metrics.repository.ts', import.meta.url), 'utf8');
    for (const match of source.matchAll(/findMany\(([\s\S]*?)\)\s*;?/g)) expect(match[1]).toMatch(/take:/);
    expect(source).not.toMatch(/\$queryRawUnsafe/);
  });
});
