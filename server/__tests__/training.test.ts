import { Prisma } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma.js';
import { computeAvailability } from '../domain/progress.js';
import * as attemptService from '../services/attempt.service.js';
import { completeModule } from '../services/progress.service.js';
import { activityIds, cleanupSuite, createTestUser, loginAgent, ORIGIN, passOfficeModule } from './helpers.js';

const SUITE = 'train';
const MIN = 60_000;

describe('módulos y acceso', () => {
  let ids: Awaited<ReturnType<typeof activityIds>>;
  beforeAll(async () => { ids = await activityIds(); });
  afterAll(() => cleanupSuite(SUITE));

  it('devuelve los cinco módulos en orden con botones y razones de bloqueo', async () => {
    const user = await createTestUser(SUITE);
    const { agent } = await loginAgent(user.numeroDocumento, 'asesor');
    const response = await agent.get('/api/advisor/modules');
    expect(response.status).toBe(200);
    const data = response.body.data as Array<Record<string, unknown>>;
    expect(data.map((row) => row.slug)).toEqual(['ofimatica-mecanografia', 'induccion-cobranzas', 'simulador-cobranzas', 'tipificacion-llamadas', 'certificado']);
    expect(data[0]).toMatchObject({ status: 'AVAILABLE', actionLabel: 'Continuar', enabled: true, blockedReason: null, progressPercent: '0.00', route: '/induccion/modulos/ofimatica-mecanografia' });
    expect(data[1]).toMatchObject({ status: 'BLOCKED', enabled: false, blockedReason: 'Aprueba Ofimática para tus cobranzas para continuar' });
    expect(data[4]).toMatchObject({ status: 'BLOCKED', enabled: false });
    expect(data[4]!.missingSeals).toHaveLength(4);
  });

  it('bloquea el acceso directo por URL a un módulo bloqueado (403)', async () => {
    const user = await createTestUser(SUITE);
    const { agent } = await loginAgent(user.numeroDocumento, 'asesor');
    const blocked = await agent.get('/api/advisor/modules/induccion-cobranzas');
    expect(blocked.status).toBe(403);
    expect(blocked.body.details.blockedReason).toBe('Aprueba Ofimática para tus cobranzas para continuar');
    const open = await agent.get('/api/advisor/modules/ofimatica-mecanografia');
    expect(open.status).toBe(200);
    expect(open.body.data.content.message).toBe('Contenido en preparación');
    expect((await agent.get('/api/advisor/modules/certificado')).status).toBe(403);
    expect((await agent.get('/api/advisor/modules/no-existe')).status).toBe(404);
  });

  it('muestra un módulo inactivo como "No disponible" y conserva el progreso', async () => {
    const admin = await createTestUser(SUITE, { rol: 'administrador' });
    const user = await createTestUser(SUITE);
    const adminAgent = (await loginAgent(admin.numeroDocumento, 'administrador')).agent;
    const advisor = (await loginAgent(user.numeroDocumento, 'asesor')).agent;
    const off = await adminAgent.patch(`/api/admin/modules/${ids.modules.m1.id}/status`).set(ORIGIN).send({ status: 'INACTIVE', reason: 'Mantenimiento del módulo de prueba' });
    try {
      expect(off.status).toBe(200);
      const view = (await advisor.get('/api/advisor/modules')).body.data[0];
      expect(view).toMatchObject({ enabled: false, actionLabel: 'No disponible', blockedReason: 'Módulo no disponible temporalmente' });
      expect((await advisor.get('/api/advisor/modules/ofimatica-mecanografia')).status).toBe(403);
      await expect(attemptService.startAttempt(user.id, ids.a1)).rejects.toMatchObject({ code: 'MODULE_BLOCKED' });
      expect(await prisma.userModuleProgress.count({ where: { userId: user.id } })).toBe(5);
    } finally {
      await adminAgent.patch(`/api/admin/modules/${ids.modules.m1.id}/status`).set(ORIGIN).send({ status: 'ACTIVE', reason: 'Fin del mantenimiento de prueba' });
    }
    expect((await advisor.get('/api/advisor/modules')).body.data[0].enabled).toBe(true);
  });
});

describe('progreso e intentos', () => {
  let ids: Awaited<ReturnType<typeof activityIds>>;
  beforeAll(async () => { ids = await activityIds(); });

  it('numera los intentos de forma consecutiva y respeta el límite', async () => {
    const user = await createTestUser(SUITE);
    const base = Date.now() - 10 * 60 * MIN;
    const numbers: number[] = [];
    for (let index = 0; index < 3; index++) {
      const at = new Date(base + index * 60 * MIN);
      const { attempt } = await attemptService.startAttempt(user.id, ids.a1, { now: at });
      numbers.push(attempt.number);
      await attemptService.submitAttempt(user.id, attempt.id, { score: 20, now: new Date(at.getTime() + MIN) });
    }
    expect(numbers).toEqual([1, 2, 3]);
    await expect(attemptService.startAttempt(user.id, ids.a1)).rejects.toMatchObject({ code: 'NO_ATTEMPTS_LEFT' });
    const progress = await prisma.userActivityProgress.findUniqueOrThrow({ where: { userId_activityId: { userId: user.id, activityId: ids.a1 } } });
    expect(progress).toMatchObject({ status: 'FAILED', attemptsUsed: 3 });
  });

  it('reanuda el intento abierto en lugar de crear otro', async () => {
    const user = await createTestUser(SUITE);
    const first = await attemptService.startAttempt(user.id, ids.a1);
    const again = await attemptService.startAttempt(user.id, ids.a1);
    expect(again.resumed).toBe(true);
    expect(again.attempt.id).toBe(first.attempt.id);
  });

  it('aplica el tiempo de espera tras un intento fallido (Simulador: 30 minutos)', async () => {
    const user = await createTestUser(SUITE);
    await passOfficeModule(user.id);
    const at = new Date(Date.now() - 5 * MIN);
    const { attempt } = await attemptService.startAttempt(user.id, ids.a2, { now: at });
    await attemptService.submitAttempt(user.id, attempt.id, { score: 10, now: new Date(at.getTime() + MIN) });
    const error = await attemptService.startAttempt(user.id, ids.a2).catch((reason: unknown) => reason);
    expect(error).toMatchObject({ code: 'WAIT_ACTIVE' });
    expect((error as { details: { waitUntil: string } }).details.waitUntil).toBeTruthy();
    const later = await attemptService.startAttempt(user.id, ids.a2, { now: new Date(at.getTime() + 40 * MIN) });
    expect(later.attempt.number).toBe(2);
  });

  it('la mecanografía del módulo 1 no tiene espera entre intentos', async () => {
    const user = await createTestUser(SUITE);
    const at = new Date(Date.now() - 5 * MIN);
    const { attempt } = await attemptService.startAttempt(user.id, ids.a1, { now: at });
    await attemptService.submitAttempt(user.id, attempt.id, { score: 10, now: new Date(at.getTime() + MIN) });
    const next = await attemptService.startAttempt(user.id, ids.a1);
    expect(next.attempt.number).toBe(2);
  });

  it('calcula la nota con Decimal y redondeo a dos decimales', async () => {
    expect(attemptService.scoreFrom({ answers: [{ questionId: 'a', isCorrect: true }, { questionId: 'b', isCorrect: true }, { questionId: 'c', isCorrect: false }] }).toFixed(2)).toBe('66.67');
    expect(attemptService.scoreFrom({ answers: [{ questionId: 'a', awardedScore: '33.335' }, { questionId: 'b', awardedScore: 40 }] }).toFixed(2)).toBe('73.34');
    expect(attemptService.scoreFrom({ score: 150 }).toFixed(2)).toBe('100.00');
    const user = await createTestUser(SUITE);
    const { attempt } = await attemptService.startAttempt(user.id, ids.a1);
    const result = await attemptService.submitAttempt(user.id, attempt.id, { answers: [{ questionId: 'q1', isCorrect: true }, { questionId: 'q2', isCorrect: true }, { questionId: 'q3', isCorrect: false }] });
    expect(result.attempt.score).toBeInstanceOf(Prisma.Decimal);
    expect(result.attempt.score!.toFixed(2)).toBe('66.67');
    expect(result.passed).toBe(false);
    expect(await prisma.attemptAnswer.count({ where: { attemptId: attempt.id } })).toBe(3);
  });

  it('desbloquea el siguiente módulo, emite un solo sello y persiste tras cerrar sesión', async () => {
    const user = await createTestUser(SUITE);
    // Con una sola actividad aprobada el módulo sigue en curso: el sello exige las tres obligatorias.
    const first = await attemptService.startAttempt(user.id, ids.a1);
    expect((await attemptService.submitAttempt(user.id, first.attempt.id, { score: 100, passed: true })).passed).toBe(true);
    expect(await prisma.seal.count({ where: { userId: user.id } })).toBe(0);
    for (const activityId of [ids.office.excel, ids.office.dictation]) {
      const { attempt } = await attemptService.startAttempt(user.id, activityId);
      await attemptService.submitAttempt(user.id, attempt.id, { score: 100 });
    }
    await prisma.$transaction((tx) => completeModule(tx, user.id, ids.modules.m1.id));
    expect(await prisma.seal.count({ where: { userId: user.id, moduleId: ids.modules.m1.id, status: 'ACTIVE' } })).toBe(1);

    const session = await loginAgent(user.numeroDocumento, 'asesor');
    await session.agent.post('/api/auth/logout').set(ORIGIN);
    const again = await loginAgent(user.numeroDocumento, 'asesor');
    const data = (await again.agent.get('/api/advisor/modules')).body.data;
    // El módulo 1 tiene pantalla de resultado: aprobado sigue abierto para repasarlo.
    expect(data[0]).toMatchObject({ status: 'PASSED', actionLabel: 'Completado', progressPercent: '100.00', enabled: false });
    expect(data[1]).toMatchObject({ status: 'AVAILABLE', enabled: true, actionLabel: 'Continuar' });
    expect(data[2]).toMatchObject({ status: 'BLOCKED', blockedReason: 'Aprueba Inducción a las cobranzas para continuar' });
    const summary = (await again.agent.get('/api/advisor/progress')).body.data;
    expect(summary).toMatchObject({ modulesPassed: 1, modulesTotal: 3, overallPercent: '33.33' });
  });

  it('calcula disponibilidad de intentos de forma pura', () => {
    const now = new Date();
    const evaluation = { id: 'e', maxAttempts: 2, waitMinutes: 0, minimumScore: new Prisma.Decimal(70) };
    const failed = (number: number, overrideId: string | null = null) => ({ id: `a${number}`, number, status: 'FAILED' as const, overrideId, submittedAt: now, startedAt: now });
    const grant = { id: 'g', activityId: 'x', action: 'EXTRA_ATTEMPT' as const, extraAttempts: 1, expiresAt: null, revokedAt: null, consumedAt: null, createdAt: now };
    expect(computeAvailability(evaluation, [failed(1), failed(2)], [], now)).toMatchObject({ exhausted: true, remaining: 0 });
    expect(computeAvailability(evaluation, [failed(1), failed(2)], [grant], now)).toMatchObject({ canStart: true, grantOverrideId: 'g', nextNumber: 3 });
    expect(computeAvailability(evaluation, [failed(1), failed(2), failed(3, 'g')], [{ ...grant, consumedAt: now }], now)).toMatchObject({ exhausted: true });
    expect(computeAvailability(evaluation, [failed(1), failed(2)], [{ ...grant, expiresAt: new Date(now.getTime() - 1) }], now).exhausted).toBe(true);
  });
});
