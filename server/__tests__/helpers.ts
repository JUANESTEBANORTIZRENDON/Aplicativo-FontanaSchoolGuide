import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../app.js';
import { prisma } from '../config/prisma.js';
import { rateLimitStore } from '../middleware/rateLimit.js';
import * as attemptService from '../services/attempt.service.js';
import { initializeForUser } from '../services/progress.service.js';

export const PASSWORD = 'ClaveDePrueba2026!';
export const ORIGIN = { Origin: 'http://127.0.0.1:3000', Host: '127.0.0.1:3000' };

let counter = 0;
// Documento único con el prefijo TEST- para que cada suite limpie solo lo suyo.
export function testDocument(suite: string): string {
  counter += 1;
  return `TEST-${suite}-${process.pid}-${counter}`.slice(0, 30);
}

let hash: string | null = null;
async function passwordHash(): Promise<string> {
  hash ??= await bcrypt.hash(PASSWORD, 4);
  return hash;
}

export async function createTestUser(suite: string, options: { rol?: 'asesor' | 'administrador'; estado?: string; nombre?: string } = {}) {
  const rol = options.rol ?? 'asesor';
  const user = await prisma.usuario.create({
    data: {
      nombreCompleto: options.nombre ?? `Prueba ${suite} ${counter + 1}`,
      numeroDocumento: testDocument(suite),
      passwordHash: await passwordHash(),
      rol,
      estado: options.estado ?? 'activo',
      debeCompletarDatos: false,
    },
  });
  if (rol === 'asesor') await prisma.$transaction((tx) => initializeForUser(tx, user.id));
  return user;
}

export async function loginAgent(documento: string, tipo: 'asesor' | 'administrador', password = PASSWORD) {
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/login').set(ORIGIN).send({ identificador: documento, password, tipo });
  return { agent, response };
}

export function resetRateLimits(): void {
  rateLimitStore.clear();
}

// Actividades del catálogo. a1 es la mecanografía del módulo 1 (tres intentos, sin espera, nota mínima 100:
// aprueba por la regla de caracteres por minuto). a2 y a3 son los placeholders de los módulos 2 y 3
// (evaluación demo de tres intentos y 30 minutos de espera).
export async function activityIds() {
  const modules = await prisma.trainingModule.findMany({ include: { activities: { orderBy: { order: 'asc' } } }, orderBy: { order: 'asc' } });
  const bySlug = (slug: string) => modules.find((module) => module.slug === slug)!;
  const m1 = bySlug('ofimatica-mecanografia');
  const section = (order: number) => m1.activities.find((activity) => activity.order === order)!.id;
  return {
    modules: { m1, m2: bySlug('simulador-cobranzas'), m3: bySlug('tipificacion-llamadas'), cert: bySlug('certificado') },
    office: { welcome: section(10), typing: section(20), excel: section(30), dictation: section(40), result: section(50) },
    a1: section(20),
    a2: bySlug('simulador-cobranzas').activities.find((activity) => activity.order === 1)!.id,
    a3: bySlug('tipificacion-llamadas').activities.find((activity) => activity.order === 1)!.id,
  };
}

// Aprueba las tres actividades obligatorias del módulo 1 (emite el sello y desbloquea el simulador).
export async function passOfficeModule(userId: string): Promise<void> {
  const { office } = await activityIds();
  for (const activityId of [office.typing, office.excel, office.dictation]) {
    const { attempt } = await attemptService.startAttempt(userId, activityId);
    await attemptService.submitAttempt(userId, attempt.id, { score: 100, passed: true });
  }
}

export const newKey = () => randomUUID();

// Borra solo los datos de prueba de la suite (usuarios TEST-<suite>-...) en orden de dependencias.
export async function cleanupSuite(suite: string): Promise<void> {
  const users = await prisma.usuario.findMany({ where: { numeroDocumento: { startsWith: `TEST-${suite}-` } }, select: { id: true } });
  const ids = users.map((user) => user.id);
  if (ids.length === 0) return;
  const attempts = (await prisma.attempt.findMany({ where: { userId: { in: ids } }, select: { id: true } })).map((row) => row.id);
  const overrides = (await prisma.userActivityOverride.findMany({ where: { OR: [{ userId: { in: ids } }, { createdById: { in: ids } }] }, select: { id: true } })).map((row) => row.id);
  const certificates = (await prisma.certificate.findMany({ where: { userId: { in: ids } }, select: { id: true } })).map((row) => row.id);
  await prisma.$transaction([
    prisma.adminAuditLog.deleteMany({ where: { OR: [{ actorUserId: { in: ids } }, { entityId: { in: [...ids, ...overrides, ...certificates] } }] } }),
    prisma.typingResult.deleteMany({ where: { userId: { in: ids } } }),
    prisma.typingAttemptResult.deleteMany({ where: { attemptId: { in: attempts } } }),
    prisma.excelAttemptResult.deleteMany({ where: { attemptId: { in: attempts } } }),
    prisma.dictationAttemptResult.deleteMany({ where: { attemptId: { in: attempts } } }),
    prisma.activitySectionView.deleteMany({ where: { userId: { in: ids } } }),
    prisma.attemptAnswer.deleteMany({ where: { attemptId: { in: attempts } } }),
    prisma.seal.deleteMany({ where: { userId: { in: ids } } }),
    prisma.certificate.updateMany({ where: { id: { in: certificates } }, data: { previousCertificateId: null } }),
    prisma.certificate.deleteMany({ where: { id: { in: certificates } } }),
    prisma.attempt.deleteMany({ where: { id: { in: attempts } } }),
    prisma.userActivityOverride.deleteMany({ where: { id: { in: overrides } } }),
    prisma.userActivityProgress.deleteMany({ where: { userId: { in: ids } } }),
    prisma.userModuleProgress.deleteMany({ where: { userId: { in: ids } } }),
    prisma.advisorProfile.deleteMany({ where: { userId: { in: ids } } }),
    // Las versiones de configuración y el contenido creados por usuarios de prueba se conservan sin autor.
    prisma.officeModuleConfig.updateMany({ where: { createdById: { in: ids } }, data: { createdById: null } }),
    prisma.typingText.updateMany({ where: { createdById: { in: ids } }, data: { createdById: null } }),
    prisma.excelActivity.updateMany({ where: { createdById: { in: ids } }, data: { createdById: null } }),
    prisma.dictationExercise.updateMany({ where: { createdById: { in: ids } }, data: { createdById: null } }),
    prisma.usuario.updateMany({ where: { creadoPor: { in: ids } }, data: { creadoPor: null } }),
    prisma.usuario.deleteMany({ where: { id: { in: ids } } }),
  ]);
}
