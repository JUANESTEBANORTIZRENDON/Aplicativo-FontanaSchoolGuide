import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../app.js';
import { prisma } from '../config/prisma.js';
import { LOGIN_LIMITS } from '../config/security.js';
import { firmarSesion } from '../services/session.service.js';
import { cleanupSuite, createTestUser, loginAgent, ORIGIN, resetRateLimits } from './helpers.js';

const SUITE = 'auth';

describe('autenticación', () => {
  beforeEach(resetRateLimits);
  afterAll(() => cleanupSuite(SUITE));

  it('inicia sesión con cookie HttpOnly y SameSite=Lax', async () => {
    const user = await createTestUser(SUITE);
    const { response } = await loginAgent(user.numeroDocumento, 'asesor');
    expect(response.status).toBe(200);
    expect(response.body.usuario.ruta).toBe('/induccion');
    expect(response.body.usuario).not.toHaveProperty('passwordHash');
    const cookie = String(response.headers['set-cookie']);
    expect(cookie).toMatch(/fontana_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    const updated = await prisma.usuario.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.ultimoAcceso).not.toBeNull();
  });

  it('responde un mensaje genérico ante credenciales inválidas', async () => {
    const user = await createTestUser(SUITE);
    const wrong = await loginAgent(user.numeroDocumento, 'asesor', 'otra-clave-123');
    const missing = await loginAgent('TEST-no-existe', 'asesor');
    expect(wrong.response.status).toBe(401);
    expect(missing.response.status).toBe(401);
    expect(wrong.response.body.message).toBe(missing.response.body.message);
    expect(wrong.response.body).toMatchObject({ status: 'error', code: 'INVALID_CREDENTIALS' });
    expect(wrong.response.body.requestId).toBeTruthy();
  });

  it('rechaza usuarios inactivos y bloqueados con el mismo mensaje', async () => {
    const inactive = await createTestUser(SUITE, { estado: 'inactivo' });
    const locked = await createTestUser(SUITE, { estado: 'bloqueado' });
    const a = await loginAgent(inactive.numeroDocumento, 'asesor');
    const b = await loginAgent(locked.numeroDocumento, 'asesor');
    expect(a.response.status).toBe(401);
    expect(b.response.status).toBe(401);
    expect(a.response.body.message).toBe('Credenciales incorrectas o cuenta inactiva.');
    expect(b.response.body.message).toBe(a.response.body.message);
  });

  it('no permite entrar como administrador con un asesor ni identificarse por nombre', async () => {
    const user = await createTestUser(SUITE, { nombre: 'Nombre Unico Prueba Auth' });
    expect((await loginAgent(user.numeroDocumento, 'administrador')).response.status).toBe(401);
    expect((await loginAgent('Nombre Unico Prueba Auth', 'asesor')).response.status).toBe(401);
  });

  it('limita los intentos fallidos por IP e identificador', async () => {
    const user = await createTestUser(SUITE);
    for (let index = 0; index < LOGIN_LIMITS.perIdentifier; index++) {
      expect((await loginAgent(user.numeroDocumento, 'asesor', 'clave-incorrecta')).response.status).toBe(401);
    }
    const blocked = await loginAgent(user.numeroDocumento, 'asesor');
    expect(blocked.response.status).toBe(429);
    expect(blocked.response.body.code).toBe('TOO_MANY_REQUESTS');
  });

  it('cierra sesión y borra la cookie', async () => {
    const user = await createTestUser(SUITE);
    const { agent } = await loginAgent(user.numeroDocumento, 'asesor');
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    const out = await agent.post('/api/auth/logout').set(ORIGIN);
    expect(out.status).toBe(204);
    expect(String(out.headers['set-cookie'])).toMatch(/fontana_session=;/);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('invalida la sesión de inmediato al desactivar (versión de sesión)', async () => {
    const admin = await createTestUser(SUITE, { rol: 'administrador' });
    const user = await createTestUser(SUITE);
    const advisor = await loginAgent(user.numeroDocumento, 'asesor');
    const adminSession = await loginAgent(admin.numeroDocumento, 'administrador');
    expect((await advisor.agent.get('/api/advisor/modules')).status).toBe(200);
    const status = await adminSession.agent.patch(`/api/admin/users/${user.id}/status`).set(ORIGIN).send({ estado: 'inactivo', reason: 'Prueba de invalidación de sesión' });
    expect(status.status).toBe(200);
    // Aunque se reactive, la cookie anterior tiene otra versión y ya no sirve.
    await adminSession.agent.patch(`/api/admin/users/${user.id}/status`).set(ORIGIN).send({ estado: 'activo', reason: 'Reactivación de prueba de sesión' });
    const after = await advisor.agent.get('/api/advisor/modules');
    expect(after.status).toBe(401);
    expect(after.body.code).toBe('SESSION_INVALID');
  });

  it('"cerrar todas las sesiones" invalida otras cookies del usuario', async () => {
    const user = await createTestUser(SUITE);
    const first = await loginAgent(user.numeroDocumento, 'asesor');
    const second = await loginAgent(user.numeroDocumento, 'asesor');
    expect((await second.agent.post('/api/auth/logout-all').set(ORIGIN)).status).toBe(204);
    expect((await first.agent.get('/api/auth/me')).status).toBe(401);
  });

  it('trata como inválidas las cookies antiguas sin versión', async () => {
    const user = await createTestUser(SUITE);
    const legacy = firmarSesion(user.id, 0).split('.')[0]!;
    const payload = Buffer.from(JSON.stringify({ userId: user.id, expires: Date.now() + 60_000 })).toString('base64url');
    expect(legacy).not.toBe(payload);
    const { createHmac } = await import('node:crypto');
    const signature = createHmac('sha256', process.env.SESSION_SECRET!).update(payload).digest('base64url');
    const response = await request(app).get('/api/auth/me').set('Cookie', `fontana_session=${payload}.${signature}`);
    expect(response.status).toBe(401);
    const valid = await request(app).get('/api/auth/me').set('Cookie', `fontana_session=${firmarSesion(user.id, 0)}`);
    expect(valid.status).toBe(200);
  });

  it('controla el acceso por rol', async () => {
    const user = await createTestUser(SUITE);
    const admin = await createTestUser(SUITE, { rol: 'administrador' });
    const advisor = await loginAgent(user.numeroDocumento, 'asesor');
    const adminSession = await loginAgent(admin.numeroDocumento, 'administrador');
    expect((await advisor.agent.get('/api/admin/users')).status).toBe(403);
    expect((await adminSession.agent.get('/api/advisor/modules')).status).toBe(403);
    expect((await request(app).get('/api/advisor/modules')).status).toBe(401);
    const me = await adminSession.agent.get('/api/auth/me');
    expect(me.body.usuario.ruta).toBe('/admin');
    expect(me.body.permisos).toContain('admin:auditoria');
  });

  it('guarda la experiencia y envía al asesor a su ruta de práctica', async () => {
    const user = await createTestUser(SUITE);
    const { agent } = await loginAgent(user.numeroDocumento, 'asesor');
    expect((await agent.post('/api/auth/experiencia').set(ORIGIN).send({ tieneExperienciaCobranzasDigitales: 'si' })).status).toBe(400);
    const saved = await agent.post('/api/auth/experiencia').set(ORIGIN).send({ tieneExperienciaCobranzasDigitales: true });
    expect(saved.status).toBe(200);
    expect(saved.body.usuario.ruta).toBe('/practica/experiencia');
    expect((await agent.get('/api/auth/me')).body.usuario.ruta).toBe('/practica/experiencia');
    // La ruta de formación sigue disponible para el asesor con práctica asignada.
    expect((await agent.get('/api/advisor/modules')).status).toBe(200);
    const pending = await createTestUser(SUITE);
    await prisma.usuario.update({ where: { id: pending.id }, data: { debeCompletarDatos: true } });
    const other = await loginAgent(pending.numeroDocumento, 'asesor');
    expect((await other.agent.post('/api/auth/experiencia').set(ORIGIN).send({ tieneExperienciaCobranzasDigitales: false })).status).toBe(403);
  });

  it('guarda el avance de la inducción una sola vez y lo conserva al volver', async () => {
    const user = await createTestUser(SUITE);
    const { agent } = await loginAgent(user.numeroDocumento, 'asesor');
    const inicial = (await agent.get('/api/auth/me')).body.usuario;
    expect(inicial).toMatchObject({ historiaCompletada: false, metodoCompletado: false });
    expect((await agent.post('/api/auth/induccion/avance').set(ORIGIN).send({ paso: 'otro' })).status).toBe(400);
    const historia = await agent.post('/api/auth/induccion/avance').set(ORIGIN).send({ paso: 'historia' });
    expect(historia.status).toBe(200);
    expect(historia.body.usuario).toMatchObject({ historiaCompletada: true, metodoCompletado: false, ruta: '/induccion' });
    const primera = (await prisma.usuario.findUniqueOrThrow({ where: { id: user.id } })).fechaHistoriaCompletada;
    // Repetirlo no cambia la fecha de la primera vez.
    await agent.post('/api/auth/induccion/avance').set(ORIGIN).send({ paso: 'historia' });
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: user.id } })).fechaHistoriaCompletada).toEqual(primera);
    const metodo = await agent.post('/api/auth/induccion/avance').set(ORIGIN).send({ paso: 'metodo' });
    expect(metodo.body.usuario).toMatchObject({ historiaCompletada: true, metodoCompletado: true });
    // Responder la experiencia marca ambas partes como completadas aunque no se hayan registrado antes.
    const directo = await createTestUser(SUITE);
    const otro = await loginAgent(directo.numeroDocumento, 'asesor');
    const saved = await otro.agent.post('/api/auth/experiencia').set(ORIGIN).send({ tieneExperienciaCobranzasDigitales: false });
    expect(saved.body.usuario).toMatchObject({ historiaCompletada: true, metodoCompletado: true, ruta: '/practica/nuevo' });
  });

  it('rechaza escrituras de otro origen (CSRF)', async () => {
    const response = await request(app).post('/api/auth/login').set({ Origin: 'https://otro-sitio.test', Host: '127.0.0.1:3000' }).send({ identificador: 'x', password: 'y', tipo: 'asesor' });
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('ORIGIN_NOT_ALLOWED');
  });
});
