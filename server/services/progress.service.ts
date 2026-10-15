import { Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma, type Db } from '../config/prisma.js';
import { CERTIFICATE_MODULE_SLUG } from '../domain/enums.js';
import { ForbiddenError, NotFoundError } from '../domain/errors.js';
import {
  computeAvailability, computeModuleViews, initialStatus, percentOf,
  type Availability, type ModuleInput, type ModuleView, type OverrideLite,
} from '../domain/progress.js';
import { activeEvaluations, listVisibleModules, type CatalogModule } from '../repositories/catalog.repository.js';
import {
  activeSealsForUser, activityProgressForUser, attemptsForUser, createMissingModuleProgress, createSeal, dependentsOf,
  findActiveSeal, moduleProgressForUser, overridesForUser, upsertModuleProgress,
} from '../repositories/progress.repository.js';

function toModuleInput(module: CatalogModule): ModuleInput {
  return {
    id: module.id, slug: module.slug, name: module.name, order: module.order, status: module.status, route: module.route,
    prerequisites: module.prerequisites.map((edge) => ({ id: edge.prerequisite.id, name: edge.prerequisite.name })),
    activities: module.activities.map((activity) => ({
      id: activity.id, title: activity.title, type: activity.type, order: activity.order, status: activity.status, isRequired: activity.isRequired, route: activity.route,
    })),
  };
}

// Crea las filas de progreso de un usuario nuevo: sin prerrequisitos AVAILABLE, el resto BLOCKED.
export async function initializeForUser(db: Db, userId: string, modules?: CatalogModule[]): Promise<void> {
  const catalog = modules ?? await listVisibleModules(db);
  await createMissingModuleProgress(db, userId, catalog.map((module) => ({ moduleId: module.id, status: initialStatus(module) })));
}

export type TrainingSnapshot = {
  modules: CatalogModule[];
  views: ModuleView[];
  overrides: OverrideLite[];
  availability: Map<string, Availability>;
  evaluations: Awaited<ReturnType<typeof activeEvaluations>>;
};

// Carga todo lo necesario para calcular el estado efectivo de un usuario.
// Con sync, el estado guardado se alinea con el efectivo (excepciones vencidas o revocadas, desbloqueos)
// para que las métricas en SQL lo reflejen. Un módulo aprobado o inactivo conserva su estado guardado.
export async function loadSnapshot(db: Db, userId: string, now = new Date(), options: { sync?: boolean } = {}): Promise<TrainingSnapshot> {
  const modules = await listVisibleModules(db);
  const moduleProgress = await moduleProgressForUser(db, userId);
  if (moduleProgress.length < modules.length) {
    await initializeForUser(db, userId, modules);
    moduleProgress.splice(0, moduleProgress.length, ...await moduleProgressForUser(db, userId));
  }
  const activityIds = modules.flatMap((module) => module.activities.map((activity) => activity.id));
  const [activityProgress, seals, overrides, evaluations] = await Promise.all([
    activityProgressForUser(db, userId),
    activeSealsForUser(db, userId),
    overridesForUser(db, userId),
    activeEvaluations(db, activityIds),
  ]);
  const attempts = await attemptsForUser(db, userId, [...evaluations.values()].map((evaluation) => evaluation.id));
  const availability = new Map<string, Availability>();
  for (const [activityId, evaluation] of evaluations) {
    availability.set(activityId, computeAvailability(
      evaluation,
      attempts.filter((attempt) => attempt.evaluationId === evaluation.id),
      overrides.filter((override) => override.activityId === activityId),
      now,
    ));
  }
  const views = computeModuleViews(modules.map(toModuleInput), {
    moduleProgress: new Map(moduleProgress.map((row) => [row.moduleId, { status: row.status, lastActivityAt: row.lastActivityAt }])),
    activityProgress: new Map(activityProgress.map((row) => [row.activityId, { status: row.status }])),
    sealedModuleIds: new Set(seals.map((seal) => seal.moduleId)),
    overrides,
    availability,
  }, now);
  if (options.sync) {
    const stored = new Map(moduleProgress.map((row) => [row.moduleId, row.status]));
    for (const view of views) {
      const current = stored.get(view.moduleId);
      if (view.catalogStatus !== 'ACTIVE' || current === 'PASSED' || current === view.status) continue;
      await db.userModuleProgress.updateMany({ where: { userId, moduleId: view.moduleId, status: { not: 'PASSED' } }, data: { status: view.status } });
    }
  }
  return { modules, views, overrides, availability, evaluations };
}

export async function computeModuleState(userId: string, db: Db = prisma, options: { sync?: boolean } = {}): Promise<ModuleView[]> {
  return (await loadSnapshot(db, userId, new Date(), options)).views;
}

// Acceso directo por URL: el servidor decide, no el botón del frontend.
export async function getAccessibleModule(userId: string, slug: string) {
  const snapshot = await loadSnapshot(prisma, userId, new Date(), { sync: true });
  const view = snapshot.views.find((module) => module.slug === slug);
  if (!view) throw new NotFoundError('El módulo no existe.', 'MODULE_NOT_FOUND');
  if (!view.enabled) {
    const reason = view.blockedReason ?? (view.status === 'PASSED' ? 'Ya completaste este módulo. La pantalla de resultados estará disponible próximamente.' : 'Módulo no disponible.');
    throw new ForbiddenError(reason, 'MODULE_BLOCKED', { blockedReason: reason, module: view });
  }
  const module = snapshot.modules.find((item) => item.slug === slug)!;
  return {
    module: view,
    activities: module.activities.map((activity) => ({
      activityId: activity.id, title: activity.title, type: activity.type, order: activity.order, route: activity.route,
      status: activity.status, enabled: activity.status === 'ACTIVE',
      blockedReason: activity.status === 'ACTIVE' ? null : 'Actividad no disponible temporalmente',
      waitUntil: snapshot.availability.get(activity.id)?.waitUntil?.toISOString() ?? null,
      attemptsRemaining: snapshot.availability.get(activity.id)?.remaining ?? null,
    })),
    content: { status: 'EN_PREPARACION', message: 'Contenido en preparación' },
  };
}

export async function getAdvisorSummary(userId: string) {
  const snapshot = await loadSnapshot(prisma, userId);
  const learning = snapshot.views.filter((view) => view.slug !== CERTIFICATE_MODULE_SLUG && view.catalogStatus === 'ACTIVE');
  const total = learning.reduce((sum, view) => sum.add(view.progressPercent), new Prisma.Decimal(0));
  const seals = await activeSealsForUser(prisma, userId);
  const last = snapshot.views.map((view) => view.lastActivityAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  return {
    overallPercent: learning.length ? total.div(learning.length).toDecimalPlaces(2).toFixed(2) : '0.00',
    modulesPassed: learning.filter((view) => view.hasSeal).length,
    modulesTotal: learning.length,
    seals: seals.map((seal) => ({ moduleSlug: seal.module.slug, moduleName: seal.module.name, issuedAt: seal.issuedAt.toISOString() })),
    lastActivityAt: last,
    certificateAvailable: snapshot.views.some((view) => view.slug === CERTIFICATE_MODULE_SLUG && view.enabled),
  };
}

// Recalcula el porcentaje del módulo a partir de sus actividades obligatorias activas.
export async function refreshModulePercent(db: Db, userId: string, moduleId: string): Promise<{ percent: Prisma.Decimal; complete: boolean }> {
  const activities = await db.activity.findMany({ where: { moduleId, status: 'ACTIVE', isRequired: true }, select: { id: true } });
  const passed = activities.length === 0 ? 0 : await db.userActivityProgress.count({ where: { userId, status: 'PASSED', activityId: { in: activities.map((activity) => activity.id) } } });
  const percent = percentOf(passed, activities.length);
  return { percent, complete: activities.length > 0 && passed === activities.length };
}

// Debe ejecutarse dentro de una transacción. Emite el sello una sola vez y desbloquea dependientes.
export async function completeModule(db: Db, userId: string, moduleId: string, evidenceAttemptId?: string, now = new Date()): Promise<{ sealIssued: boolean; unlocked: string[] }> {
  const { percent, complete } = await refreshModulePercent(db, userId, moduleId);
  if (!complete) return { sealIssued: false, unlocked: [] };
  await upsertModuleProgress(db, userId, moduleId, { status: 'PASSED', percent, completedAt: now, lastActivityAt: now });
  let sealIssued = false;
  if (!await findActiveSeal(db, userId, moduleId)) {
    await createSeal(db, { userId, moduleId, status: 'ACTIVE', issuedAt: now, evidenceAttemptId: evidenceAttemptId ?? null });
    sealIssued = true;
  }
  const sealed = new Set((await activeSealsForUser(db, userId)).map((seal) => seal.moduleId));
  const unlocked: string[] = [];
  for (const dependent of await dependentsOf(db, moduleId)) {
    if (!dependent.prerequisites.every((edge) => sealed.has(edge.prerequisiteModuleId))) continue;
    const current = await db.userModuleProgress.findUnique({ where: { userId_moduleId: { userId, moduleId: dependent.id } } });
    if (!current || current.status === 'BLOCKED' || current.status === 'NOT_STARTED') {
      await upsertModuleProgress(db, userId, dependent.id, { status: 'AVAILABLE' });
      unlocked.push(dependent.slug);
    }
  }
  if (env.CERTIFICATES_ENABLED) {
    const { issueIfEligible } = await import('./certificate.service.js');
    await issueIfEligible(db, userId);
  }
  return { sealIssued, unlocked };
}
