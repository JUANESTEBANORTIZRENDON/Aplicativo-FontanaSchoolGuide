import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma.js';
import * as attemptService from '../services/attempt.service.js';
import * as overrideService from '../services/override.service.js';
import { activityIds, cleanupSuite, createTestUser, loginAgent, newKey, ORIGIN } from './helpers.js';

const SUITE = 'ovr';
const HOUR = 60 * 60_000;
type Agent = Awaited<ReturnType<typeof loginAgent>>['agent'];

async function exhausted(activityId: string) {
  const user = await createTestUser(SUITE);
  const base = Date.now() - 6 * HOUR;
  for (let index = 0; index < 3; index++) {
    const at = new Date(base + index * HOUR);
    const { attempt } = await attemptService.startAttempt(user.id, activityId, { now: at });
    await attemptService.submitAttempt(user.id, attempt.id, { score: 30, now: new Date(at.getTime() + 60_000) });
  }
  return user;
}

describe('reactivación individual', () => {
  let ids: Awaited<ReturnType<typeof activityIds>>;
  let admin: Awaited<ReturnType<typeof createTestUser>>;
  let agent: Agent;

  beforeAll(async () => {
    ids = await activityIds();
    admin = await createTestUser(SUITE, { rol: 'administrador' });
    agent = (await loginAgent(admin.numeroDocumento, 'administrador')).agent;
  });
  afterAll(() => cleanupSuite(SUITE));

  const url = (userId: string, activityId: string) => `/api/admin/advisors/${userId}/activities/${activityId}/reactivate`;

  it('exige motivo e Idempotency-Key', async () => {
    const user = await exhausted(ids.a1);
    expect((await agent.post(url(user.id, ids.a1)).set(ORIGIN).set('Idempotency-Key', newKey()).send({ action: 'EXTRA_ATTEMPT', extraAttempts: 1, reason: 'corto' })).status).toBe(400);
    expect((await agent.post(url(user.id, ids.a1)).set(ORIGIN).send({ action: 'EXTRA_ATTEMPT', extraAttempts: 1, reason: 'Motivo suficientemente largo' })).status).toBe(400);
  });

  it('concede un intento adicional, continúa la numeración y audita', async () => {
    const user = await exhausted(ids.a1);
    const advisor = (await loginAgent(user.numeroDocumento, 'asesor')).agent;
    expect((await advisor.get('/api/advisor/modules')).body.data[0]).toMatchObject({ status: 'FAILED', enabled: false });
    const response = await agent.post(url(user.id, ids.a1)).set(ORIGIN).set('Idempotency-Key', newKey()).send({ action: 'EXTRA_ATTEMPT', extraAttempts: 1, reason: 'Falla de conexión durante el intento' });
    expect(response.status).toBe(201);
    expect((await advisor.get('/api/advisor/modules')).body.data[0]).toMatchObject({ enabled: true, actionLabel: 'Continuar' });
    const { attempt } = await attemptService.startAttempt(user.id, ids.a1);
    expect(attempt.number).toBe(4);
    expect(attempt.overrideId).toBe(response.body.data.id);
    const override = await prisma.userActivityOverride.findUniqueOrThrow({ where: { id: response.body.data.id } });
    expect(override.consumedAt).not.toBeNull();
    expect(await prisma.attempt.count({ where: { userId: user.id } })).toBe(4);
    const audit = await prisma.adminAuditLog.findFirstOrThrow({ where: { entityId: override.id, action: 'OVERRIDE_CREATED' } });
    expect(audit).toMatchObject({ actorUserId: admin.id, reason: 'Falla de conexión durante el intento' });
    expect(audit.requestId).toBeTruthy();
  });

  it('es idempotente por clave y responde 409 ante una excepción vigente igual', async () => {
    const user = await exhausted(ids.a1);
    const key = newKey();
    const body = { action: 'EXTRA_ATTEMPT', extraAttempts: 1, reason: 'Solicitud idempotente de prueba' };
    const first = await agent.post(url(user.id, ids.a1)).set(ORIGIN).set('Idempotency-Key', key).send(body);
    const repeat = await agent.post(url(user.id, ids.a1)).set(ORIGIN).set('Idempotency-Key', key).send(body);
    expect(first.status).toBe(201);
    expect(repeat.status).toBe(200);
    expect(repeat.body.data.id).toBe(first.body.data.id);
    const other = await agent.post(url(user.id, ids.a1)).set(ORIGIN).set('Idempotency-Key', newKey()).send(body);
    expect(other.status).toBe(409);
    expect(other.body.code).toBe('OVERRIDE_DUPLICATE');
    expect(await prisma.userActivityOverride.count({ where: { userId: user.id } })).toBe(1);
  });

  it('valida que la acción aplique al estado actual', async () => {
    const user = await createTestUser(SUITE);
    const reset = await agent.post(url(user.id, ids.a1)).set(ORIGIN).set('Idempotency-Key', newKey()).send({ action: 'RESET_WAIT', reason: 'No hay espera activa aquí' });
    expect(reset.status).toBe(409);
    const reopen = await agent.post(url(user.id, ids.a1)).set(ORIGIN).set('Idempotency-Key', newKey()).send({ action: 'REOPEN_MODULE', reason: 'El módulo no está aprobado' });
    expect(reopen.status).toBe(409);
    const unlock = await agent.post(url(user.id, ids.a2)).set(ORIGIN).set('Idempotency-Key', newKey()).send({ action: 'UNLOCK', reason: 'Desbloqueo del simulador de prueba' });
    expect(unlock.status).toBe(201);
  });

  it('deja de aplicar una excepción vencida y la conserva en el historial', async () => {
    const user = await createTestUser(SUITE);
    const created = new Date(Date.now() - 3 * 24 * HOUR);
    await overrideService.reactivate(user.id, ids.a2, { action: 'UNLOCK', reason: 'Desbloqueo que vence pronto', expiresAt: new Date(Date.now() - 24 * HOUR) }, newKey(), { actorUserId: admin.id }, created);
    const advisor = (await loginAgent(user.numeroDocumento, 'asesor')).agent;
    expect((await advisor.get('/api/advisor/modules')).body.data[1]).toMatchObject({ status: 'BLOCKED', enabled: false });
    const file = (await agent.get(`/api/admin/advisors/${user.id}/progress`)).body.data;
    expect(file.overrides[0]).toMatchObject({ action: 'UNLOCK', state: 'VENCIDA' });
  });

  it('revoca sin borrar y con auditoría; revocar dos veces da 409', async () => {
    const user = await exhausted(ids.a1);
    const created = await agent.post(url(user.id, ids.a1)).set(ORIGIN).set('Idempotency-Key', newKey()).send({ action: 'REACTIVATE', reason: 'Reactivación que se revocará' });
    expect(created.status).toBe(201);
    const revoked = await agent.post(`/api/admin/overrides/${created.body.data.id}/revoke`).set(ORIGIN).send({ reason: 'Se otorgó por error de prueba' });
    expect(revoked.status).toBe(200);
    expect(revoked.body.data.revokedAt).toBeTruthy();
    expect((await agent.post(`/api/admin/overrides/${created.body.data.id}/revoke`).set(ORIGIN).send({ reason: 'Segunda revocación de prueba' })).status).toBe(409);
    await expect(attemptService.startAttempt(user.id, ids.a1)).rejects.toMatchObject({ code: 'NO_ATTEMPTS_LEFT' });
    expect(await prisma.userActivityOverride.count({ where: { id: created.body.data.id } })).toBe(1);
    expect(await prisma.adminAuditLog.count({ where: { entityId: created.body.data.id, action: 'OVERRIDE_REVOKED' } })).toBe(1);
  });

  it('no crea excepciones para asesores inactivos', async () => {
    const user = await createTestUser(SUITE, { estado: 'inactivo' });
    const response = await agent.post(url(user.id, ids.a2)).set(ORIGIN).set('Idempotency-Key', newKey()).send({ action: 'UNLOCK', reason: 'Asesor inactivo de prueba' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('ADVISOR_INACTIVE');
  });
});
