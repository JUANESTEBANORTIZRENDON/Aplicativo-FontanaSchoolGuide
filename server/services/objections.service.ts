import type { Db } from '../config/prisma.js';
import { prisma } from '../config/prisma.js';
import {
  OBJECTIONS_BLOCKS, OBJECTIONS_BLOCK_PERCENT, OBJECTIONS_KEYS, OBJECTIONS_NAME, OBJECTIONS_SLUG, OBJECTIONS_VERSION, type ObjectionsKey,
} from '../domain/objections.js';
import { ForbiddenError, NotFoundError } from '../domain/errors.js';
import { completeModule, loadSnapshot } from './progress.service.js';
import { upsertActivityProgress, upsertModuleProgress } from '../repositories/progress.repository.js';

const TYPIFICATION_SLUG = 'tipificacion-llamadas';

// El módulo se abre al asesor activo con el perfil completo cuando el sello de la inducción ya fue emitido.
async function access(db: Db, userId: string) {
  const user = await db.usuario.findUnique({ where: { id: userId }, select: { rol: true, estado: true, debeCompletarDatos: true } });
  if (!user || user.rol !== 'asesor' || user.estado !== 'activo') throw new ForbiddenError('Este módulo es para asesores activos.');
  if (user.debeCompletarDatos) throw new ForbiddenError('Completa tu perfil antes de continuar.', 'PROFILE_INCOMPLETE');
  const snapshot = await loadSnapshot(db, userId);
  const view = snapshot.views.find((entry) => entry.slug === OBJECTIONS_SLUG);
  if (!view) throw new NotFoundError(`El módulo «${OBJECTIONS_NAME}» no está configurado.`, 'MODULE_NOT_FOUND');
  if (!view.enabled) throw new ForbiddenError(view.blockedReason ?? 'Módulo no disponible.', 'MODULE_BLOCKED');
  const module = snapshot.modules.find((entry) => entry.id === view.moduleId)!;
  const required = module.activities.filter((activity) => activity.isRequired);
  if (!required.some((activity) => activity.status === 'ACTIVE') || required.some((activity) => activity.status !== 'ACTIVE')) {
    throw new ForbiddenError('La actividad del módulo no está disponible temporalmente.', 'ACTIVITY_INACTIVE');
  }
  const next = snapshot.views.find((entry) => entry.slug === TYPIFICATION_SLUG);
  return { view, module, nextRoute: next?.route ?? null, nextName: next?.name ?? null, reviewMode: snapshot.certification.status === 'CERTIFICADO' };
}

function progressRows(db: Db, userId: string, moduleId: string) {
  return db.collectionsBlockProgress.findMany({ where: { userId, moduleId, contentVersion: OBJECTIONS_VERSION, blockKey: { in: [...OBJECTIONS_KEYS] } } });
}

function pathOf(rows: Awaited<ReturnType<typeof progressRows>>, sealed: boolean) {
  const completed = new Set(rows.filter((row) => row.completedAt).map((row) => row.blockKey));
  // Un sello anterior (datos demo o excepciones) deja el módulo abierto para repasar.
  const complete = sealed || OBJECTIONS_KEYS.every((key) => completed.has(key));
  return { completed, complete, percent: complete ? 100 : completed.size * OBJECTIONS_BLOCK_PERCENT };
}

// Terminar el cuarto bloque marca la actividad obligatoria, completa el módulo, emite el sello y habilita «Tipificación».
async function saveModuleProgress(db: Db, userId: string, module: Awaited<ReturnType<typeof access>>['module'], percent: number, done: boolean, now: Date) {
  const existing = await db.userModuleProgress.findUnique({ where: { userId_moduleId: { userId, moduleId: module.id } } });
  const alreadyPassed = existing?.status === 'PASSED';
  await upsertModuleProgress(db, userId, module.id, {
    status: alreadyPassed ? 'PASSED' : 'IN_PROGRESS', percent: alreadyPassed ? 100 : percent,
    startedAt: existing?.startedAt ?? now, lastActivityAt: now,
  });
  if (!done) return;
  for (const activity of module.activities.filter((entry) => entry.status === 'ACTIVE' && entry.isRequired)) {
    const progress = await db.userActivityProgress.findUnique({ where: { userId_activityId: { userId, activityId: activity.id } } });
    await upsertActivityProgress(db, userId, activity.id, { status: 'PASSED', startedAt: progress?.startedAt ?? now, completedAt: progress?.completedAt ?? now, lastActivityAt: now });
  }
  if (!alreadyPassed) await completeModule(db, userId, module.id, undefined, now);
}

export async function objectionsState(userId: string) {
  const { view, nextRoute, nextName, reviewMode } = await access(prisma, userId);
  const path = pathOf(await progressRows(prisma, userId, view.moduleId), view.status === 'PASSED');
  const blocks = OBJECTIONS_BLOCKS.map((block, index) => ({
    ...block, completed: path.completed.has(block.key) || path.complete,
    enabled: path.complete || OBJECTIONS_KEYS.slice(0, index).every((key) => path.completed.has(key)),
  }));
  const pending = blocks.find((block) => block.enabled && !block.completed);
  return {
    name: OBJECTIONS_NAME, reviewMode, percent: path.percent, complete: path.complete, completedCount: blocks.filter((block) => block.completed).length,
    currentBlock: pending?.key ?? OBJECTIONS_KEYS[0], blocks, nextRoute, nextName,
  };
}

// Un bloque se completa al llegar a su última diapositiva; el servidor solo exige el orden de los bloques.
export async function completeObjectionsBlock(userId: string, key: ObjectionsKey) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM induccion.usuarios WHERE id = ${userId}::uuid FOR UPDATE`;
    const { module, view, reviewMode } = await access(tx, userId);
    // Modo repaso (asesor certificado): se navega sin cambiar el historial.
    if (reviewMode) return;
    const rows = await progressRows(tx, userId, module.id);
    const path = pathOf(rows, view.status === 'PASSED');
    if (!OBJECTIONS_KEYS.slice(0, OBJECTIONS_KEYS.indexOf(key)).every((previous) => path.completed.has(previous) || path.complete)) {
      throw new ForbiddenError('Completa el bloque anterior para continuar.', 'PREVIOUS_BLOCK_REQUIRED');
    }
    const now = new Date();
    const previous = rows.find((row) => row.blockKey === key);
    await tx.collectionsBlockProgress.upsert({
      where: { userId_moduleId_blockKey_contentVersion: { userId, moduleId: module.id, blockKey: key, contentVersion: OBJECTIONS_VERSION } },
      create: { userId, moduleId: module.id, blockKey: key, contentVersion: OBJECTIONS_VERSION, answers: {}, completedAt: now },
      update: { completedAt: previous?.completedAt ?? now },
    });
    path.completed.add(key);
    const done = OBJECTIONS_KEYS.every((entry) => path.completed.has(entry));
    await saveModuleProgress(tx, userId, module, done ? 100 : path.completed.size * OBJECTIONS_BLOCK_PERCENT, done, now);
  });
  return objectionsState(userId);
}
