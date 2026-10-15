import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { assertSafeDatabase } from './guard.js';

// Datos ficticios para revisar a mano todos los estados del panel y del área del asesor.
// Todo dato demo se identifica por: documentos 1000000100–1000000199, correos @demo.fontana.test,
// nombres "Demo · ...", motivos e idempotencyKey "demo-..." y certificados "FSG-DEMO-...".
// Uso: npm run db:seed:demo  |  npm run db:seed:demo:clean -- --yes

// Contraseñas por defecto para bases locales. En una base compartida se pasan DEMO_PASSWORD y
// DEMO_ADMIN_PASSWORD por entorno para no usar valores publicados en el repositorio.
export const DEMO_PASSWORD = 'FontanaDemo2026!';
export const DEMO_ADMIN_PASSWORD = 'FontanaAdminDemo2026!';
const advisorPassword = () => process.env.DEMO_PASSWORD || DEMO_PASSWORD;
const adminPassword = () => process.env.DEMO_ADMIN_PASSWORD || DEMO_ADMIN_PASSWORD;
export const DEMO_DOC_MIN = 1000000100;
export const DEMO_DOC_MAX = 1000000199;
export const DEMO_EVALUATION_TITLE = 'Demo · evaluación de prueba';
export const DEMO_EXTRA_ACTIVITY_TITLE = 'Demo · actividad retirada';

export type DemoRow = { documento: string; nombre: string; escenario: string; esperado: string };

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// PRNG con semilla fija: el volumen demo sale siempre igual.
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SCENARIOS: DemoRow[] = [
  { documento: '1000000100', nombre: 'Demo · Admin Pruebas', escenario: 'Administrador demo, actor de excepciones y auditoría', esperado: 'Entra al panel y ve todos los escenarios' },
  { documento: '1000000101', nombre: 'Demo · Asesor Nuevo', escenario: 'Recién creado, debe completar datos', esperado: '/llena-tus-datos; luego módulo 1 AVAILABLE y el resto BLOCKED' },
  { documento: '1000000102', nombre: 'Demo · Asesor En Curso', escenario: 'Módulo 1 con intento abierto', esperado: 'Módulo 1 IN_PROGRESS con "Continuar"' },
  { documento: '1000000103', nombre: 'Demo · Asesor Aprobado M1', escenario: 'Módulo 1 aprobado (85) con sello', esperado: 'M1 Completado, M2 disponible, M3 bloqueado' },
  { documento: '1000000104', nombre: 'Demo · Asesor Agotado', escenario: 'Tres intentos fallidos (40, 55, 62)', esperado: 'M1 FAILED sin intentos; candidato a reactivar' },
  { documento: '1000000105', nombre: 'Demo · Asesor En Espera', escenario: 'Intento fallido hace 5 minutos', esperado: 'No puede intentar hasta que pasen 30 minutos' },
  { documento: '1000000106', nombre: 'Demo · Asesor Reactivado', escenario: 'Agotado con EXTRA_ATTEMPT +1 vigente', esperado: '"Continuar" y el siguiente intento es el número 4' },
  { documento: '1000000107', nombre: 'Demo · Asesor Excepción Vencida', escenario: 'UNLOCK del módulo 2 ya vencido', esperado: 'Excepción en historial; M2 bloqueado' },
  { documento: '1000000108', nombre: 'Demo · Asesor Excepción Revocada', escenario: 'REACTIVATE revocada', esperado: 'Revocada en la ficha; M1 sigue sin intentos' },
  { documento: '1000000109', nombre: 'Demo · Asesor Completo', escenario: 'Módulos 1 a 3 aprobados y FSG-DEMO-0001', esperado: '"Ver certificado"; certificado ACTIVE en el panel' },
  { documento: '1000000110', nombre: 'Demo · Asesor Certificado Reemitido', escenario: 'Certificado REVOKED y reemitido', esperado: 'Ficha con dos versiones enlazadas' },
  { documento: '1000000111', nombre: 'Demo · Asesor Sin Sellos', escenario: 'Módulos 1 y 2 aprobados', esperado: 'Certificado BLOCKED: falta Tipificación de llamadas' },
  { documento: '1000000112', nombre: 'Demo · Asesor Detenido', escenario: 'Último avance hace 15 días en M2', esperado: 'Aparece en "Asesores detenidos" (days=7)' },
  { documento: '1000000113', nombre: 'Demo · Asesor Inactivo', escenario: 'Inactivo con historial', esperado: 'No inicia sesión; historial visible; no cuenta como activo' },
  { documento: '1000000114', nombre: 'Demo · Asesor Bloqueado', escenario: 'Bloqueado con motivo auditado', esperado: 'No inicia sesión (mensaje genérico); sesión previa inválida' },
  { documento: '1000000115', nombre: 'Demo · Asesor Reabierto', escenario: 'M2 aprobado con REOPEN_MODULE vigente', esperado: 'Puede volver a entrar a M2 y conserva el sello' },
];

export async function runDemoSeed(log: (line: string) => void = console.log): Promise<DemoRow[]> {
  const { prisma } = await import('../server/config/prisma.js');
  const bcrypt = (await import('bcryptjs')).default;
  const { seedCatalog } = await import('./seed-base.js');
  const userService = await import('../server/services/user.service.js');
  const authService = await import('../server/services/auth.service.js');
  const attemptService = await import('../server/services/attempt.service.js');
  const overrideService = await import('../server/services/override.service.js');
  const certificateService = await import('../server/services/certificate.service.js');
  const catalogService = await import('../server/services/catalog.service.js');
  const { processTypingEvent } = await import('../server/integrations/typing.js');
  const { audit } = await import('../server/services/audit.service.js');
  const { findSessionUser } = await import('../server/repositories/usuario.repository.js');

  const now = new Date();
  const ago = (ms: number) => new Date(now.getTime() - ms);

  if ((await prisma.trainingModule.count()) < 4) await seedCatalog(prisma);
  const modules = await prisma.trainingModule.findMany({ include: { activities: { where: { order: 1 } } }, orderBy: { order: 'asc' } });
  const activityOf = (slug: string) => modules.find((module) => module.slug === slug)!.activities[0]!.id;
  const A1 = activityOf('ofimatica-mecanografia');
  const A2 = activityOf('simulador-cobranzas');
  const A3 = activityOf('tipificacion-llamadas');

  // Administrador demo: se crea directamente (no hay otro actor) y se audita a sí mismo.
  const adminRow = SCENARIOS[0]!;
  let admin = await prisma.usuario.findUnique({ where: { numeroDocumento: adminRow.documento } });
  if (!admin) {
    admin = await prisma.usuario.create({
      data: {
        nombreCompleto: adminRow.nombre, numeroDocumento: adminRow.documento, correo: `demo.${adminRow.documento}@demo.fontana.test`,
        passwordHash: await bcrypt.hash(adminPassword(), 12), rol: 'administrador', estado: 'activo', debeCompletarDatos: false,
      },
    });
    await audit(prisma, { actorUserId: admin.id, requestId: 'demo-seed', ip: '127.0.0.1' }, {
      action: 'USER_CREATED', entityType: 'Usuario', entityId: admin.id, reason: 'demo-administrador de pruebas',
      after: { id: admin.id, nombreCompleto: admin.nombreCompleto, numeroDocumento: admin.numeroDocumento, rol: admin.rol },
    });
  }
  const ctx = { actorUserId: admin.id, requestId: 'demo-seed', ip: '127.0.0.1' };

  // Evaluación demo v1 en las actividades placeholder de los módulos 1 a 3.
  for (const activityId of [A1, A2, A3]) {
    const existing = await prisma.evaluation.findFirst({ where: { activityId, status: 'ACTIVE' } });
    if (!existing) {
      await catalogService.createEvaluationVersion(activityId, { minimumScore: 70, maxAttempts: 3, waitMinutes: 30, title: DEMO_EVALUATION_TITLE, reason: 'demo-evaluación para probar intentos' }, ctx);
    }
  }

  // Crea el asesor con el servicio real. Si ya existe, el escenario se considera hecho (idempotencia).
  async function advisor(documento: string, nombre: string, options: { completeProfile?: boolean } = {}): Promise<{ id: string; created: boolean }> {
    const existing = await prisma.usuario.findUnique({ where: { numeroDocumento: documento }, select: { id: true } });
    if (existing) return { id: existing.id, created: false };
    const user = await userService.createUser({
      nombreCompleto: nombre, numeroDocumento: documento, rol: 'asesor', password: advisorPassword(), correo: `demo.${documento}@demo.fontana.test`,
    }, ctx);
    if (options.completeProfile !== false) {
      const session = await findSessionUser(user.id);
      await authService.completarDatos(session!, { correo: `demo.${documento}@demo.fontana.test`, telefono: '3000000000' });
    }
    return { id: user.id, created: true };
  }

  // Un intento completo: empieza en `at` y se envía `duration` segundos después.
  async function cycle(userId: string, activityId: string, score: number, at: Date, duration = 600) {
    const { attempt } = await attemptService.startAttempt(userId, activityId, { now: at });
    return attemptService.submitAttempt(userId, attempt.id, { score, durationSeconds: duration, now: new Date(at.getTime() + duration * 1000) });
  }

  async function passModules(userId: string, count: number, start: Date, step = DAY) {
    const activities = [A1, A2, A3].slice(0, count);
    for (const [index, activityId] of activities.entries()) await cycle(userId, activityId, 80 + index * 4, new Date(start.getTime() + index * step), 900 + index * 120);
  }

  async function exhaust(userId: string, lastAt: Date) {
    await cycle(userId, A1, 40, new Date(lastAt.getTime() - 3 * HOUR), 420);
    await cycle(userId, A1, 55, new Date(lastAt.getTime() - 2 * HOUR), 510);
    await cycle(userId, A1, 62, new Date(lastAt.getTime() - 5 * MIN), 300);
  }

  const doc = (index: number) => SCENARIOS[index]!;

  // 101 Nuevo: sin actividad y con datos pendientes.
  await advisor(doc(1).documento, doc(1).nombre, { completeProfile: false });

  // 102 En curso: intento abierto en el módulo 1.
  { const u = await advisor(doc(2).documento, doc(2).nombre); if (u.created) await attemptService.startAttempt(u.id, A1, { now: ago(20 * MIN) }); }

  // 103 Aprobado M1 con 85.
  { const u = await advisor(doc(3).documento, doc(3).nombre); if (u.created) await cycle(u.id, A1, 85, ago(2 * DAY), 840); }

  // 104 Agotado: 40, 55, 62; el último enviado hace 10 minutos.
  { const u = await advisor(doc(4).documento, doc(4).nombre); if (u.created) await exhaust(u.id, ago(10 * MIN)); }

  // 105 En espera: un fallo hace 5 minutos.
  { const u = await advisor(doc(5).documento, doc(5).nombre); if (u.created) await cycle(u.id, A1, 50, ago(5 * MIN + 300 * 1000), 300); }

  // 106 Reactivado: agotado hace horas y EXTRA_ATTEMPT +1 vigente.
  {
    const u = await advisor(doc(6).documento, doc(6).nombre);
    if (u.created) {
      await exhaust(u.id, ago(2 * HOUR));
      await overrideService.reactivate(u.id, A1, { action: 'EXTRA_ATTEMPT', extraAttempts: 1, reason: 'demo-intento adicional por falla de conexión' }, 'demo-0106-extra-attempt', ctx);
    }
  }

  // 107 Excepción vencida: UNLOCK del módulo 2 creado hace 3 días y vencido ayer.
  {
    const u = await advisor(doc(7).documento, doc(7).nombre);
    if (u.created) {
      await overrideService.reactivate(u.id, A2, { action: 'UNLOCK', reason: 'demo-desbloqueo temporal del simulador', expiresAt: ago(DAY) }, 'demo-0107-unlock', ctx, ago(3 * DAY));
    }
  }

  // 108 Excepción revocada: REACTIVATE sobre M1 agotado y luego revocada.
  {
    const u = await advisor(doc(8).documento, doc(8).nombre);
    if (u.created) {
      await exhaust(u.id, ago(DAY));
      const { override } = await overrideService.reactivate(u.id, A1, { action: 'REACTIVATE', reason: 'demo-reactivación otorgada por error' }, 'demo-0108-reactivate', ctx);
      await overrideService.revoke(override.id, 'demo-se revoca porque no correspondía', ctx);
    }
  }

  // 109 Completo con certificado FSG-DEMO-0001.
  {
    const u = await advisor(doc(9).documento, doc(9).nombre);
    if (u.created) {
      await passModules(u.id, 3, ago(10 * DAY));
      await prisma.$transaction((tx) => certificateService.issue(tx, u.id, ctx, { code: 'FSG-DEMO-0001' }));
    }
  }

  // 110 Certificado anulado y reemitido.
  {
    const u = await advisor(doc(10).documento, doc(10).nombre);
    if (u.created) {
      await passModules(u.id, 3, ago(12 * DAY));
      const first = await prisma.$transaction((tx) => certificateService.issue(tx, u.id, ctx, { code: 'FSG-DEMO-0002' }));
      await certificateService.revoke(first.id, 'demo-nombre mal escrito en el certificado', ctx);
      await certificateService.reissue(first.id, 'demo-reemisión con datos corregidos', ctx, { code: 'FSG-DEMO-0003' });
    }
  }

  // 111 Sin sellos completos: M1 y M2 aprobados.
  { const u = await advisor(doc(11).documento, doc(11).nombre); if (u.created) await passModules(u.id, 2, ago(6 * DAY)); }

  // 112 Detenido: M1 hace 20 días y último avance en M2 hace 15 días.
  {
    const u = await advisor(doc(12).documento, doc(12).nombre);
    if (u.created) {
      await cycle(u.id, A1, 78, ago(20 * DAY), 960);
      await cycle(u.id, A2, 45, ago(15 * DAY), 1100);
    }
  }

  // 113 Inactivo con historial.
  {
    const u = await advisor(doc(13).documento, doc(13).nombre);
    if (u.created) {
      await cycle(u.id, A1, 74, ago(9 * DAY), 700);
      await cycle(u.id, A2, 50, ago(8 * DAY), 800);
      await userService.changeStatus(u.id, { estado: 'inactivo', reason: 'demo-retiro voluntario del proceso' }, ctx);
    }
  }

  // 114 Bloqueado: el bloqueo invalida la sesión (versionSesion).
  {
    const u = await advisor(doc(14).documento, doc(14).nombre);
    if (u.created) await userService.changeStatus(u.id, { estado: 'bloqueado', reason: 'demo-bloqueo por uso indebido de credenciales' }, ctx);
  }

  // 115 Reabierto: M2 aprobado con REOPEN_MODULE vigente.
  {
    const u = await advisor(doc(15).documento, doc(15).nombre);
    if (u.created) {
      await passModules(u.id, 2, ago(7 * DAY));
      await overrideService.reactivate(u.id, A2, { action: 'REOPEN_MODULE', reason: 'demo-repaso solicitado por coordinación' }, 'demo-0115-reopen', ctx);
    }
  }

  // 116–145: volumen con avances variados en los últimos 60 días.
  const random = mulberry32(2026);
  const volume: DemoRow[] = [];
  for (let index = 1; index <= 30; index++) {
    const documento = String(1000000115 + index);
    const nombre = `Demo · Asesor ${String(index).padStart(2, '0')}`;
    const level = Math.floor(random() * 5);
    const start = ago(Math.floor(15 + random() * 45) * DAY);
    const failures = Math.floor(random() * 3);
    volume.push({ documento, nombre, escenario: `Volumen nivel ${level}`, esperado: ['Sin avance', 'Módulo 1 en curso', 'M1 aprobado', 'M1 y M2 aprobados', 'M1 a M3 aprobados'][level]! });
    const u = await advisor(documento, nombre);
    if (!u.created) continue;
    let cursor = start.getTime();
    const step = () => { cursor += Math.floor((0.5 + random() * 2) * DAY); return new Date(Math.min(cursor, now.getTime() - HOUR)); };
    if (level === 0) continue;
    if (level === 1) {
      for (let f = 0; f < Math.min(failures, 2); f++) await cycle(u.id, A1, 30 + Math.floor(random() * 35), step(), 300 + Math.floor(random() * 900));
      if (random() < 0.5) await attemptService.startAttempt(u.id, A1, { now: step() });
      continue;
    }
    for (const [position, activityId] of [A1, A2, A3].slice(0, level - 1).entries()) {
      if (position === 0) for (let f = 0; f < Math.min(failures, 2); f++) await cycle(u.id, activityId, 30 + Math.floor(random() * 35), step(), 300 + Math.floor(random() * 900));
      await cycle(u.id, activityId, 70 + Math.floor(random() * 30), step(), 600 + Math.floor(random() * 1500));
    }
  }

  // Mecanografía: resultados vía el mismo procesamiento del webhook.
  const typingDocs = ['1000000103', '1000000109', '1000000110', '1000000111', '1000000112', '1000000113', '1000000115', '1000000116', '1000000117', '1000000118', '1000000119'];
  for (const [index, documento] of typingDocs.entries()) {
    await processTypingEvent({
      eventId: `demo-typing-${documento}`, numeroDocumento: documento,
      wpm: 25 + Math.floor(random() * 46), accuracy: Number((85 + random() * 14).toFixed(2)), errors: Math.floor(random() * 21),
      occurredAt: ago((index + 1) * DAY).toISOString(),
    });
  }
  // Duplicado del primero: no crea otro resultado. Fallido: documento demo inexistente.
  await processTypingEvent({ eventId: `demo-typing-${typingDocs[0]}`, numeroDocumento: typingDocs[0], wpm: 40, accuracy: 90, errors: 3 });
  await processTypingEvent({ eventId: 'demo-typing-fallido', numeroDocumento: '1000000199', wpm: 33, accuracy: 88, errors: 7 });

  // Actividad extra en el módulo 3: progreso previo de dos asesores y luego desactivada globalmente.
  const module3 = modules.find((module) => module.slug === 'tipificacion-llamadas')!;
  let extra = await prisma.activity.findFirst({ where: { moduleId: module3.id, title: DEMO_EXTRA_ACTIVITY_TITLE } });
  if (!extra) {
    const order = ((await prisma.activity.aggregate({ where: { moduleId: module3.id }, _max: { order: true } }))._max.order ?? 0) + 1;
    extra = await prisma.activity.create({ data: { moduleId: module3.id, order, type: 'LESSON', status: 'ACTIVE', isRequired: false, title: DEMO_EXTRA_ACTIVITY_TITLE } });
    const holders = await prisma.usuario.findMany({ where: { numeroDocumento: { in: ['1000000109', '1000000111'] } }, select: { id: true, numeroDocumento: true } });
    for (const holder of holders) {
      await prisma.userActivityProgress.upsert({
        where: { userId_activityId: { userId: holder.id, activityId: extra.id } },
        create: { userId: holder.id, activityId: extra.id, status: holder.numeroDocumento === '1000000109' ? 'PASSED' : 'IN_PROGRESS', startedAt: ago(5 * DAY), lastActivityAt: ago(4 * DAY), completedAt: holder.numeroDocumento === '1000000109' ? ago(4 * DAY) : null },
        update: {},
      });
    }
    await catalogService.setActivityStatus(extra.id, 'INACTIVE', 'demo-actividad retirada del plan de formación', ctx);
  }

  const rows = [...SCENARIOS, ...volume];
  log('\nDatos demo listos. Contraseñas en README (sección Datos demo).');
  log('Documento   | Nombre                                 | Escenario');
  for (const row of rows) log(`${row.documento} | ${row.nombre.padEnd(38)} | ${row.escenario} → ${row.esperado}`);
  return rows;
}

// Elimina solo datos demo, en orden inverso de dependencias y en una transacción.
export async function cleanDemo(confirm: boolean, log: (line: string) => void = console.log): Promise<Record<string, number>> {
  const { prisma } = await import('../server/config/prisma.js');
  const demoUsers = await prisma.usuario.findMany({
    where: { numeroDocumento: { gte: String(DEMO_DOC_MIN), lte: String(DEMO_DOC_MAX) }, nombreCompleto: { startsWith: 'Demo · ' } },
    select: { id: true },
  });
  const userIds = demoUsers.map((user) => user.id);
  const demoEvaluations = await prisma.evaluation.findMany({ where: { title: DEMO_EVALUATION_TITLE, attempts: { none: { userId: { notIn: userIds } } } }, select: { id: true } });
  const demoActivities = await prisma.activity.findMany({ where: { title: DEMO_EXTRA_ACTIVITY_TITLE }, select: { id: true } });
  const evaluationIds = demoEvaluations.map((evaluation) => evaluation.id);
  const activityIds = demoActivities.map((activity) => activity.id);
  const attempts = await prisma.attempt.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
  const attemptIds = attempts.map((attempt) => attempt.id);
  const overrides = await prisma.userActivityOverride.findMany({ where: { OR: [{ userId: { in: userIds } }, { idempotencyKey: { startsWith: 'demo-' } }] }, select: { id: true } });
  const certificates = await prisma.certificate.findMany({ where: { OR: [{ userId: { in: userIds } }, { code: { startsWith: 'FSG-DEMO-' } }] }, select: { id: true } });
  const entityIds = [...userIds, ...overrides.map((o) => o.id), ...certificates.map((c) => c.id), ...evaluationIds, ...activityIds];

  const whereAudit = { OR: [{ actorUserId: { in: userIds } }, { entityId: { in: entityIds } }] };
  const plan: Record<string, number> = {
    auditoria_admin: await prisma.adminAuditLog.count({ where: whereAudit }),
    eventos_webhook: await prisma.webhookEvent.count({ where: { providerEventId: { startsWith: 'demo-' } } }),
    resultados_mecanografia: await prisma.typingResult.count({ where: { OR: [{ userId: { in: userIds } }, { providerEventId: { startsWith: 'demo-' } }] } }),
    resultados_simulador: await prisma.simulatorResult.count({ where: { attemptId: { in: attemptIds } } }),
    resultados_tipificacion: await prisma.typificationResult.count({ where: { attemptId: { in: attemptIds } } }),
    respuestas_intento: await prisma.attemptAnswer.count({ where: { attemptId: { in: attemptIds } } }),
    sellos: await prisma.seal.count({ where: { userId: { in: userIds } } }),
    certificados: certificates.length,
    intentos: attemptIds.length,
    excepciones_actividad: overrides.length,
    progreso_actividad: await prisma.userActivityProgress.count({ where: { OR: [{ userId: { in: userIds } }, { activityId: { in: activityIds } }] } }),
    progreso_modulo: await prisma.userModuleProgress.count({ where: { userId: { in: userIds } } }),
    perfiles_asesor: await prisma.advisorProfile.count({ where: { userId: { in: userIds } } }),
    evaluaciones: evaluationIds.length,
    actividades: activityIds.length,
    usuarios: userIds.length,
  };
  log('Registros demo a eliminar:');
  for (const [table, count] of Object.entries(plan)) log(`  ${table.padEnd(26)} ${count}`);
  if (!confirm) { log('No se borró nada. Repite con --yes para confirmar.'); return plan; }

  await prisma.$transaction(async (tx) => {
    await tx.adminAuditLog.deleteMany({ where: whereAudit });
    await tx.webhookEvent.deleteMany({ where: { providerEventId: { startsWith: 'demo-' } } });
    await tx.typingResult.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { providerEventId: { startsWith: 'demo-' } }] } });
    await tx.simulatorResult.deleteMany({ where: { attemptId: { in: attemptIds } } });
    await tx.typificationResult.deleteMany({ where: { attemptId: { in: attemptIds } } });
    await tx.attemptAnswer.deleteMany({ where: { attemptId: { in: attemptIds } } });
    await tx.seal.deleteMany({ where: { userId: { in: userIds } } });
    await tx.certificate.updateMany({ where: { id: { in: certificates.map((c) => c.id) } }, data: { previousCertificateId: null } });
    await tx.certificate.deleteMany({ where: { id: { in: certificates.map((c) => c.id) } } });
    await tx.attempt.deleteMany({ where: { id: { in: attemptIds } } });
    await tx.userActivityOverride.deleteMany({ where: { id: { in: overrides.map((o) => o.id) } } });
    await tx.userActivityProgress.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { activityId: { in: activityIds } }] } });
    await tx.userModuleProgress.deleteMany({ where: { userId: { in: userIds } } });
    await tx.advisorProfile.deleteMany({ where: { userId: { in: userIds } } });
    await tx.evaluation.deleteMany({ where: { id: { in: evaluationIds } } });
    await tx.activity.deleteMany({ where: { id: { in: activityIds } } });
    await tx.usuario.updateMany({ where: { id: { in: userIds } }, data: { creadoPor: null } });
    await tx.usuario.deleteMany({ where: { id: { in: userIds } } });
  }, { timeout: 60_000 });
  log('Datos demo eliminados.');
  return plan;
}

// Ejecución como script (no al importarlo desde las pruebas).
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const host = assertSafeDatabase(process.argv.includes('--clean') ? 'db:seed:demo:clean' : 'db:seed:demo');
    console.log(`Base: ${host}`);
    const { disconnect } = await import('../server/config/prisma.js');
    try {
      if (process.argv.includes('--clean')) await cleanDemo(process.argv.includes('--yes'));
      else await runDemoSeed();
    } finally {
      await disconnect();
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
