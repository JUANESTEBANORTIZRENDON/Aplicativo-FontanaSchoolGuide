import { Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { ConflictError, NotFoundError, ValidationError } from '../domain/errors.js';
import type { ExcelAnswerKey, ExcelScenarioData } from '../domain/excel.js';
import { getStorage } from '../integrations/storage.js';
import { audit, type ActionContext } from './audit.service.js';
import type {
  DictationBody, DictationPatch, ExcelActivityBody, ExcelActivityPatch, SpellingRuleBody, SpellingRulePatch, TypingTextBody, TypingTextPatch,
} from '../validators/office.validator.js';

// Gestión del contenido del módulo: textos, escenarios de Excel, ejercicios de dictado y reglas.
// Nunca se borra: se activa, se desactiva o se crea una versión nueva. Toda escritura queda auditada
// con el motivo, el antes y el después.

type Row = Record<string, unknown>;
const plain = (value: unknown): Row => JSON.parse(JSON.stringify(value)) as Row;

// ---------------------------------------------------------------------------------------------
// Textos de mecanografía
// ---------------------------------------------------------------------------------------------

export async function listTexts() {
  const rows = await prisma.typingText.findMany({ orderBy: [{ key: 'asc' }, { version: 'desc' }], include: { _count: { select: { results: true } } } });
  return rows.map(({ _count, ...row }) => ({ ...row, usage: _count.results, length: row.content.length }));
}

export async function createText(body: TypingTextBody, context: ActionContext) {
  return prisma.$transaction(async (tx) => {
    if (await tx.typingText.findFirst({ where: { key: body.key } })) throw new ConflictError('Ya existe un texto con esa clave. Edítalo para crear una versión nueva.', 'KEY_EXISTS');
    const created = await tx.typingText.create({
      data: { key: body.key, version: 1, title: body.title, content: body.content, status: body.status, createdById: context.actorUserId },
    });
    await audit(tx, context, { action: 'OFFICE_TEXT_CREATED', entityType: 'TypingText', entityId: created.id, after: plain(created), reason: body.reason });
    return created;
  });
}

export async function updateText(id: string, patch: TypingTextPatch, context: ActionContext) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.typingText.findUnique({ where: { id }, include: { _count: { select: { results: true } } } });
    if (!before) throw new NotFoundError('Texto no encontrado.', 'TEXT_NOT_FOUND');
    const contentChanged = (patch.content !== undefined && patch.content !== before.content) || (patch.title !== undefined && patch.title !== before.title);
    const status = patch.status ?? before.status;
    let after;
    if (contentChanged && before._count.results > 0) {
      // Un texto ya usado no se edita: se crea la versión siguiente y la anterior se archiva.
      const latest = await tx.typingText.aggregate({ where: { key: before.key }, _max: { version: true } });
      await tx.typingText.update({ where: { id }, data: { status: 'ARCHIVED' } });
      after = await tx.typingText.create({
        data: { key: before.key, version: (latest._max.version ?? before.version) + 1, title: patch.title ?? before.title, content: patch.content ?? before.content, status, createdById: context.actorUserId },
      });
    } else {
      after = await tx.typingText.update({ where: { id }, data: { title: patch.title, content: patch.content, status } });
    }
    const { _count, ...snapshot } = before;
    void _count;
    await audit(tx, context, { action: 'OFFICE_TEXT_UPDATED', entityType: 'TypingText', entityId: after.id, before: plain(snapshot), after: plain(after), reason: patch.reason });
    return { ...after, newVersion: after.id !== id };
  });
}

// ---------------------------------------------------------------------------------------------
// Escenarios de Excel
// ---------------------------------------------------------------------------------------------

const STEP_KINDS = ['filter', 'select', 'append-callback', 'sorted', 'agreement', 'formula-difference', 'formula-sum', 'format'];

// Estructura mínima: el escenario genera las cuatro hojas y la clave de respuestas suma 100 puntos.
export function validateExcelContent(scenarioData: unknown, answerKey: unknown): void {
  const data = scenarioData as Partial<ExcelScenarioData> | null;
  const key = answerKey as Partial<ExcelAnswerKey> | null;
  const pools = data?.pools as Record<string, unknown> | undefined;
  const poolOk = pools && ['nombres', 'empresas', 'ciudades', 'motivos', 'asesores', 'estadosAcuerdo', 'estadosPago']
    .every((name) => Array.isArray(pools[name]) && (pools[name] as unknown[]).length >= 2 && (pools[name] as unknown[]).every((item) => typeof item === 'string'));
  if (!data || typeof data.baseDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.baseDate) || !poolOk || !data.rows) {
    throw new ValidationError('El escenario no tiene la estructura esperada (baseDate, pools y rows).', { scenarioData: 'Estructura inválida.' });
  }
  const rows = data.rows as Record<string, unknown>;
  for (const name of ['busquedas', 'volver', 'acuerdos', 'pagos']) {
    const count = rows[name];
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 8 || count > 40) {
      throw new ValidationError('Cada hoja necesita entre 8 y 40 registros.', { scenarioData: `rows.${name} fuera de rango.` });
    }
  }
  if ((pools!.nombres as string[]).length < 12) throw new ValidationError('El banco de nombres necesita al menos 12 elementos.', { scenarioData: 'pools.nombres insuficiente.' });
  const steps = Array.isArray(key?.steps) ? key!.steps! : [];
  const total = steps.reduce((sum, step) => sum + (Number(step.weight) || 0), 0);
  if (steps.length === 0 || steps.some((step) => !STEP_KINDS.includes(String(step.kind)) || !/^[a-z]+\.[a-z]+$/.test(String(step.id)))) {
    throw new ValidationError('La clave de respuestas tiene pasos no válidos.', { answerKey: 'Pasos inválidos.' });
  }
  if (Math.round(total * 100) / 100 !== 100) throw new ValidationError('Los pesos de los pasos deben sumar 100.', { answerKey: `Suman ${total}.` });
}

export async function listExcelActivities() {
  const rows = await prisma.excelActivity.findMany({ orderBy: [{ key: 'asc' }, { version: 'desc' }], include: { _count: { select: { results: true } } } });
  // El panel ve la estructura y los pesos; la clave de respuestas solo se envía a administradores.
  return rows.map(({ _count, ...row }) => ({ ...row, usage: _count.results }));
}

export async function createExcelActivity(body: ExcelActivityBody, context: ActionContext) {
  validateExcelContent(body.scenarioData, body.answerKey);
  return prisma.$transaction(async (tx) => {
    if (await tx.excelActivity.findFirst({ where: { key: body.key } })) throw new ConflictError('Ya existe un escenario con esa clave. Edítalo para crear una versión nueva.', 'KEY_EXISTS');
    const created = await tx.excelActivity.create({
      data: {
        key: body.key, version: 1, title: body.title, status: body.status, createdById: context.actorUserId,
        scenarioData: body.scenarioData as Prisma.InputJsonValue, answerKey: body.answerKey as Prisma.InputJsonValue,
      },
    });
    await audit(tx, context, { action: 'OFFICE_EXCEL_CREATED', entityType: 'ExcelActivity', entityId: created.id, after: { id: created.id, key: created.key, version: created.version, status: created.status }, reason: body.reason });
    return created;
  });
}

export async function updateExcelActivity(id: string, patch: ExcelActivityPatch, context: ActionContext) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.excelActivity.findUnique({ where: { id }, include: { _count: { select: { results: true } } } });
    if (!before) throw new NotFoundError('Escenario no encontrado.', 'EXCEL_NOT_FOUND');
    const scenarioData = patch.scenarioData ?? before.scenarioData;
    const answerKey = patch.answerKey ?? before.answerKey;
    if (patch.scenarioData || patch.answerKey) validateExcelContent(scenarioData, answerKey);
    const contentChanged = Boolean(patch.scenarioData || patch.answerKey) || (patch.title !== undefined && patch.title !== before.title);
    const status = patch.status ?? before.status;
    let after;
    if (contentChanged && before._count.results > 0) {
      const latest = await tx.excelActivity.aggregate({ where: { key: before.key }, _max: { version: true } });
      await tx.excelActivity.update({ where: { id }, data: { status: 'ARCHIVED' } });
      after = await tx.excelActivity.create({
        data: {
          key: before.key, version: (latest._max.version ?? before.version) + 1, title: patch.title ?? before.title, status,
          scenarioData: scenarioData as Prisma.InputJsonValue, answerKey: answerKey as Prisma.InputJsonValue, createdById: context.actorUserId,
        },
      });
    } else {
      after = await tx.excelActivity.update({
        where: { id }, data: { title: patch.title, status, scenarioData: scenarioData as Prisma.InputJsonValue, answerKey: answerKey as Prisma.InputJsonValue },
      });
    }
    await audit(tx, context, {
      action: 'OFFICE_EXCEL_UPDATED', entityType: 'ExcelActivity', entityId: after.id,
      before: { id, version: before.version, status: before.status, title: before.title }, after: { id: after.id, version: after.version, status: after.status, title: after.title, contentChanged },
      reason: patch.reason,
    });
    return { ...after, newVersion: after.id !== id };
  });
}

// ---------------------------------------------------------------------------------------------
// Ejercicios de dictado
// ---------------------------------------------------------------------------------------------

// No se puede activar sin audio autorizado. DICTATION_DEV_TTS solo existe en desarrollo y pruebas.
async function assertCanActivate(audioKey: string | null | undefined): Promise<void> {
  if (env.DICTATION_DEV_TTS) return;
  if (!audioKey) throw new ConflictError('No se puede activar un ejercicio sin audio autorizado. Sube el audio primero.', 'AUDIO_REQUIRED');
  if (!(await getStorage().exists(audioKey))) throw new ConflictError('El audio indicado todavía no está cargado en el almacenamiento.', 'AUDIO_NOT_FOUND', { audioKey });
}

export async function listDictations() {
  const rows = await prisma.dictationExercise.findMany({ orderBy: [{ key: 'asc' }, { version: 'desc' }], include: { _count: { select: { results: true } } } });
  const storage = getStorage();
  return Promise.all(rows.map(async ({ _count, ...row }) => ({ ...row, usage: _count.results, audioUploaded: row.audioKey ? await storage.exists(row.audioKey) : false })));
}

export async function createDictation(body: DictationBody, context: ActionContext) {
  if (body.status === 'ACTIVE') await assertCanActivate(body.audioKey);
  return prisma.$transaction(async (tx) => {
    if (await tx.dictationExercise.findFirst({ where: { key: body.key } })) throw new ConflictError('Ya existe un ejercicio con esa clave. Edítalo para crear una versión nueva.', 'KEY_EXISTS');
    const created = await tx.dictationExercise.create({
      data: {
        key: body.key, version: 1, title: body.title, expectedText: body.expectedText, difficulty: body.difficulty,
        criticalRuleKeys: body.criticalRuleKeys, audioKey: body.audioKey ?? null, audioDurationSeconds: body.audioDurationSeconds ?? null,
        status: body.status, createdById: context.actorUserId,
      },
    });
    await audit(tx, context, { action: 'OFFICE_DICTATION_CREATED', entityType: 'DictationExercise', entityId: created.id, after: plain(created), reason: body.reason });
    return created;
  });
}

export async function updateDictation(id: string, patch: DictationPatch, context: ActionContext) {
  const current = await prisma.dictationExercise.findUnique({ where: { id } });
  if (!current) throw new NotFoundError('Ejercicio no encontrado.', 'DICTATION_NOT_FOUND');
  const status = patch.status ?? current.status;
  const audioKey = patch.audioKey === undefined ? current.audioKey : patch.audioKey;
  if (status === 'ACTIVE') await assertCanActivate(audioKey);
  return prisma.$transaction(async (tx) => {
    const before = await tx.dictationExercise.findUniqueOrThrow({ where: { id }, include: { _count: { select: { results: true } } } });
    // El texto esperado, la dificultad y las reglas críticas cambian la evaluación: con intentos previos, nueva versión.
    const evaluationChanged = (patch.expectedText !== undefined && patch.expectedText !== before.expectedText)
      || (patch.criticalRuleKeys !== undefined && patch.criticalRuleKeys.join() !== before.criticalRuleKeys.join());
    const data = {
      title: patch.title ?? before.title, expectedText: patch.expectedText ?? before.expectedText, difficulty: patch.difficulty ?? before.difficulty,
      criticalRuleKeys: patch.criticalRuleKeys ?? before.criticalRuleKeys, audioKey,
      audioDurationSeconds: patch.audioDurationSeconds === undefined ? before.audioDurationSeconds : patch.audioDurationSeconds, status,
    };
    let after;
    if (evaluationChanged && before._count.results > 0) {
      const latest = await tx.dictationExercise.aggregate({ where: { key: before.key }, _max: { version: true } });
      await tx.dictationExercise.update({ where: { id }, data: { status: 'ARCHIVED' } });
      after = await tx.dictationExercise.create({ data: { ...data, key: before.key, version: (latest._max.version ?? before.version) + 1, createdById: context.actorUserId } });
    } else {
      after = await tx.dictationExercise.update({ where: { id }, data });
    }
    const { _count, ...snapshot } = before;
    void _count;
    await audit(tx, context, { action: 'OFFICE_DICTATION_UPDATED', entityType: 'DictationExercise', entityId: after.id, before: plain(snapshot), after: plain(after), reason: patch.reason });
    return { ...after, newVersion: after.id !== id };
  });
}

// ---------------------------------------------------------------------------------------------
// Reglas de ortografía
// ---------------------------------------------------------------------------------------------

export async function listRules() {
  return prisma.spellingRule.findMany({ orderBy: [{ category: 'asc' }, { key: 'asc' }, { version: 'desc' }] });
}

export async function createRule(body: SpellingRuleBody, context: ActionContext) {
  return prisma.$transaction(async (tx) => {
    if (await tx.spellingRule.findFirst({ where: { key: body.key } })) throw new ConflictError('Ya existe una regla con esa clave. Edítala para crear una versión nueva.', 'KEY_EXISTS');
    const created = await tx.spellingRule.create({
      data: {
        key: body.key, version: 1, category: body.category, severity: body.severity, weight: new Prisma.Decimal(body.weight),
        pairs: body.pairs, explanation: body.explanation, examples: body.examples, status: body.status,
      },
    });
    await audit(tx, context, { action: 'OFFICE_RULE_CREATED', entityType: 'SpellingRule', entityId: created.id, after: plain(created), reason: body.reason });
    return created;
  });
}

export async function updateRule(id: string, patch: SpellingRulePatch, context: ActionContext) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.spellingRule.findUnique({ where: { id } });
    if (!before) throw new NotFoundError('Regla no encontrada.', 'RULE_NOT_FOUND');
    const calificaCambia = patch.category !== undefined || patch.severity !== undefined || patch.weight !== undefined || patch.pairs !== undefined;
    const used = calificaCambia ? await tx.dictationAttemptResult.count({ where: { rulesVersion: { gte: before.version } } }) : 0;
    const data = {
      category: patch.category ?? before.category, severity: patch.severity ?? before.severity,
      weight: new Prisma.Decimal(patch.weight ?? Number(before.weight)), pairs: (patch.pairs ?? before.pairs) as Prisma.InputJsonValue,
      explanation: patch.explanation ?? before.explanation, examples: (patch.examples ?? before.examples) as Prisma.InputJsonValue,
      status: patch.status ?? before.status,
    };
    let after;
    if (calificaCambia && used > 0) {
      // Una regla que ya calificó intentos no se edita: la versión siguiente reemplaza a la anterior.
      const latest = await tx.spellingRule.aggregate({ where: { key: before.key }, _max: { version: true } });
      await tx.spellingRule.update({ where: { id }, data: { status: 'ARCHIVED' } });
      after = await tx.spellingRule.create({ data: { ...data, key: before.key, version: (latest._max.version ?? before.version) + 1 } });
    } else {
      after = await tx.spellingRule.update({ where: { id }, data });
    }
    await audit(tx, context, { action: 'OFFICE_RULE_UPDATED', entityType: 'SpellingRule', entityId: after.id, before: plain(before), after: plain(after), reason: patch.reason });
    return { ...after, newVersion: after.id !== id };
  });
}

// ---------------------------------------------------------------------------------------------
// Ficha del asesor en el módulo
// ---------------------------------------------------------------------------------------------

export async function advisorOffice(userId: string) {
  const user = await prisma.usuario.findUnique({ where: { id: userId }, select: { id: true, nombreCompleto: true, numeroDocumento: true, rol: true } });
  if (!user || user.rol !== 'asesor') throw new NotFoundError('Asesor no encontrado.', 'ADVISOR_NOT_FOUND');
  const [typing, excel, dictation, views, last] = await Promise.all([
    prisma.typingAttemptResult.findMany({ where: { attempt: { userId } }, orderBy: { createdAt: 'desc' }, take: 50, include: { attempt: { select: { number: true, status: true, score: true, startedAt: true, submittedAt: true } }, text: { select: { key: true, title: true } } } }),
    prisma.excelAttemptResult.findMany({ where: { attempt: { userId } }, orderBy: { startedAt: 'desc' }, take: 50, include: { attempt: { select: { number: true, status: true, score: true, startedAt: true, submittedAt: true } } } }),
    prisma.dictationAttemptResult.findMany({ where: { attempt: { userId } }, orderBy: { startedAt: 'desc' }, take: 50, include: { attempt: { select: { number: true, status: true, score: true, startedAt: true, submittedAt: true } }, exercise: { select: { key: true, title: true } } } }),
    prisma.activitySectionView.findMany({ where: { userId }, orderBy: { viewedAt: 'desc' }, take: 100, include: { activity: { select: { title: true } } } }),
    prisma.attempt.findFirst({ where: { userId, evaluation: { activity: { module: { slug: 'ofimatica-mecanografia' } } } }, orderBy: { startedAt: 'desc' }, select: { startedAt: true, submittedAt: true } }),
  ]);
  return {
    user,
    lastActivityAt: (last?.submittedAt ?? last?.startedAt)?.toISOString() ?? null,
    typing: typing.map((row) => ({
      attemptId: row.attemptId, number: row.attempt.number, status: row.attempt.status, startedAt: row.attempt.startedAt, submittedAt: row.attempt.submittedAt,
      text: row.text, correctCpm: row.correctCpm, ppm: row.ppm, accuracy: row.accuracy, errorCount: row.errorCount, totalCharacters: row.totalCharacters,
      correctCharacters: row.correctCharacters, passed: row.passed, closeReason: row.closeReason, suspicious: row.suspicious, configVersion: (row.configSnapshot as { version?: number } | null)?.version ?? null,
    })),
    excel: excel.map((row) => ({
      attemptId: row.attemptId, number: row.attempt.number, status: row.attempt.status, startedAt: row.startedAt, completedAt: row.completedAt,
      score: row.score, passed: row.passed, steps: row.stepResults, excelVersion: row.excelVersion, seed: row.seed,
    })),
    dictation: dictation.map((row) => ({
      attemptId: row.attemptId, number: row.attempt.number, status: row.attempt.status, startedAt: row.startedAt, completedAt: row.completedAt,
      exercise: row.exercise, score: row.score, passed: row.passed, criticalCount: row.criticalCount, wordMatchPercent: row.wordMatchPercent,
      errors: row.detectedErrors, recommendation: row.recommendation, recommendationSource: row.recommendationSource, playsUsed: row.playsUsed, rulesVersion: row.rulesVersion,
    })),
    sectionViews: views.map((row) => ({ activity: row.activity.title, sectionKey: row.sectionKey, viewedAt: row.viewedAt })),
  };
}
