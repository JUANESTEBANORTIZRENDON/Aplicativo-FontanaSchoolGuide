import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../app.js';
import { prisma } from '../config/prisma.js';
import { EXERCISES, type PracticeAction } from '../domain/excel-practice.js';
import { PRACTICE_ACTIONS } from './excel-practice-actions.js';
import { signedUrl } from '../services/media.service.js';
import { cleanupSuite, createTestUser, loginAgent, ORIGIN } from './helpers.js';

const SUITE = 'ofc';
type Agent = Awaited<ReturnType<typeof loginAgent>>['agent'];

const ogg = (size = 800) => Buffer.concat([Buffer.from('OggS'), Buffer.alloc(size)]);
const webp = (size = 800) => Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(size)]);

async function advisorAgent(): Promise<{ agent: Agent; id: string; documento: string }> {
  const user = await createTestUser(SUITE);
  return { agent: (await loginAgent(user.numeroDocumento, 'asesor')).agent, id: user.id, documento: user.numeroDocumento };
}

describe('evaluación de Excel', () => {
  afterAll(() => cleanupSuite(SUITE));

  it('persiste comandos, recupera la hoja y califica ocho ejercicios en el servidor', async () => {
    const { agent, id } = await advisorAgent();
    const activity = await agent.get('/api/training/office/excel/activity');
    expect(activity.status).toBe(200);
    expect(activity.body.data.lessons).toHaveLength(4);

    const started = await agent.post(`/api/training/office/excel/activity/${activity.body.data.id}/attempts`).set(ORIGIN);
    expect(started.status).toBe(201);
    expect(started.body.data.exercises).toHaveLength(EXERCISES.length);
    expect(started.body.data.questions).toBeUndefined();
    let current = started.body.data;
    const action = async (value: PracticeAction) => {
      const response = await agent.post(`/api/training/office/excel/activity/${activity.body.data.id}/actions`).set(ORIGIN).send({ attemptId: current.attemptId, revision: current.state.revision, action: value });
      expect(response.status).toBe(200); current = response.body.data;
    };
    for (let i = 0; i < EXERCISES.length; i++) {
      for (const value of PRACTICE_ACTIONS[i]!) await action(value);
      expect(current.state.completed[i]).toBe(true);
      if (i < EXERCISES.length - 1) await action({ type: 'next' });
    }
    const recovered = (await agent.get('/api/training/office/excel/activity')).body.data.practice;
    expect(recovered.state).toEqual(current.state);
    expect(recovered.state.savedRows[0].observacion).toBe('Cliente solicita llamada mañana.');
    const graded = await agent.post(`/api/training/office/excel/activity/${activity.body.data.id}/submit`).set(ORIGIN).send({ attemptId: current.attemptId, revision: current.state.revision });
    expect(graded.status).toBe(200);
    expect(graded.body.data).toMatchObject({ score: 100, passed: true });
    expect(graded.body.data.steps.every((step: { correct: boolean }) => step.correct)).toBe(true);
    const answers = await prisma.attemptAnswer.findMany({ where: { attemptId: started.body.data.attemptId } });
    expect(answers).toHaveLength(EXERCISES.length);
    expect(answers.every((answer) => answer.isCorrect === true)).toBe(true);
    // Sin reenvío.
    const again = await agent.post(`/api/training/office/excel/activity/${activity.body.data.id}/submit`).set(ORIGIN).send({ attemptId: current.attemptId, revision: current.state.revision });
    expect(again.status).toBe(409);
    expect(id).toBeTruthy();
  });

  it('no completa por continuar y permite reintentar una evaluación fallida sin bloqueo', async () => {
    const { agent } = await advisorAgent();
    const activity = (await agent.get('/api/training/office/excel/activity')).body.data;
    const started = (await agent.post(`/api/training/office/excel/activity/${activity.id}/attempts`).set(ORIGIN)).body.data;
    let revision = 0;
    const advance = await agent.post(`/api/training/office/excel/activity/${activity.id}/actions`).set(ORIGIN).send({ attemptId: started.attemptId, revision, action: { type: 'next' } });
    expect(advance.body.data.state).toMatchObject({ current: 0, ok: false }); revision++;
    for (let i = 0; i < EXERCISES.length - 1; i++) {
      const skipped = await agent.post(`/api/training/office/excel/activity/${activity.id}/actions`).set(ORIGIN).send({ attemptId: started.attemptId, revision, action: { type: 'skip' } });
      expect(skipped.status).toBe(200); revision++;
    }
    const saved = await agent.post(`/api/training/office/excel/activity/${activity.id}/actions`).set(ORIGIN).send({ attemptId: started.attemptId, revision, action: { type: 'save', method: 'button' } });
    expect(saved.status).toBe(200); revision++;
    const graded = await agent.post(`/api/training/office/excel/activity/${activity.id}/submit`).set(ORIGIN).send({ attemptId: started.attemptId, revision });
    expect(graded.status).toBe(200);
    expect(graded.body.data).toMatchObject({ score: 12.5, passed: false });
    expect(graded.body.data.steps).toHaveLength(EXERCISES.length);
    const retry = await agent.post(`/api/training/office/excel/activity/${activity.id}/attempts`).set(ORIGIN);
    expect(retry.status).toBe(201); expect(retry.body.data.number).toBe(2);
  });

  it('valida el cuerpo y no deja calificar el intento de otro asesor', async () => {
    const owner = await advisorAgent();
    const other = await advisorAgent();
    const activity = (await owner.agent.get('/api/training/office/excel/activity')).body.data;
    const started = (await owner.agent.post(`/api/training/office/excel/activity/${activity.id}/attempts`).set(ORIGIN)).body.data;
    const invalid = await owner.agent.post(`/api/training/office/excel/activity/${activity.id}/submit`).set(ORIGIN).send({ attemptId: started.attemptId, answers: [{ questionId: 'suma', optionId: 'e' }] });
    expect(invalid.status).toBe(400);
    const extra = await owner.agent.post(`/api/training/office/excel/activity/${activity.id}/submit`).set(ORIGIN).send({ attemptId: started.attemptId, answers: [], nota: 100 });
    expect(extra.status).toBe(400);
    const stale = await owner.agent.post(`/api/training/office/excel/activity/${activity.id}/actions`).set(ORIGIN).send({ attemptId: started.attemptId, revision: 50, action: { type: 'skip' } });
    expect(stale.status).toBe(409);
    const stolen = await other.agent.post(`/api/training/office/excel/activity/${activity.id}/submit`).set(ORIGIN).send({ attemptId: started.attemptId, revision: 0 });
    expect(stolen.status).toBe(404);
  });
});

describe('medios privados y administración del contenido', () => {
  let admin: Agent;
  beforeAll(async () => {
    const user = await createTestUser(SUITE, { rol: 'administrador' });
    admin = (await loginAgent(user.numeroDocumento, 'administrador')).agent;
  });
  afterAll(() => cleanupSuite(SUITE));

  const upload = (key: string, body: Buffer | string, type = 'application/octet-stream') =>
    admin.put(`/api/admin/training/office/media/${key}`).set(ORIGIN).set('Content-Type', type).send(body);

  it('valida los bytes mágicos, la extensión y el tamaño de lo que se carga', async () => {
    expect((await upload('texto.webp', Buffer.from('esto no es una imagen'))).status).toBe(400);
    const wrongExt = await upload('audio.mp3', ogg());
    expect(wrongExt.status).toBe(400);
    expect(wrongExt.body.code).toBe('MEDIA_EXTENSION_MISMATCH');
    const big = await upload('grande.webp', webp(1_200_000));
    expect(big.status).toBe(400);
    expect(big.body.code).toBe('MEDIA_TOO_LARGE');
    expect((await upload('enorme.ogg', ogg(2_500_000))).status).toBe(413);
    expect((await upload('../escape.webp', webp())).status).toBe(404);
    const asJson = await admin.put('/api/admin/training/office/media/json.webp').set(ORIGIN).send({ a: 1 });
    expect(asJson.status).toBe(400);
    const { agent: advisor } = await advisorAgent();
    expect((await advisor.put('/api/admin/training/office/media/orto-test.webp').set(ORIGIN).set('Content-Type', 'application/octet-stream').send(webp())).status).toBe(403);
  });

  it('carga, audita, entrega con firma y exige sesión', async () => {
    const stored = await upload('orto-prueba.webp', webp());
    expect(stored.status).toBe(201);
    expect(stored.body.data).toMatchObject({ key: 'orto-prueba.webp', contentType: 'image/webp', replaced: expect.any(Boolean) });
    const audit = await prisma.adminAuditLog.findFirstOrThrow({ where: { entityId: 'orto-prueba.webp', action: 'OFFICE_MEDIA_UPLOADED' }, orderBy: { createdAt: 'desc' } });
    expect(audit.afterJson).toMatchObject({ contentType: 'image/webp' });

    const { agent: advisor, id } = await advisorAgent();
    const { url } = signedUrl('orto-prueba.webp', id);
    const ok = await advisor.get(url);
    expect(ok.status).toBe(200);
    expect(ok.headers['content-type']).toBe('image/webp');
    expect(ok.headers['cache-control']).toMatch(/private/);
    // Firma alterada, vencida o de otro usuario: rechazada. Sin sesión: 401.
    expect((await advisor.get(url.replace(/sig=.{4}/, 'sig=AAAA'))).status).toBe(403);
    const expired = signedUrl('orto-prueba.webp', id, new Date(Date.now() - 60 * 60_000), 60);
    const old = await advisor.get(expired.url);
    expect(old.status).toBe(403);
    expect(old.body.code).toBe('MEDIA_URL_EXPIRED');
    const { agent: stranger } = await advisorAgent();
    expect((await stranger.get(url)).status).toBe(403);
    expect((await request(app).get(url)).status).toBe(401);
    expect((await advisor.get('/api/media/no-existe.webp?exp=9999999999&sig=abcdefghijk')).status).toBe(403);
  });

  it('un ejercicio no se activa sin audio autorizado; con audio cargado, sí', async () => {
    const exercise = await prisma.dictationExercise.findFirstOrThrow({ where: { key: 'dictado-error-saldo', version: 1 } });
    const path = `/api/admin/training/office/dictations/${exercise.id}`;
    const noAudio = await admin.patch(path).set(ORIGIN).send({ status: 'ACTIVE', reason: 'Intento de activar sin audio' });
    expect(noAudio.status).toBe(409);
    expect(noAudio.body.code).toBe('AUDIO_REQUIRED');
    const missing = await admin.patch(path).set(ORIGIN).send({ status: 'ACTIVE', audioKey: 'dictado-que-no-existe.ogg', reason: 'Audio que todavía no se cargó' });
    expect(missing.status).toBe(409);
    expect(missing.body.code).toBe('AUDIO_NOT_FOUND');
    expect((await upload('dictado-prueba.ogg', ogg())).status).toBe(201);
    try {
      const active = await admin.patch(path).set(ORIGIN).send({ status: 'ACTIVE', audioKey: 'dictado-prueba.ogg', audioDurationSeconds: 25, reason: 'Audio autorizado de la prueba' });
      expect(active.status).toBe(200);
      expect(active.body.data).toMatchObject({ status: 'ACTIVE', audioKey: 'dictado-prueba.ogg' });
      expect(await prisma.adminAuditLog.count({ where: { entityId: exercise.id, action: 'OFFICE_DICTATION_UPDATED' } })).toBeGreaterThan(0);
    } finally {
      await admin.patch(path).set(ORIGIN).send({ status: 'DRAFT', audioKey: null, audioDurationSeconds: null, reason: 'Restablece el ejercicio de la prueba' });
    }
  });

  it('valida y versiona los textos, y protege los escenarios de Excel', async () => {
    const short = await admin.post('/api/admin/training/office/texts').set(ORIGIN).send({ key: 'texto-corto-prueba', title: 'Texto corto', content: 'x'.repeat(649), status: 'DRAFT', reason: 'Prueba de límite inferior' });
    expect(short.status).toBe(400);
    const long = await admin.post('/api/admin/training/office/texts').set(ORIGIN).send({ key: 'texto-largo-prueba', title: 'Texto largo', content: 'x'.repeat(901), status: 'DRAFT', reason: 'Prueba de límite superior' });
    expect(long.status).toBe(400);
    const key = `texto-prueba-${Date.now().toString(36)}`;
    const created = await admin.post('/api/admin/training/office/texts').set(ORIGIN).send({ key, title: 'Texto de prueba', content: 'a'.repeat(700), status: 'DRAFT', reason: 'Texto ficticio de prueba' });
    expect(created.status).toBe(201);
    expect((await admin.post('/api/admin/training/office/texts').set(ORIGIN).send({ key, title: 'Duplicado', content: 'a'.repeat(700), status: 'DRAFT', reason: 'Clave repetida de prueba' })).status).toBe(409);
    // Sin uso, el texto se edita en su lugar; con uso, crea una versión nueva y archiva la anterior.
    const inPlace = await admin.patch(`/api/admin/training/office/texts/${created.body.data.id}`).set(ORIGIN).send({ content: 'b'.repeat(720), reason: 'Ajuste de un texto sin uso' });
    expect(inPlace.body.data).toMatchObject({ version: 1, newVersion: false });
    const { id: advisorId } = await advisorAgent();
    const attempt = await prisma.attempt.create({
      data: { userId: advisorId, evaluationId: (await prisma.evaluation.findFirstOrThrow({ where: { activity: { type: 'TYPING' }, status: 'ACTIVE' } })).id, number: 1, status: 'FAILED' },
    });
    await prisma.typingAttemptResult.create({
      data: { attemptId: attempt.id, textId: created.body.data.id, textVersion: 1, nonceHash: 'a'.repeat(64), expiresAt: new Date(), configSnapshot: {} },
    });
    const versioned = await admin.patch(`/api/admin/training/office/texts/${created.body.data.id}`).set(ORIGIN).send({ content: 'c'.repeat(730), reason: 'Ajuste de un texto ya usado' });
    expect(versioned.body.data).toMatchObject({ version: 2, newVersion: true });
    expect((await prisma.typingText.findUniqueOrThrow({ where: { id: created.body.data.id } })).status).toBe('ARCHIVED');
    await prisma.typingAttemptResult.deleteMany({ where: { attemptId: attempt.id } });
    await prisma.attempt.delete({ where: { id: attempt.id } });

    const badExcel = await admin.post('/api/admin/training/office/excel-activities').set(ORIGIN).send({
      key: `excel-prueba-${Date.now().toString(36)}`, title: 'Escenario inválido', scenarioData: { baseDate: '2026-11-02' }, answerKey: { steps: [] }, status: 'DRAFT', reason: 'Escenario sin estructura',
    });
    expect(badExcel.status).toBe(400);
  });

  it('el panel lista contenido, medios y la ficha del asesor en el módulo', async () => {
    for (const path of ['texts', 'excel-activities', 'dictations', 'rules', 'media', 'config']) {
      const response = await admin.get(`/api/admin/training/office/${path}`);
      expect(response.status, path).toBe(200);
    }
    const rules = (await admin.get('/api/admin/training/office/rules')).body.data as { key: string }[];
    expect(rules.map((rule) => rule.key)).toEqual(expect.arrayContaining(['homofona-a-ver-haber', 'homofona-sino-si-no', 'tilde-tu']));
    const media = (await admin.get('/api/admin/training/office/media')).body.data;
    expect(media.images).toHaveLength(7);
    const demo = await prisma.usuario.findUniqueOrThrow({ where: { numeroDocumento: '1000000148' } });
    const office = (await admin.get(`/api/admin/advisors/${demo.id}/office`)).body.data;
    expect(office.typing.length).toBeGreaterThan(0);
    expect(office.excel[0]).toMatchObject({ passed: true });
    expect(office.dictation[0]).toMatchObject({ passed: false, criticalCount: 1 });
    expect(office.dictation[0].recommendation.proximoPaso).toBeTruthy();
    const summary = (await admin.get('/api/admin/metrics/summary').query({ limit: 5 })).body.data;
    expect(summary.dictation.results).toBeGreaterThan(0);
    expect(summary.dictation.topErrors.length).toBeGreaterThan(0);
    expect(summary.excel.steps.length).toBeGreaterThanOrEqual(EXERCISES.length);
    expect(summary.typing.avgCorrectCpm).toBeTruthy();
  });
});

describe('dictado con audio autorizado', () => {
  let admin: Agent;
  let exerciseId: string;
  let expectedText: string;
  beforeAll(async () => {
    const user = await createTestUser(SUITE, { rol: 'administrador' });
    admin = (await loginAgent(user.numeroDocumento, 'administrador')).agent;
    const exercise = await prisma.dictationExercise.findFirstOrThrow({ where: { key: 'dictado-error-saldo', version: 1 } });
    exerciseId = exercise.id;
    expectedText = exercise.expectedText;
    await admin.put('/api/admin/training/office/media/dictado-flujo.ogg').set(ORIGIN).set('Content-Type', 'application/octet-stream').send(ogg(4000));
    const active = await admin.patch(`/api/admin/training/office/dictations/${exerciseId}`).set(ORIGIN).send({ status: 'ACTIVE', audioKey: 'dictado-flujo.ogg', audioDurationSeconds: 24, reason: 'Audio autorizado del flujo de prueba' });
    expect(active.status).toBe(200);
    // Los demás ejercicios siguen en borrador: el asesor siempre recibe este.
  });
  afterAll(async () => {
    await admin.patch(`/api/admin/training/office/dictations/${exerciseId}`).set(ORIGIN).send({ status: 'DRAFT', audioKey: null, audioDurationSeconds: null, reason: 'Restablece el ejercicio del flujo de prueba' });
    await cleanupSuite(SUITE);
  });

  it('cuenta las reproducciones en el servidor y entrega audio con soporte de Range', async () => {
    const { agent, id } = await advisorAgent();
    const next = (await agent.get('/api/training/office/dictation/next')).body.data.exercise;
    expect(next).toMatchObject({ id: exerciseId, hasAudio: true });
    expect(JSON.stringify(next)).not.toContain(expectedText.slice(0, 20));
    const started = await agent.post(`/api/training/office/dictation/${exerciseId}/attempts`).set(ORIGIN);
    expect(started.status).toBe(201);
    expect(started.body.data).toMatchObject({ playsAllowed: 2, playsRemaining: 2 });
    const attemptId = started.body.data.attemptId;
    const meta = await agent.get(`/api/training/office/dictation/${exerciseId}`).query({ attemptId });
    expect(meta.status).toBe(200);
    expect(JSON.stringify(meta.body)).not.toContain(expectedText.slice(0, 20));

    const first = await agent.post(`/api/training/office/dictation/${exerciseId}/play`).set(ORIGIN).send({ attemptId });
    expect(first.body.data).toMatchObject({ mode: 'audio', playsRemaining: 1 });
    expect((await agent.post(`/api/training/office/dictation/${exerciseId}/play`).set(ORIGIN).send({ attemptId })).body.data.playsRemaining).toBe(0);
    const third = await agent.post(`/api/training/office/dictation/${exerciseId}/play`).set(ORIGIN).send({ attemptId });
    expect(third.status).toBe(409);
    expect(third.body.code).toBe('PLAYS_EXHAUSTED');
    expect((await prisma.dictationAttemptResult.findUniqueOrThrow({ where: { attemptId } })).playsUsed).toBe(2);

    const whole = await agent.get(first.body.data.url);
    expect(whole.status).toBe(200);
    expect(whole.headers['content-type']).toBe('audio/ogg');
    const part = await agent.get(first.body.data.url).set('Range', 'bytes=0-9');
    expect(part.status).toBe(206);
    expect(part.headers['content-range']).toMatch(/^bytes 0-9\/\d+$/);
    expect(id).toBeTruthy();
  });

  it('califica con el sistema experto, aprueba y guarda la recomendación de plantilla', async () => {
    const { agent } = await advisorAgent();
    const started = (await agent.post(`/api/training/office/dictation/${exerciseId}/attempts`).set(ORIGIN)).body.data;
    const result = await agent.post(`/api/training/office/dictation/${exerciseId}/submit`).set(ORIGIN).send({ attemptId: started.attemptId, typedText: expectedText });
    expect(result.status).toBe(200);
    expect(result.body.data).toMatchObject({ score: 100, passed: true, criticalCount: 0, recommendationSource: 'TEMPLATE', expectedText });
    const stored = await prisma.dictationAttemptResult.findUniqueOrThrow({ where: { attemptId: started.attemptId } });
    expect(stored).toMatchObject({ passed: true, recommendationSource: 'TEMPLATE', rulesVersion: 1 });
    expect(Number(stored.score)).toBe(100);
    expect((await prisma.attempt.findUniqueOrThrow({ where: { id: started.attemptId } })).status).toBe('PASSED');
    // El intento cerrado no se modifica.
    const again = await agent.post(`/api/training/office/dictation/${exerciseId}/submit`).set(ORIGIN).send({ attemptId: started.attemptId, typedText: 'otro texto' });
    expect(again.status).toBe(409);
  });

  it('un error crítico impide aprobar, explica la corrección y deja intentos', async () => {
    const { agent } = await advisorAgent();
    const started = (await agent.post(`/api/training/office/dictation/${exerciseId}/attempts`).set(ORIGIN)).body.data;
    const typed = expectedText.replace('haber', 'a ver');
    const result = await agent.post(`/api/training/office/dictation/${exerciseId}/submit`).set(ORIGIN).send({ attemptId: started.attemptId, typedText: typed });
    expect(result.status).toBe(200);
    const data = result.body.data;
    expect(data).toMatchObject({ passed: false, criticalCount: 1, attemptsRemaining: 2 });
    expect(data.score).toBe(85);
    expect(data.corrections.priority[0]).toMatchObject({ severity: 'CRITICAL', ruleKey: 'homofona-a-ver-haber', expected: 'haber', written: 'a ver' });
    expect(data.corrections.priority[0].explanation).toMatch(/haber/);
    expect(data.recommendation.recomendaciones.length).toBeGreaterThan(0);
  });
});
