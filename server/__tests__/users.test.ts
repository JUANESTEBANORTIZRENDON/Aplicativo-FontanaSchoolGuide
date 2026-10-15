import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma.js';
import * as userService from '../services/user.service.js';
import { cleanupSuite, createTestUser, loginAgent, ORIGIN, PASSWORD, testDocument } from './helpers.js';

const SUITE = 'users';
type Agent = Awaited<ReturnType<typeof loginAgent>>['agent'];

describe('gestión de usuarios', () => {
  let admin: Awaited<ReturnType<typeof createTestUser>>;
  let agent: Agent;

  beforeAll(async () => {
    admin = await createTestUser(SUITE, { rol: 'administrador' });
    agent = (await loginAgent(admin.numeroDocumento, 'administrador')).agent;
  });
  afterAll(() => cleanupSuite(SUITE));

  it('crea un asesor con progreso inicial y auditoría', async () => {
    const numeroDocumento = testDocument(SUITE);
    const response = await agent.post('/api/admin/users').set(ORIGIN).send({ nombreCompleto: 'Asesor Creado', numeroDocumento, password: PASSWORD, rol: 'asesor' });
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ numeroDocumento, rol: 'asesor', estado: 'activo', debeCompletarDatos: true });
    expect(response.body.data).not.toHaveProperty('passwordHash');
    const progress = await prisma.userModuleProgress.findMany({ where: { userId: response.body.data.id }, include: { module: true }, orderBy: { module: { order: 'asc' } } });
    expect(progress.map((row) => row.status)).toEqual(['AVAILABLE', 'BLOCKED', 'BLOCKED', 'BLOCKED']);
    const audit = await prisma.adminAuditLog.findFirst({ where: { entityId: response.body.data.id, action: 'USER_CREATED' } });
    expect(audit?.actorUserId).toBe(admin.id);
    expect(JSON.stringify(audit?.afterJson)).not.toMatch(/passwordHash|versionSesion/);
  });

  it('crea administradores', async () => {
    const response = await agent.post('/api/admin/users').set(ORIGIN).send({ nombreCompleto: 'Admin Creado', numeroDocumento: testDocument(SUITE), password: PASSWORD, rol: 'administrador' });
    expect(response.status).toBe(201);
    expect(response.body.data.rol).toBe('administrador');
  });

  it('responde 409 ante documento duplicado', async () => {
    const existing = await createTestUser(SUITE);
    const response = await agent.post('/api/admin/users').set(ORIGIN).send({ nombreCompleto: 'Duplicado', numeroDocumento: existing.numeroDocumento, password: PASSWORD });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('DOCUMENT_TAKEN');
  });

  it('edita datos permitidos y rechaza campos sensibles', async () => {
    const user = await createTestUser(SUITE);
    const ok = await agent.patch(`/api/admin/users/${user.id}`).set(ORIGIN).send({ nombreCompleto: 'Nombre Editado', telefono: '3001234567' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.nombreCompleto).toBe('Nombre Editado');
    for (const field of [{ passwordHash: 'x' }, { versionSesion: 9 }, { creadoPor: admin.id }, { fechaCreacion: '2020-01-01' }, { estado: 'inactivo' }]) {
      const rejected = await agent.patch(`/api/admin/users/${user.id}`).set(ORIGIN).send({ nombreCompleto: 'X Y', ...field });
      expect(rejected.status).toBe(400);
      expect(rejected.body.code).toBe('VALIDATION_ERROR');
    }
  });

  it('desactiva y reactiva con motivo obligatorio, conservando el historial', async () => {
    const user = await createTestUser(SUITE);
    const noReason = await agent.patch(`/api/admin/users/${user.id}/status`).set(ORIGIN).send({ estado: 'inactivo' });
    expect(noReason.status).toBe(400);
    expect(noReason.body.details).toHaveProperty('reason');
    const off = await agent.patch(`/api/admin/users/${user.id}/status`).set(ORIGIN).send({ estado: 'inactivo', reason: 'Fin del contrato de prueba' });
    expect(off.status).toBe(200);
    expect(off.body.data.estado).toBe('inactivo');
    const on = await agent.patch(`/api/admin/users/${user.id}/status`).set(ORIGIN).send({ estado: 'activo', reason: 'Reingreso del asesor de prueba' });
    expect(on.body.data.estado).toBe('activo');
    const stored = await prisma.usuario.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.versionSesion).toBe(1);
    expect(await prisma.userModuleProgress.count({ where: { userId: user.id } })).toBe(4);
    expect(await prisma.adminAuditLog.count({ where: { entityId: user.id, action: 'USER_STATUS_CHANGED' } })).toBe(2);
  });

  it('impide cambiar el propio rol o estado', async () => {
    expect((await agent.patch(`/api/admin/users/${admin.id}`).set(ORIGIN).send({ rol: 'asesor' })).status).toBe(403);
    expect((await agent.patch(`/api/admin/users/${admin.id}/status`).set(ORIGIN).send({ estado: 'inactivo', reason: 'Intento de autodesactivación' })).status).toBe(403);
  });

  it('protege al último administrador activo', async () => {
    const target = await createTestUser(SUITE, { rol: 'administrador' });
    const others = await prisma.usuario.findMany({ where: { rol: 'administrador', estado: 'activo', id: { not: target.id } }, select: { id: true } });
    await prisma.usuario.updateMany({ where: { id: { in: others.map((row) => row.id) } }, data: { estado: 'inactivo' } });
    try {
      await expect(userService.changeStatus(target.id, { estado: 'inactivo', reason: 'Prueba último administrador' }, { actorUserId: admin.id }))
        .rejects.toMatchObject({ code: 'LAST_ADMIN', status: 409 });
      await expect(userService.updateUser(target.id, { rol: 'asesor' }, { actorUserId: admin.id }))
        .rejects.toMatchObject({ code: 'LAST_ADMIN' });
    } finally {
      await prisma.usuario.updateMany({ where: { id: { in: others.map((row) => row.id) } }, data: { estado: 'activo' } });
    }
  });

  it('restablece la contraseña de un asesor sin auditar el valor', async () => {
    const user = await createTestUser(SUITE);
    const response = await agent.post(`/api/admin/users/${user.id}/reset-password`).set(ORIGIN).send({});
    expect(response.status).toBe(200);
    const temporary = response.body.data.temporaryPassword as string;
    expect(temporary.length).toBeGreaterThanOrEqual(12);
    expect(response.body.data.user.debeCambiarPassword).toBe(true);
    const audit = await prisma.adminAuditLog.findFirstOrThrow({ where: { entityId: user.id, action: 'USER_PASSWORD_RESET' } });
    expect(JSON.stringify(audit)).not.toContain(temporary);
    expect((await loginAgent(user.numeroDocumento, 'asesor', temporary)).response.status).toBe(200);
  });

  it('lista con filtros y paginación por cursor estable', async () => {
    for (let index = 0; index < 3; index++) await createTestUser(SUITE, { nombre: `Filtro Cursor ${index}` });
    const first = await agent.get('/api/admin/users').query({ search: 'Filtro Cursor', limit: 2 });
    expect(first.status).toBe(200);
    expect(first.body.data).toHaveLength(2);
    expect(first.body.meta.total).toBe(3);
    const second = await agent.get('/api/admin/users').query({ search: 'Filtro Cursor', limit: 2, cursor: first.body.meta.nextCursor });
    expect(second.body.data).toHaveLength(1);
    expect(second.body.meta.nextCursor).toBeNull();
    const ids = [...first.body.data, ...second.body.data].map((row: { id: string }) => row.id);
    expect(new Set(ids).size).toBe(3);
    expect((await agent.get('/api/admin/users').query({ limit: 500 })).status).toBe(400);
    const filtered = await agent.get('/api/admin/users').query({ role: 'administrador', status: 'activo', limit: 100 });
    expect(filtered.body.data.every((row: { rol: string; estado: string }) => row.rol === 'administrador' && row.estado === 'activo')).toBe(true);
  });

  it('mantiene la ruta antigua /api/admin/asesores como alias', async () => {
    const response = await agent.get('/api/admin/asesores').query({ buscar: 'Filtro Cursor' });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ total: 3, pagina: 1, paginas: 1 });
  });
});
