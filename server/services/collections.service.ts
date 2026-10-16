import type { Db } from '../config/prisma.js';
import { prisma } from '../config/prisma.js';
import { COLLECTIONS_BLOCKS, COLLECTIONS_KEYS, COLLECTIONS_SLUG, COLLECTIONS_VERSION, gradeCollections, mergeCollectionsAnswers, publicBlock, reviewCollections, type CollectionsKey } from '../domain/collections.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../domain/errors.js';
import { completeModule, loadSnapshot } from './progress.service.js';
import { upsertActivityProgress, upsertModuleProgress } from '../repositories/progress.repository.js';

async function access(db: Db, userId: string) {
  const user = await db.usuario.findUnique({ where: { id: userId }, select: { rol: true, estado: true, debeCompletarDatos: true, tieneExperienciaCobranzasDigitales: true } });
  if (!user || user.rol !== 'asesor' || user.estado !== 'activo') throw new ForbiddenError('Este módulo es para asesores activos.');
  if (user.debeCompletarDatos) throw new ForbiddenError('Completa tu perfil antes de continuar.', 'PROFILE_INCOMPLETE');
  if (user.tieneExperienciaCobranzasDigitales !== false) throw new ForbiddenError('Este módulo introductorio está dirigido a asesores nuevos. Confirma tu experiencia en la inducción.', 'NEW_ADVISOR_REQUIRED');
  const snapshot = await loadSnapshot(db, userId);
  const view = snapshot.views.find((item) => item.slug === COLLECTIONS_SLUG);
  if (!view) throw new NotFoundError('El módulo de inducción a las cobranzas no está configurado.', 'MODULE_NOT_FOUND');
  if (!view.enabled) throw new ForbiddenError(view.blockedReason ?? 'Módulo no disponible.', 'MODULE_BLOCKED');
  const module = snapshot.modules.find((item) => item.id === view.moduleId)!;
  if (!module.activities.some((activity) => activity.isRequired && activity.status === 'ACTIVE') || module.activities.some((activity) => activity.isRequired && activity.status !== 'ACTIVE')) {
    throw new ForbiddenError('La práctica del módulo no está disponible temporalmente.', 'ACTIVITY_INACTIVE');
  }
  return { view, module };
}

function progressRows(db: Db, userId: string, moduleId: string) {
  return db.collectionsBlockProgress.findMany({ where: { userId, moduleId, contentVersion: COLLECTIONS_VERSION, blockKey: { in: [...COLLECTIONS_KEYS] } } });
}

async function saveModuleProgress(db: Db, userId: string, module: Awaited<ReturnType<typeof access>>['module'], completed: Set<string>, now: Date) {
  const existing = await db.userModuleProgress.findUnique({ where: { userId_moduleId: { userId, moduleId: module.id } } });
  await upsertModuleProgress(db, userId, module.id, {
    status: existing?.status === 'PASSED' ? 'PASSED' : 'IN_PROGRESS',
    percent: existing?.status === 'PASSED' ? 100 : completed.size * 20,
    startedAt: existing?.startedAt ?? now, lastActivityAt: now,
  });
  if (completed.size !== COLLECTIONS_KEYS.length) return;
  const required = module.activities.filter((activity) => activity.status === 'ACTIVE' && activity.isRequired);
  for (const activity of required) {
    const progress = await db.userActivityProgress.findUnique({ where: { userId_activityId: { userId, activityId: activity.id } } });
    await upsertActivityProgress(db, userId, activity.id, { status: 'PASSED', startedAt: progress?.startedAt ?? now, completedAt: progress?.completedAt ?? now, lastActivityAt: now });
  }
  if (existing?.status !== 'PASSED') await completeModule(db, userId, module.id, undefined, now);
}

export async function collectionsState(userId: string) {
  const { view } = await access(prisma, userId);
  const rows = await progressRows(prisma, userId, view.moduleId);
  const completed = new Set(rows.filter((row) => row.completedAt).map((row) => row.blockKey));
  const blocks = COLLECTIONS_BLOCKS.map((block, index) => {
    const row = rows.find((item) => item.blockKey === block.key);
    const enabled = COLLECTIONS_KEYS.slice(0, index).every((key) => completed.has(key));
    const savedAnswers = row?.answers as Record<string, string> | undefined;
    // Si se simplifican los distractores, una elección antigua puede dejar de estar disponible.
    // Se pide elegir de nuevo solo esa respuesta, conservando el avance ya completado.
    const answers = savedAnswers ? Object.fromEntries(block.questions
      .filter((q) => q.options.some((o) => o.id === savedAnswers[q.key]))
      .map((q) => [q.key, savedAnswers[q.key]!])) : undefined;
    return {
      key: block.key, title: block.title, enabled, completed: completed.has(block.key), attempts: row?.attempts ?? 0,
      content: enabled ? publicBlock(block) : null,
      answers: enabled ? answers ?? {} : {},
      feedback: enabled && answers ? reviewCollections(block, answers) : null,
    };
  });
  return { version: COLLECTIONS_VERSION, name: 'Inducción a las cobranzas', completedCount: completed.size,
    percent: completed.size * 20, complete: completed.size === COLLECTIONS_KEYS.length,
    currentBlock: blocks.find((block) => !block.completed)?.key ?? COLLECTIONS_KEYS[0], blocks };
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
    // Serializa los envíos del asesor y la emisión del sello al completar los cinco bloques.
    await tx.$queryRaw`SELECT id FROM induccion.usuarios WHERE id = ${userId}::uuid FOR UPDATE`;
    const { module } = await access(tx, userId);
    const rows = await progressRows(tx, userId, module.id);
    const completed = new Set(rows.filter((row) => row.completedAt).map((row) => row.blockKey));
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
    await saveModuleProgress(tx, userId, module, completed, now);
    const next = COLLECTIONS_BLOCKS[COLLECTIONS_KEYS.indexOf(key) + 1];
    return { ...feedback, answers: merged, questionResult, completed: Boolean(completedAt), attempts: saved.attempts,
      completedKeys: COLLECTIONS_KEYS.filter((item) => completed.has(item)),
      nextBlock: completedAt && next ? { key: next.key, content: publicBlock(next) } : null,
      completedCount: completed.size, percent: completed.size * 20, complete: completed.size === COLLECTIONS_KEYS.length };
  });
}

// El primer bloque es de lectura: continuar registra el avance sin exigir el cuestionario legado.
export async function completeCollectionsConcepts(userId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM induccion.usuarios WHERE id = ${userId}::uuid FOR UPDATE`;
    const { module } = await access(tx, userId);
    const now = new Date();
    const rows = await progressRows(tx, userId, module.id);
    const previous = rows.find((row) => row.blockKey === 'conceptos');
    await tx.collectionsBlockProgress.upsert({
      where: { userId_moduleId_blockKey_contentVersion: { userId, moduleId: module.id, blockKey: 'conceptos', contentVersion: COLLECTIONS_VERSION } },
      create: { userId, moduleId: module.id, blockKey: 'conceptos', contentVersion: COLLECTIONS_VERSION, answers: {}, completedAt: now },
      update: { completedAt: previous?.completedAt ?? now },
    });
    const completed = new Set(rows.filter((row) => row.completedAt).map((row) => row.blockKey));
    completed.add('conceptos');
    await saveModuleProgress(tx, userId, module, completed, now);
  });
  return collectionsState(userId);
}
