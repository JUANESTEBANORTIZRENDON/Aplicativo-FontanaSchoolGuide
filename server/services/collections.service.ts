import type { Db } from '../config/prisma.js';
import { prisma } from '../config/prisma.js';
import { COLLECTIONS_BLOCKS, COLLECTIONS_KEYS, COLLECTIONS_SLUG, COLLECTIONS_VERSION, EXAM_KEY, gradeCollections, gradeExam, mergeCollectionsAnswers, publicBlock, publicExam, reviewCollections, type CollectionsKey } from '../domain/collections.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../domain/errors.js';
import { completeModule, loadSnapshot } from './progress.service.js';
import { upsertActivityProgress, upsertModuleProgress } from '../repositories/progress.repository.js';

const SIMULATOR_SLUG = 'simulador-cobranzas';
// Cada bloque de teoría aporta 16 % y el examen aprobado completa el 100 %.
const BLOCK_PERCENT = 16;

async function access(db: Db, userId: string) {
  const user = await db.usuario.findUnique({ where: { id: userId }, select: { rol: true, estado: true, debeCompletarDatos: true, tieneExperienciaCobranzasDigitales: true } });
  if (!user || user.rol !== 'asesor' || user.estado !== 'activo') throw new ForbiddenError('Este módulo es para asesores activos.');
  if (user.debeCompletarDatos) throw new ForbiddenError('Completa tu perfil antes de continuar.', 'PROFILE_INCOMPLETE');
  if (user.tieneExperienciaCobranzasDigitales === null) throw new ForbiddenError('Cuéntanos tu experiencia en cobranzas para definir tu camino en el módulo.', 'EXPERIENCE_REQUIRED');
  const snapshot = await loadSnapshot(db, userId);
  const view = snapshot.views.find((item) => item.slug === COLLECTIONS_SLUG);
  if (!view) throw new NotFoundError('El módulo de inducción a las cobranzas no está configurado.', 'MODULE_NOT_FOUND');
  if (!view.enabled) throw new ForbiddenError(view.blockedReason ?? 'Módulo no disponible.', 'MODULE_BLOCKED');
  const module = snapshot.modules.find((item) => item.id === view.moduleId)!;
  if (!module.activities.some((activity) => activity.isRequired && activity.status === 'ACTIVE') || module.activities.some((activity) => activity.isRequired && activity.status !== 'ACTIVE')) {
    throw new ForbiddenError('La práctica del módulo no está disponible temporalmente.', 'ACTIVITY_INACTIVE');
  }
  const simulator = snapshot.views.find((item) => item.slug === SIMULATOR_SLUG);
  return { view, module, experienced: user.tieneExperienciaCobranzasDigitales, simulatorRoute: simulator?.route ?? null };
}

function progressRows(db: Db, userId: string, moduleId: string) {
  return db.collectionsBlockProgress.findMany({ where: { userId, moduleId, contentVersion: COLLECTIONS_VERSION, blockKey: { in: [...COLLECTIONS_KEYS, EXAM_KEY] } } });
}

type Rows = Awaited<ReturnType<typeof progressRows>>;

// Camino del módulo: los nuevos ven la teoría y luego el examen. Quien tiene experiencia empieza por el examen;
// si no lo aprueba, debe recorrer la teoría antes de volver a presentarlo.
function pathOf(rows: Rows, experienced: boolean, legacyPassed: boolean) {
  const completed = new Set(rows.filter((row) => row.completedAt && row.blockKey !== EXAM_KEY).map((row) => row.blockKey));
  const exam = rows.find((row) => row.blockKey === EXAM_KEY);
  const examPassed = Boolean(exam?.completedAt);
  const theoryDone = COLLECTIONS_KEYS.every((key) => completed.has(key));
  const theoryRequired = !experienced || (exam?.attempts ?? 0) > 0 && !examPassed;
  const examEnabled = examPassed || legacyPassed || theoryDone || (experienced && !theoryRequired);
  const complete = examPassed || legacyPassed;
  const percent = complete ? 100 : theoryRequired ? completed.size * BLOCK_PERCENT : 0;
  return { completed, exam, examPassed, theoryRequired, examEnabled, complete, percent };
}

async function saveModuleProgress(db: Db, userId: string, moduleId: string, percent: number, now: Date) {
  const existing = await db.userModuleProgress.findUnique({ where: { userId_moduleId: { userId, moduleId } } });
  await upsertModuleProgress(db, userId, moduleId, {
    status: existing?.status === 'PASSED' ? 'PASSED' : 'IN_PROGRESS',
    percent: existing?.status === 'PASSED' ? 100 : percent,
    startedAt: existing?.startedAt ?? now, lastActivityAt: now,
  });
  return existing?.status === 'PASSED';
}

// Aprobar el examen marca las actividades obligatorias y emite el sello que habilita el simulador.
async function finishModule(db: Db, userId: string, module: Awaited<ReturnType<typeof access>>['module'], now: Date) {
  const alreadyPassed = await saveModuleProgress(db, userId, module.id, 100, now);
  for (const activity of module.activities.filter((item) => item.status === 'ACTIVE' && item.isRequired)) {
    const progress = await db.userActivityProgress.findUnique({ where: { userId_activityId: { userId, activityId: activity.id } } });
    await upsertActivityProgress(db, userId, activity.id, { status: 'PASSED', startedAt: progress?.startedAt ?? now, completedAt: progress?.completedAt ?? now, lastActivityAt: now });
  }
  if (!alreadyPassed) await completeModule(db, userId, module.id, undefined, now);
}

function examState(path: ReturnType<typeof pathOf>) {
  const answers = path.exam?.answers as Record<string, string> | undefined;
  let lastResult = null;
  if (answers && Object.keys(answers).length) {
    try { lastResult = gradeExam(answers); } catch { lastResult = null; }
  }
  return { enabled: path.examEnabled, passed: path.complete, attempts: path.exam?.attempts ?? 0,
    content: publicExam(), lastResult };
}

export async function collectionsState(userId: string) {
  const { view, experienced, simulatorRoute } = await access(prisma, userId);
  const rows = await progressRows(prisma, userId, view.moduleId);
  const path = pathOf(rows, experienced, view.status === 'PASSED');
  const blocks = COLLECTIONS_BLOCKS.map((block, index) => {
    const row = rows.find((item) => item.blockKey === block.key);
    const enabled = path.theoryRequired && COLLECTIONS_KEYS.slice(0, index).every((key) => path.completed.has(key));
    const savedAnswers = row?.answers as Record<string, string> | undefined;
    // Si se simplifican los distractores, una elección antigua puede dejar de estar disponible.
    // Se pide elegir de nuevo solo esa respuesta, conservando el avance ya completado.
    const answers = savedAnswers ? Object.fromEntries(block.questions
      .filter((q) => q.options.some((o) => o.id === savedAnswers[q.key]))
      .map((q) => [q.key, savedAnswers[q.key]!])) : undefined;
    return {
      key: block.key, title: block.title, enabled, completed: path.completed.has(block.key), attempts: row?.attempts ?? 0,
      content: enabled ? publicBlock(block) : null,
      answers: enabled ? answers ?? {} : {},
      feedback: enabled && answers ? reviewCollections(block, answers) : null,
    };
  });
  const pending = blocks.find((block) => block.enabled && !block.completed);
  return { version: COLLECTIONS_VERSION, name: 'Inducción a las cobranzas', experienced, theoryRequired: path.theoryRequired,
    completedCount: path.completed.size, percent: path.percent, complete: path.complete, simulatorRoute,
    currentBlock: path.complete || !pending ? EXAM_KEY : pending.key, blocks, exam: examState(path) };
}

function assertTheoryOpen(path: ReturnType<typeof pathOf>) {
  if (!path.theoryRequired) throw new ForbiddenError('Como tienes experiencia, primero presenta el examen final.', 'EXAM_FIRST');
}

export async function submitCollectionsBlock(userId: string, key: CollectionsKey, answers: Record<string, string>, questionKey?: string) {
  const block = COLLECTIONS_BLOCKS.find((item) => item.key === key);
  if (!block) throw new NotFoundError('Bloque no encontrado.');
  try {
    if (questionKey) {
      if (Object.keys(answers).length !== 1 || !Object.hasOwn(answers, questionKey)) throw new Error();
      mergeCollectionsAnswers(block, {}, answers);
    } else gradeCollections(block, answers);
  } catch { throw new ValidationError('Responde con las opciones disponibles para esta actividad.'); }
  return prisma.$transaction(async (tx) => {
    // Serializa los envíos del asesor y la emisión del sello.
    await tx.$queryRaw`SELECT id FROM induccion.usuarios WHERE id = ${userId}::uuid FOR UPDATE`;
    const { module, view, experienced } = await access(tx, userId);
    const rows = await progressRows(tx, userId, module.id);
    const path = pathOf(rows, experienced, view.status === 'PASSED');
    assertTheoryOpen(path);
    const { completed } = path;
    if (!COLLECTIONS_KEYS.slice(0, COLLECTIONS_KEYS.indexOf(key)).every((previous) => completed.has(previous))) {
      throw new ForbiddenError('Completa la actividad del bloque anterior para continuar.', 'PREVIOUS_BLOCK_REQUIRED');
    }
    const now = new Date();
    const previous = rows.find((row) => row.blockKey === key);
    const merged = mergeCollectionsAnswers(block, (previous?.answers ?? {}) as Record<string, string>, answers);
    const feedback = reviewCollections(block, merged);
    const questionResult = questionKey ? reviewCollections(block, answers).results[0] : null;
    const completedAt = previous?.completedAt ?? (feedback.passed ? now : null);
    const saved = await tx.collectionsBlockProgress.upsert({
      where: { userId_moduleId_blockKey_contentVersion: { userId, moduleId: module.id, blockKey: key, contentVersion: COLLECTIONS_VERSION } },
      create: { userId, moduleId: module.id, blockKey: key, contentVersion: COLLECTIONS_VERSION, attempts: 1, answers: merged, completedAt },
      update: { attempts: { increment: 1 }, answers: merged, completedAt },
    });
    if (completedAt) completed.add(key);
    const percent = path.complete ? 100 : completed.size * BLOCK_PERCENT;
    await saveModuleProgress(tx, userId, module.id, percent, now);
    const next = COLLECTIONS_BLOCKS[COLLECTIONS_KEYS.indexOf(key) + 1];
    return { ...feedback, answers: merged, questionResult, completed: Boolean(completedAt), attempts: saved.attempts,
      completedKeys: COLLECTIONS_KEYS.filter((item) => completed.has(item)),
      nextBlock: completedAt && next ? { key: next.key, content: publicBlock(next) } : null,
      examUnlocked: completed.size === COLLECTIONS_KEYS.length,
      completedCount: completed.size, percent, complete: path.complete };
  });
}

// Cada bloque es de lectura con un reto rápido al final: continuar registra el avance sin exigir el
// cuestionario legado. La validación de conocimientos la hace el examen final.
export async function completeCollectionsBlock(userId: string, key: CollectionsKey) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM induccion.usuarios WHERE id = ${userId}::uuid FOR UPDATE`;
    const { module, view, experienced } = await access(tx, userId);
    const now = new Date();
    const rows = await progressRows(tx, userId, module.id);
    const path = pathOf(rows, experienced, view.status === 'PASSED');
    assertTheoryOpen(path);
    if (!COLLECTIONS_KEYS.slice(0, COLLECTIONS_KEYS.indexOf(key)).every((item) => path.completed.has(item))) {
      throw new ForbiddenError('Completa el bloque anterior para continuar.', 'PREVIOUS_BLOCK_REQUIRED');
    }
    const previous = rows.find((row) => row.blockKey === key);
    await tx.collectionsBlockProgress.upsert({
      where: { userId_moduleId_blockKey_contentVersion: { userId, moduleId: module.id, blockKey: key, contentVersion: COLLECTIONS_VERSION } },
      create: { userId, moduleId: module.id, blockKey: key, contentVersion: COLLECTIONS_VERSION, answers: {}, completedAt: now },
      update: { completedAt: previous?.completedAt ?? now },
    });
    path.completed.add(key);
    await saveModuleProgress(tx, userId, module.id, path.complete ? 100 : path.completed.size * BLOCK_PERCENT, now);
  });
  return collectionsState(userId);
}

// Examen final. Aprobado (8 de 10): emite el sello y habilita el simulador. Reprobado: quien tiene
// experiencia pasa a la teoría; quien es nuevo puede repasar y volver a presentarlo.
export async function submitCollectionsExam(userId: string, answers: Record<string, string>) {
  let result: ReturnType<typeof gradeExam>;
  try { result = gradeExam(answers); } catch { throw new ValidationError('Responde todas las preguntas del examen con las opciones disponibles.'); }
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM induccion.usuarios WHERE id = ${userId}::uuid FOR UPDATE`;
    const { module, view, experienced } = await access(tx, userId);
    const rows = await progressRows(tx, userId, module.id);
    const path = pathOf(rows, experienced, view.status === 'PASSED');
    if (!path.examEnabled) throw new ForbiddenError('Completa los cinco bloques de teoría para presentar el examen.', 'THEORY_REQUIRED');
    const now = new Date();
    const completedAt = path.exam?.completedAt ?? (result.passed ? now : null);
    await tx.collectionsBlockProgress.upsert({
      where: { userId_moduleId_blockKey_contentVersion: { userId, moduleId: module.id, blockKey: EXAM_KEY, contentVersion: COLLECTIONS_VERSION } },
      create: { userId, moduleId: module.id, blockKey: EXAM_KEY, contentVersion: COLLECTIONS_VERSION, attempts: 1, answers, completedAt },
      update: { attempts: { increment: 1 }, answers, completedAt },
    });
    if (completedAt) await finishModule(tx, userId, module, now);
    else await saveModuleProgress(tx, userId, module.id, path.completed.size * BLOCK_PERCENT, now);
  });
  return { result, state: await collectionsState(userId) };
}
