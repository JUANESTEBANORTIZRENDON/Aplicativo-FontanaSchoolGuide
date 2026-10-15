import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../app.js';
import { prisma } from '../config/prisma.js';
import * as attemptService from '../services/attempt.service.js';
import { firmarSesion } from '../services/session.service.js';
import { DEMO_ADMIN_PASSWORD, DEMO_PASSWORD } from '../../prisma/seed-demo.js';
import { activityIds, loginAgent, resetRateLimits } from './helpers.js';

// La base de pruebas se siembra con db:seed:demo en global-setup.ts.
// Cada caso comprueba con la API la fila correspondiente de la tabla de escenarios.

type ModuleRow = { slug: string; status: string; enabled: boolean; actionLabel: string; blockedReason: string | null; waitUntil: string | null; missingSeals?: string[]; hasSeal: boolean };
type Agent = Awaited<ReturnType<typeof loginAgent>>['agent'];

async function advisor(documento: string) {
  const session = await loginAgent(documento, 'asesor', DEMO_PASSWORD);
  expect(session.response.status, `login ${documento}`).toBe(200);
  const modules = (await session.agent.get('/api/advisor/modules')).body.data as ModuleRow[];
  return { ...session, modules };
}

async function userId(documento: string): Promise<string> {
  return (await prisma.usuario.findUniqueOrThrow({ where: { numeroDocumento: documento }, select: { id: true } })).id;
}

describe('escenarios demo', () => {
  let ids: Awaited<ReturnType<typeof activityIds>>;
  let admin: Agent;
  beforeAll(async () => {
    ids = await activityIds();
    admin = (await loginAgent('1000000100', 'administrador', DEMO_ADMIN_PASSWORD)).agent;
  });
  beforeEach(resetRateLimits);

  it('1000000100 · el administrador demo entra al panel', async () => {
    const me = await admin.get('/api/auth/me');
    expect(me.body.usuario.ruta).toBe('/admin');
    const list = await admin.get('/api/admin/users').query({ search: 'Demo ·', limit: 100 });
    expect(list.body.meta.total).toBe(46);
  });

  it('1000000101 · nuevo: va a /llena-tus-datos y luego ve M1 disponible', async () => {
    const session = await loginAgent('1000000101', 'asesor', DEMO_PASSWORD);
    expect(session.response.body.usuario.ruta).toBe('/llena-tus-datos');
    const modules = (await session.agent.get('/api/advisor/modules')).body.data as ModuleRow[];
    expect(modules.map((row) => row.status)).toEqual(['AVAILABLE', 'BLOCKED', 'BLOCKED', 'BLOCKED']);
  });

  it('1000000102 · en curso: M1 IN_PROGRESS con "Continuar"', async () => {
    const { modules } = await advisor('1000000102');
    expect(modules[0]).toMatchObject({ status: 'IN_PROGRESS', actionLabel: 'Continuar', enabled: true });
    expect(await prisma.attempt.count({ where: { userId: await userId('1000000102'), status: 'IN_PROGRESS' } })).toBe(1);
  });

  it('1000000103 · aprobado M1: completado, M2 disponible, M3 bloqueado', async () => {
    const { modules } = await advisor('1000000103');
    expect(modules[0]).toMatchObject({ status: 'PASSED', actionLabel: 'Completado', hasSeal: true });
    expect(modules[1]).toMatchObject({ status: 'AVAILABLE', enabled: true });
    expect(modules[2]).toMatchObject({ status: 'BLOCKED', blockedReason: 'Aprueba Simulador de cobranzas para continuar' });
  });

  it('1000000104 · agotado: sin intentos y startAttempt lo rechaza', async () => {
    const { modules } = await advisor('1000000104');
    expect(modules[0]).toMatchObject({ status: 'FAILED', enabled: false });
    expect(modules[0]!.blockedReason).toMatch(/intentos/);
    await expect(attemptService.startAttempt(await userId('1000000104'), ids.a1)).rejects.toMatchObject({ code: 'NO_ATTEMPTS_LEFT' });
  });

  it('1000000105 · en espera: no puede iniciar un intento hasta la hora indicada', async () => {
    const { modules } = await advisor('1000000105');
    expect(modules[0]!.waitUntil).toBeTruthy();
    const error = await attemptService.startAttempt(await userId('1000000105'), ids.a1).catch((reason: unknown) => reason);
    expect(error).toMatchObject({ code: 'WAIT_ACTIVE' });
    expect((error as Error).message).toMatch(/Podrás intentarlo desde/);
  });

  it('1000000106 · reactivado: recupera "Continuar" y el siguiente intento es el 4', async () => {
    const { modules } = await advisor('1000000106');
    expect(modules[0]).toMatchObject({ enabled: true, actionLabel: 'Continuar' });
    const file = (await admin.get(`/api/admin/advisors/${await userId('1000000106')}/progress`)).body.data;
    const activity = file.catalog[0].activities[0];
    expect(activity).toMatchObject({ nextAttemptNumber: 4, attemptsRemaining: 1 });
    expect(file.overrides[0]).toMatchObject({ action: 'EXTRA_ATTEMPT', state: 'VIGENTE' });
  });

  it('1000000107 · excepción vencida: en historial y sin efecto', async () => {
    const { modules } = await advisor('1000000107');
    expect(modules[1]).toMatchObject({ status: 'BLOCKED', enabled: false });
    const file = (await admin.get(`/api/admin/advisors/${await userId('1000000107')}/progress`)).body.data;
    expect(file.overrides[0]).toMatchObject({ action: 'UNLOCK', state: 'VENCIDA' });
  });

  it('1000000108 · excepción revocada: visible y sin acceso', async () => {
    const { modules } = await advisor('1000000108');
    expect(modules[0]).toMatchObject({ status: 'FAILED', enabled: false });
    const file = (await admin.get(`/api/admin/advisors/${await userId('1000000108')}/progress`)).body.data;
    expect(file.overrides[0]).toMatchObject({ action: 'REACTIVATE', state: 'REVOCADA' });
  });

  it('1000000109 · completo: "Ver certificado" y certificado FSG-DEMO-0001 activo', async () => {
    const { modules } = await advisor('1000000109');
    expect(modules[3]).toMatchObject({ actionLabel: 'Ver certificado', enabled: true });
    const file = (await admin.get(`/api/admin/advisors/${await userId('1000000109')}/progress`)).body.data;
    expect(file.certificates).toEqual([expect.objectContaining({ code: 'FSG-DEMO-0001', status: 'ACTIVE' })]);
    expect(file.seals.filter((seal: { status: string }) => seal.status === 'ACTIVE')).toHaveLength(3);
  });

  it('1000000110 · certificado reemitido: dos versiones enlazadas', async () => {
    const file = (await admin.get(`/api/admin/advisors/${await userId('1000000110')}/progress`)).body.data;
    const revoked = file.certificates.find((item: { status: string }) => item.status === 'REVOKED');
    const active = file.certificates.find((item: { status: string }) => item.status === 'ACTIVE');
    expect(revoked.revokeReason).toMatch(/^demo-/);
    expect(active.previousCertificateId).toBe(revoked.id);
  });

  it('1000000111 · sin sellos completos: certificado bloqueado con la lista', async () => {
    const { modules } = await advisor('1000000111');
    expect(modules[3]).toMatchObject({ status: 'BLOCKED', missingSeals: ['Tipificación de llamadas'] });
  });

  it('1000000112 · detenido: aparece en asesores detenidos con days=7', async () => {
    const response = await admin.get('/api/admin/metrics/summary').query({ days: 7, limit: 100 });
    expect(response.body.data.stalled.items.map((row: { numeroDocumento: string }) => row.numeroDocumento)).toContain('1000000112');
  });

  it('1000000113 · inactivo: no entra, conserva historial y no cuenta como activo', async () => {
    expect((await loginAgent('1000000113', 'asesor', DEMO_PASSWORD)).response.status).toBe(401);
    const file = (await admin.get(`/api/admin/advisors/${await userId('1000000113')}/progress`)).body.data;
    expect(file.attempts.length).toBeGreaterThan(0);
    const active = await admin.get('/api/admin/users').query({ search: '1000000113', status: 'activo' });
    expect(active.body.data).toHaveLength(0);
  });

  it('1000000114 · bloqueado: mensaje genérico y sesión anterior inválida', async () => {
    const login = await loginAgent('1000000114', 'asesor', DEMO_PASSWORD);
    expect(login.response.status).toBe(401);
    expect(login.response.body.message).toBe('Credenciales incorrectas o cuenta inactiva.');
    const id = await userId('1000000114');
    const old = await request(app).get('/api/auth/me').set('Cookie', `fontana_session=${firmarSesion(id, 0)}`);
    expect(old.status).toBe(401);
    const audit = await prisma.adminAuditLog.findFirst({ where: { entityId: id, action: 'USER_STATUS_CHANGED' } });
    expect(audit?.reason).toMatch(/^demo-/);
  });

  it('1000000115 · reabierto: puede entrar a M2 y conserva el sello', async () => {
    const { modules, agent } = await advisor('1000000115');
    expect(modules[1]).toMatchObject({ enabled: true, actionLabel: 'Continuar', hasSeal: true });
    expect((await agent.get('/api/advisor/modules/simulador-cobranzas')).status).toBe(200);
  });

  it('1000000116–145 · volumen: 30 asesores paginables por cursor', async () => {
    const seen = new Set<string>();
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page = await admin.get('/api/admin/users').query({ search: 'Demo · Asesor', limit: 20, ...(cursor ? { cursor } : {}) });
      for (const row of page.body.data as { id: string }[]) seen.add(row.id);
      cursor = page.body.meta.nextCursor;
      pages += 1;
    } while (cursor && pages < 10);
    expect(pages).toBe(3);
    expect(seen.size).toBe(45);
  });

  it('datos complementarios: mecanografía, webhooks y actividad inactiva', async () => {
    expect(await prisma.typingResult.count({ where: { providerEventId: { startsWith: 'demo-typing-' } } })).toBeGreaterThanOrEqual(10);
    expect(await prisma.webhookEvent.count({ where: { providerEventId: 'demo-typing-1000000103' } })).toBe(1);
    expect(await prisma.webhookEvent.findFirst({ where: { providerEventId: 'demo-typing-fallido' } })).toMatchObject({ status: 'FAILED' });
    const extra = await prisma.activity.findFirstOrThrow({ where: { title: 'Demo · actividad retirada' } });
    expect(extra.status).toBe('INACTIVE');
    expect(await prisma.userActivityProgress.count({ where: { activityId: extra.id } })).toBe(2);
  });
});
