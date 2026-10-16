import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma.js';
import * as attemptService from '../services/attempt.service.js';
import { DEFAULT_OFFICE_CONFIG, type OfficeConfigValues } from '../domain/office.js';
import * as configService from '../services/office-config.service.js';
import * as typingService from '../services/office-typing.service.js';
import { activityIds, cleanupSuite, createTestUser, loginAgent, newKey, ORIGIN, passOfficeModule } from './helpers.js';

const SUITE = 'off';
const SEC = 1000;
type Agent = Awaited<ReturnType<typeof loginAgent>>['agent'];

// Los tiempos se inyectan: la prueba de 60 segundos no espera 60 segundos.
const base = () => new Date(Date.now() - 3 * 60 * 60_000);
const at = (start: Date, seconds: number) => new Date(start.getTime() + seconds * SEC);

async function textOf(attemptId: string): Promise<string> {
  const result = await prisma.typingAttemptResult.findUniqueOrThrow({ where: { attemptId }, include: { text: true } });
  return result.text.content;
}

// Deja la configuración con los valores iniciales aunque una corrida anterior se haya interrumpido.
async function resetConfig(): Promise<void> {
  const actor = await createTestUser(SUITE, { rol: 'administrador' });
  const current = await configService.activeConfig();
  const diff: Partial<OfficeConfigValues> = {};
  for (const key of Object.keys(DEFAULT_OFFICE_CONFIG) as (keyof OfficeConfigValues)[]) if (current[key] !== DEFAULT_OFFICE_CONFIG[key]) diff[key] = DEFAULT_OFFICE_CONFIG[key];
  if (Object.keys(diff).length) await configService.updateConfig(diff, 'Restablece los valores iniciales de la prueba', { actorUserId: actor.id });
}

describe('módulo Ofimática: acceso y estado', () => {
  let ids: Awaited<ReturnType<typeof activityIds>>;
  let admin: Agent;
  beforeAll(async () => {
    await resetConfig();
    ids = await activityIds();
    const user = await createTestUser(SUITE, { rol: 'administrador' });
    admin = (await loginAgent(user.numeroDocumento, 'administrador')).agent;
  });
  afterAll(() => cleanupSuite(SUITE));

  it('el módulo tiene cinco actividades y el placeholder archivado se ignora', async () => {
    const m1 = await prisma.trainingModule.findUniqueOrThrow({ where: { slug: 'ofimatica-mecanografia' }, include: { activities: { orderBy: { order: 'asc' } } } });
    expect(m1.name).toBe('Ofimática para tus cobranzas');
    expect(m1.activities.map((activity) => [activity.order, activity.type, activity.status, activity.isRequired])).toEqual([
      [1, 'PLACEHOLDER', 'ARCHIVED', true],
      [10, 'LESSON', 'ACTIVE', false],
      [20, 'TYPING', 'ACTIVE', true],
      [30, 'EXCEL_PRACTICE', 'ACTIVE', true],
      [40, 'DICTATION', 'ACTIVE', true],
      [50, 'LESSON', 'ACTIVE', false],
    ]);
    const user = await createTestUser(SUITE);
    const file = (await admin.get(`/api/admin/advisors/${user.id}/progress`)).body.data;
    const titles = file.catalog[0].activities.map((activity: { title: string }) => activity.title);
    expect(titles).not.toContain('Ofimática y mecanografía: contenido en preparación');
    expect(file.catalog[0].activities).toHaveLength(5);
    // Sin la actividad archivada, el progreso depende solo de las tres obligatorias.
    expect(file.modules[0]).toMatchObject({ progressPercent: '0.00', status: 'AVAILABLE' });
  });

  it('un módulo inactivo responde 403 con el motivo también por URL directa', async () => {
    const user = await createTestUser(SUITE);
    const { agent } = await loginAgent(user.numeroDocumento, 'asesor');
    expect((await agent.get('/api/training/office/module')).status).toBe(200);
    const off = await admin.patch(`/api/admin/modules/${ids.modules.m1.id}/status`).set(ORIGIN).send({ status: 'INACTIVE', reason: 'Mantenimiento de la prueba de acceso' });
    try {
      expect(off.status).toBe(200);
      for (const path of ['/module', '/excel/activity', '/result']) {
        const blocked = await agent.get(`/api/training/office${path}`);
        expect(blocked.status, path).toBe(403);
        expect(blocked.body.details.blockedReason).toBeTruthy();
      }
      expect((await agent.post('/api/training/office/typing/attempts').set(ORIGIN)).status).toBe(403);
    } finally {
      await admin.patch(`/api/admin/modules/${ids.modules.m1.id}/status`).set(ORIGIN).send({ status: 'ACTIVE', reason: 'Fin de la prueba de acceso' });
    }
  });

  it('solo los asesores entran al módulo y nadie sin sesión', async () => {
    const response = await admin.get('/api/training/office/module');
    expect(response.status).toBe(403);
    const anonymous = await (await import('supertest')).default((await import('../app.js')).app).get('/api/training/office/module');
    expect(anonymous.status).toBe(401);
  });

  it('el estado del módulo informa dónde continuar y los umbrales vigentes', async () => {
    const user = await createTestUser(SUITE);
    const { agent } = await loginAgent(user.numeroDocumento, 'asesor');
    const state = (await agent.get('/api/training/office/module')).body.data;
    expect(state.currentSection).toBe('bienvenida');
    expect(state.sections.map((section: { key: string }) => section.key)).toEqual(['bienvenida', 'mecanografia', 'excel', 'ortografia', 'resultado']);
    expect(state.config.typing).toMatchObject({ durationSeconds: 60, minCorrectCpm: 150, minAccuracy: 90, maxAttempts: 3 });
    expect(state.config.excel).toMatchObject({ minScore: 80 });
    expect(state.config.dictation).toMatchObject({ minScore: 85, maxPlays: 6, maxAttempts: 1 });
    // Registrar la bienvenida mueve el punto de reanudación.
    expect((await agent.post('/api/training/office/sections/bienvenida/view').set(ORIGIN)).status).toBe(201);
    expect((await agent.post('/api/training/office/sections/no-existe/view').set(ORIGIN)).status).toBe(409);
    const next = (await agent.get('/api/training/office/module')).body.data;
    expect(next.currentSection).toBe('mecanografia');
  });
});

describe('mecanografía interna', () => {
  beforeAll(resetConfig);
  afterAll(() => cleanupSuite(SUITE));

  it('prepara el intento sin exponer el texto esperado fuera del texto a copiar y rechaza uno simultáneo', async () => {
    const user = await createTestUser(SUITE);
    const { agent } = await loginAgent(user.numeroDocumento, 'asesor');
    const first = await agent.post('/api/training/office/typing/attempts').set(ORIGIN);
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({ durationSeconds: 60, startWindowSeconds: 15 });
    expect(first.body.data.nonce.length).toBeGreaterThanOrEqual(40);
    expect(first.body.data.text.length).toBeGreaterThanOrEqual(650);
    const stored = await prisma.typingAttemptResult.findUniqueOrThrow({ where: { attemptId: first.body.data.attemptId } });
    expect(stored.nonceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.nonceHash).not.toBe(first.body.data.nonce);
    const second = await agent.post('/api/training/office/typing/attempts').set(ORIGIN);
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('TYPING_ATTEMPT_OPEN');
    expect(await prisma.attempt.count({ where: { userId: user.id } })).toBe(1);

    // La prueba preparada se reabre con el mismo intento y texto, y un nonce nuevo que invalida el anterior.
    const resumed = await agent.post('/api/training/office/typing/attempts/resume').set(ORIGIN);
    expect(resumed.status).toBe(200);
    expect(resumed.body.data).toMatchObject({ attemptId: first.body.data.attemptId, text: first.body.data.text });
    expect(resumed.body.data.nonce).not.toBe(first.body.data.nonce);
    const old = await agent.post(`/api/training/office/typing/attempts/${first.body.data.attemptId}/start`).set(ORIGIN);
    expect(old.status).toBe(200);
    const stale = await agent.post(`/api/training/office/typing/attempts/${first.body.data.attemptId}/complete`).set(ORIGIN)
      .send({ nonce: first.body.data.nonce, typedText: 'texto', clientDurationSeconds: 5 });
    expect(stale.body.code).toBe('NONCE_INVALID');
    // Ya iniciada, no se puede reabrir.
    expect((await agent.post('/api/training/office/typing/attempts/resume').set(ORIGIN)).body.code).toBe('TYPING_ATTEMPT_STARTED');
    expect(await prisma.attempt.count({ where: { userId: user.id } })).toBe(1);
  });

  it('calcula en el servidor, aprueba, cierra el intento y no acepta reenvíos', async () => {
    const user = await createTestUser(SUITE);
    const t0 = base();
    const prepared = await typingService.prepareAttempt(user.id, t0);
    const text = await textOf(prepared.attemptId);
    await typingService.startOfficial(user.id, prepared.attemptId, at(t0, 2));
    const typed = text.slice(0, 200);
    const result = await typingService.completeAttempt(user.id, prepared.attemptId, { nonce: prepared.nonce, typedText: typed }, at(t0, 62));
    expect(result.passed).toBe(true);
    expect(result.metrics).toMatchObject({ correctCpm: 200, accuracy: 100, errors: 0, durationSeconds: 60 });
    const attempt = await prisma.attempt.findUniqueOrThrow({ where: { id: prepared.attemptId } });
    expect(attempt).toMatchObject({ status: 'PASSED' });
    expect(Number(attempt.score)).toBe(100);
    // Reenvío: ni segundo resultado ni segundo intento.
    await expect(typingService.completeAttempt(user.id, prepared.attemptId, { nonce: prepared.nonce, typedText: typed }, at(t0, 63))).rejects.toMatchObject({ code: 'ATTEMPT_CLOSED' });
    expect(await prisma.typingAttemptResult.count({ where: { attemptId: prepared.attemptId } })).toBe(1);
    expect(await prisma.attempt.count({ where: { userId: user.id } })).toBe(1);
    const progress = await prisma.userActivityProgress.findFirstOrThrow({ where: { userId: user.id, status: 'PASSED' } });
    expect(progress.attemptsUsed).toBe(1);
  });

  it('rechaza un nonce inválido y los intentos de otro asesor', async () => {
    const owner = await createTestUser(SUITE);
    const other = await createTestUser(SUITE);
    const t0 = base();
    const prepared = await typingService.prepareAttempt(owner.id, t0);
    await typingService.startOfficial(owner.id, prepared.attemptId, at(t0, 1));
    await expect(typingService.completeAttempt(owner.id, prepared.attemptId, { nonce: `${prepared.nonce.slice(0, -2)}xx`, typedText: 'hola' }, at(t0, 61))).rejects.toMatchObject({ code: 'NONCE_INVALID' });
    await expect(typingService.completeAttempt(other.id, prepared.attemptId, { nonce: prepared.nonce, typedText: 'hola' }, at(t0, 61))).rejects.toMatchObject({ code: 'ATTEMPT_NOT_FOUND' });
    await expect(typingService.startOfficial(other.id, prepared.attemptId, at(t0, 1))).rejects.toMatchObject({ code: 'ATTEMPT_NOT_FOUND' });
    // El intento sigue abierto para su dueño.
    const attempt = await prisma.attempt.findUniqueOrThrow({ where: { id: prepared.attemptId } });
    expect(attempt.status).toBe('IN_PROGRESS');
  });

  it('un cierre fuera de la ventana de tiempo falla el intento como EXPIRED', async () => {
    const user = await createTestUser(SUITE);
    const t0 = base();
    const prepared = await typingService.prepareAttempt(user.id, t0);
    await typingService.startOfficial(user.id, prepared.attemptId, at(t0, 1));
    // 15 s de arranque + 60 s de prueba + 5 s de gracia = 80 s después del inicio oficial.
    await expect(typingService.completeAttempt(user.id, prepared.attemptId, { nonce: prepared.nonce, typedText: (await textOf(prepared.attemptId)).slice(0, 200) }, at(t0, 90)))
      .rejects.toMatchObject({ code: 'TYPING_TIME_EXPIRED' });
    const result = await prisma.typingAttemptResult.findUniqueOrThrow({ where: { attemptId: prepared.attemptId } });
    expect(result).toMatchObject({ closeReason: 'EXPIRED', passed: false });
    expect((await prisma.attempt.findUniqueOrThrow({ where: { id: prepared.attemptId } })).status).toBe('FAILED');
  });

  it('exige la práctica breve tras fallar y cuenta el intento abandonado', async () => {
    const user = await createTestUser(SUITE);
    const t0 = base();
    const first = await typingService.prepareAttempt(user.id, t0);
    await typingService.startOfficial(user.id, first.attemptId, at(t0, 1));
    const failed = await typingService.completeAttempt(user.id, first.attemptId, { nonce: first.nonce, typedText: (await textOf(first.attemptId)).slice(0, 80) }, at(t0, 61));
    expect(failed).toMatchObject({ passed: false, practiceRequired: true, attemptsRemaining: 2 });
    expect(failed.metrics.correctCpm).toBe(80);
    await expect(typingService.prepareAttempt(user.id, at(t0, 70))).rejects.toMatchObject({ code: 'PRACTICE_REQUIRED' });
    await typingService.completePractice(user.id, at(t0, 100));
    // Tras la práctica prepara de nuevo, empieza y abandona (no envía nada).
    const second = await typingService.prepareAttempt(user.id, at(t0, 110));
    expect(second.number).toBe(2);
    await typingService.startOfficial(user.id, second.attemptId, at(t0, 112));
    // Mientras la ventana siga abierta, no se permiten dos pruebas a la vez.
    await expect(typingService.prepareAttempt(user.id, at(t0, 130))).rejects.toMatchObject({ code: 'TYPING_ATTEMPT_OPEN' });
    // Vencida la ventana (80 s), el intento se cierra como ABANDONED y cuenta como fallido.
    await expect(typingService.prepareAttempt(user.id, at(t0, 300))).rejects.toMatchObject({ code: 'PRACTICE_REQUIRED' });
    const abandoned = await prisma.typingAttemptResult.findUniqueOrThrow({ where: { attemptId: second.attemptId } });
    expect(abandoned).toMatchObject({ closeReason: 'ABANDONED', passed: false });
    const progress = await prisma.userActivityProgress.findFirstOrThrow({ where: { userId: user.id } });
    expect(progress.attemptsUsed).toBe(2);
    // El intento preparado que nunca se inició vence por su propio TTL (10 minutos).
    await typingService.completePractice(user.id, at(t0, 320));
    const third = await typingService.prepareAttempt(user.id, at(t0, 330));
    await expect(typingService.prepareAttempt(user.id, at(t0, 400))).rejects.toMatchObject({ code: 'TYPING_ATTEMPT_OPEN' });
    await expect(typingService.prepareAttempt(user.id, at(t0, 330 + 11 * 60))).rejects.toMatchObject({ code: 'NO_ATTEMPTS_LEFT' });
    const expired = await prisma.typingAttemptResult.findUniqueOrThrow({ where: { attemptId: third.attemptId } });
    expect(expired.closeReason).toBe('EXPIRED');
  });

  it('respeta los umbrales configurados y cada intento conserva su snapshot', async () => {
    const adminUser = await createTestUser(SUITE, { rol: 'administrador' });
    const user = await createTestUser(SUITE);
    const t0 = base();
    const before = await typingService.prepareAttempt(user.id, t0);
    const text = await textOf(before.attemptId);
    try {
      await configService.updateConfig({ typingMinCorrectCpm: 250 }, 'Prueba de umbral más exigente', { actorUserId: adminUser.id });
      await typingService.startOfficial(user.id, before.attemptId, at(t0, 1));
      // El intento ya preparado usa los 150 caracteres por minuto de su snapshot.
      const result = await typingService.completeAttempt(user.id, before.attemptId, { nonce: before.nonce, typedText: text.slice(0, 200) }, at(t0, 61));
      expect(result.passed).toBe(true);
      const snapshot = (await prisma.typingAttemptResult.findUniqueOrThrow({ where: { attemptId: before.attemptId } })).configSnapshot as { version: number; typingMinCorrectCpm: number };
      expect(snapshot.typingMinCorrectCpm).toBe(150);
      // Un usuario nuevo recibe la versión vigente: 200 caracteres por minuto ya no alcanzan.
      const other = await createTestUser(SUITE);
      const after = await typingService.prepareAttempt(other.id, t0);
      await typingService.startOfficial(other.id, after.attemptId, at(t0, 1));
      const failed = await typingService.completeAttempt(other.id, after.attemptId, { nonce: after.nonce, typedText: (await textOf(after.attemptId)).slice(0, 200) }, at(t0, 61));
      expect(failed.passed).toBe(false);
      const newSnapshot = (await prisma.typingAttemptResult.findUniqueOrThrow({ where: { attemptId: after.attemptId } })).configSnapshot as { version: number; typingMinCorrectCpm: number };
      expect(newSnapshot.typingMinCorrectCpm).toBe(250);
      expect(newSnapshot.version).toBeGreaterThan(snapshot.version);
    } finally {
      await configService.updateConfig({ typingMinCorrectCpm: 150 }, 'Restablece el umbral de la prueba', { actorUserId: adminUser.id });
    }
  });

  it('marca como sospechoso (sin rechazar) lo escrito de más', async () => {
    const user = await createTestUser(SUITE);
    const t0 = base();
    const prepared = await typingService.prepareAttempt(user.id, t0);
    await typingService.startOfficial(user.id, prepared.attemptId, at(t0, 1));
    const text = await textOf(prepared.attemptId);
    const result = await typingService.completeAttempt(user.id, prepared.attemptId, { nonce: prepared.nonce, typedText: `${text} ${text.slice(0, 50)}` }, at(t0, 61));
    expect(result.passed).toBe(true);
    expect((await prisma.typingAttemptResult.findUniqueOrThrow({ where: { attemptId: prepared.attemptId } })).suspicious).toBe(true);
  });

  it('la reactivación individual sigue funcionando sobre la mecanografía nueva', async () => {
    const adminUser = await createTestUser(SUITE, { rol: 'administrador' });
    const adminAgent = (await loginAgent(adminUser.numeroDocumento, 'administrador')).agent;
    const user = await createTestUser(SUITE);
    const ids = await activityIds();
    const t0 = base();
    for (let index = 0; index < 3; index++) {
      const prepared = await typingService.prepareAttempt(user.id, at(t0, index * 600));
      await typingService.startOfficial(user.id, prepared.attemptId, at(t0, index * 600 + 1));
      await typingService.completeAttempt(user.id, prepared.attemptId, { nonce: prepared.nonce, typedText: 'texto corto' }, at(t0, index * 600 + 61));
      await typingService.completePractice(user.id, at(t0, index * 600 + 70));
    }
    await expect(typingService.prepareAttempt(user.id, at(t0, 3000))).rejects.toMatchObject({ code: 'NO_ATTEMPTS_LEFT' });
    const response = await adminAgent.post(`/api/admin/advisors/${user.id}/activities/${ids.a1}/reactivate`).set(ORIGIN)
      .set('Idempotency-Key', newKey()).send({ action: 'EXTRA_ATTEMPT', extraAttempts: 1, reason: 'Falla de conexión en la prueba de mecanografía' });
    expect(response.status).toBe(201);
    const extra = await typingService.prepareAttempt(user.id, at(t0, 3100));
    expect(extra.number).toBe(4);
    // Sin espera configurada, RESET_WAIT no aplica.
    const reset = await adminAgent.post(`/api/admin/advisors/${user.id}/activities/${ids.a1}/reactivate`).set(ORIGIN)
      .set('Idempotency-Key', newKey()).send({ action: 'RESET_WAIT', reason: 'No hay espera en mecanografía' });
    expect(reset.status).toBe(409);
  });
});

describe('configuración versionada, reanudación y sello', () => {
  beforeAll(resetConfig);
  afterAll(() => cleanupSuite(SUITE));

  it('una versión nueva archiva la anterior, sincroniza evaluaciones y queda auditada', async () => {
    const adminUser = await createTestUser(SUITE, { rol: 'administrador' });
    const adminAgent = (await loginAgent(adminUser.numeroDocumento, 'administrador')).agent;
    const advisor = await createTestUser(SUITE);
    const advisorAgent = (await loginAgent(advisor.numeroDocumento, 'asesor')).agent;
    const ids = await activityIds();
    const current = (await adminAgent.get('/api/admin/training/office/config')).body.data;

    // El motivo es obligatorio y un asesor no puede cambiarla.
    expect((await adminAgent.patch('/api/admin/training/office/config').set(ORIGIN).send({ dictationMinScore: 90 })).status).toBe(400);
    expect((await adminAgent.patch('/api/admin/training/office/config').set(ORIGIN).send({ dictationMinScore: 90, reason: 'no' })).status).toBe(400);
    expect((await adminAgent.patch('/api/admin/training/office/config').set(ORIGIN).send({ dictationMinScore: 150, reason: 'Fuera de rango permitido' })).status).toBe(400);
    expect((await advisorAgent.patch('/api/admin/training/office/config').set(ORIGIN).send({ dictationMinScore: 90, reason: 'Un asesor no puede cambiarla' })).status).toBe(403);

    try {
      const updated = await adminAgent.patch('/api/admin/training/office/config').set(ORIGIN).send({ dictationMinScore: 90, excelMaxAttempts: 4, reason: 'Ajuste de exigencia para la prueba' });
      expect(updated.status).toBe(200);
      expect(updated.body.data.config).toMatchObject({ version: current.config.version + 1, dictationMinScore: 90, excelMaxAttempts: 4 });
      // Una sola versión vigente; la anterior queda archivada con sus valores.
      const versions = await prisma.officeModuleConfig.findMany({ where: { moduleKey: 'ofimatica-mecanografia' }, orderBy: { version: 'asc' } });
      expect(versions.filter((row) => row.status === 'ACTIVE')).toHaveLength(1);
      expect(versions.find((row) => row.version === current.config.version)).toMatchObject({ status: 'ARCHIVED' });
      expect(Number(versions.find((row) => row.version === current.config.version)!.dictationMinScore)).toBe(85);
      // Las evaluaciones que usa el servicio de intentos quedan sincronizadas.
      const dictation = await prisma.evaluation.findFirstOrThrow({ where: { activityId: ids.office.dictation, status: 'ACTIVE' } });
      const excel = await prisma.evaluation.findFirstOrThrow({ where: { activityId: ids.office.excel, status: 'ACTIVE' } });
      expect(Number(dictation.minimumScore)).toBe(90);
      expect(excel.maxAttempts).toBe(4);
      const typing = await prisma.evaluation.findFirstOrThrow({ where: { activityId: ids.office.typing, status: 'ACTIVE' } });
      expect(typing.maxAttempts).toBe(3);
      // Auditoría con antes, después y motivo.
      const audit = await prisma.adminAuditLog.findFirstOrThrow({ where: { action: 'OFFICE_CONFIG_UPDATED', actorUserId: adminUser.id } });
      expect(audit.reason).toBe('Ajuste de exigencia para la prueba');
      expect(audit.beforeJson).toMatchObject({ dictationMinScore: 85 });
      expect(audit.afterJson).toMatchObject({ dictationMinScore: 90 });
      // El frontend lee el valor nuevo de la API, sin redespliegue.
      const state = (await advisorAgent.get('/api/training/office/module')).body.data;
      expect(state.config.dictation.minScore).toBe(90);
      // Sin cambios, no crea versión.
      const same = await adminAgent.patch('/api/admin/training/office/config').set(ORIGIN).send({ dictationMinScore: 90, reason: 'Repite el mismo valor vigente' });
      expect(same.status).toBe(400);
      expect(same.body.code).toBe('NO_CHANGES');
    } finally {
      await adminAgent.patch('/api/admin/training/office/config').set(ORIGIN).send({ dictationMinScore: 85, excelMaxAttempts: 3, reason: 'Restablece los valores iniciales de prueba' });
    }
  });

  it('reanuda donde quedó después de cerrar sesión', async () => {
    const user = await createTestUser(SUITE);
    const first = await loginAgent(user.numeroDocumento, 'asesor');
    await first.agent.post('/api/training/office/sections/bienvenida/view').set(ORIGIN);
    const t0 = base();
    const prepared = await typingService.prepareAttempt(user.id, t0);
    await typingService.startOfficial(user.id, prepared.attemptId, at(t0, 1));
    await typingService.completeAttempt(user.id, prepared.attemptId, { nonce: prepared.nonce, typedText: (await textOf(prepared.attemptId)).slice(0, 220) }, at(t0, 61));
    await first.agent.post('/api/auth/logout').set(ORIGIN);
    const again = await loginAgent(user.numeroDocumento, 'asesor');
    const state = (await again.agent.get('/api/training/office/module')).body.data;
    expect(state.currentSection).toBe('excel');
    expect(state.sections.find((section: { key: string }) => section.key === 'mecanografia').status).toBe('COMPLETED');
  });

  it('el sello solo se emite con las tres actividades aprobadas, una sola vez, y desbloquea el Simulador', async () => {
    const user = await createTestUser(SUITE);
    const { agent } = await loginAgent(user.numeroDocumento, 'asesor');
    const ids = await activityIds();
    for (const activityId of [ids.office.typing, ids.office.excel]) {
      const { attempt } = await attemptService.startAttempt(user.id, activityId);
      await attemptService.submitAttempt(user.id, attempt.id, { score: 100, passed: true });
    }
    expect(await prisma.seal.count({ where: { userId: user.id } })).toBe(0);
    expect((await agent.get('/api/training/office/result')).body.data).toMatchObject({ sealIssued: false });
    let modules = (await agent.get('/api/advisor/modules')).body.data;
    expect(modules[1]).toMatchObject({ status: 'BLOCKED', enabled: false });
    const { attempt } = await attemptService.startAttempt(user.id, ids.office.dictation);
    await attemptService.submitAttempt(user.id, attempt.id, { score: 100, passed: true });
    expect(await prisma.seal.count({ where: { userId: user.id, status: 'ACTIVE' } })).toBe(1);
    modules = (await agent.get('/api/advisor/modules')).body.data;
    expect(modules[0]).toMatchObject({ status: 'PASSED', hasSeal: true, enabled: true });
    expect(modules[1]).toMatchObject({ status: 'AVAILABLE', enabled: true });
    const result = (await agent.get('/api/training/office/result')).body.data;
    expect(result).toMatchObject({ sealIssued: true });
    // Un módulo aprobado no admite más intentos ni duplica el sello.
    await expect(attemptService.startAttempt(user.id, ids.office.dictation)).rejects.toMatchObject({ code: 'ALREADY_PASSED' });
    expect(await prisma.seal.count({ where: { userId: user.id } })).toBe(1);
    // Otro asesor que aprueba por el mismo camino recibe su propio sello.
    const other = await createTestUser(SUITE);
    await passOfficeModule(other.id);
    expect(await prisma.seal.count({ where: { userId: other.id } })).toBe(1);
  });
});
