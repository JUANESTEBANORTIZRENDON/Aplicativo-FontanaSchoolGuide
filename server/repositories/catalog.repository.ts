import type { CatalogStatus, Prisma } from '@prisma/client';
import { prisma, type Db } from '../config/prisma.js';

// Estados visibles para el asesor: los borradores y archivados no se muestran.
export const VISIBLE_STATUSES: CatalogStatus[] = ['ACTIVE', 'INACTIVE'];

const moduleInclude = {
  prerequisites: { include: { prerequisite: { select: { id: true, name: true, slug: true } } } },
  activities: { where: { status: { in: VISIBLE_STATUSES } }, orderBy: { order: 'asc' } },
} as const satisfies Prisma.TrainingModuleInclude;

export type CatalogModule = Prisma.TrainingModuleGetPayload<{ include: typeof moduleInclude }>;

export function listVisibleModules(db: Db = prisma): Promise<CatalogModule[]> {
  return db.trainingModule.findMany({ where: { status: { in: VISIBLE_STATUSES } }, include: moduleInclude, orderBy: { order: 'asc' } });
}

export function listAllModulesForAdmin() {
  return prisma.trainingModule.findMany({
    include: {
      prerequisites: { include: { prerequisite: { select: { id: true, name: true, slug: true } } } },
      activities: {
        orderBy: { order: 'asc' },
        include: { evaluations: { orderBy: { version: 'desc' }, take: 1 } },
      },
    },
    orderBy: { order: 'asc' },
  });
}

export function findModuleById(db: Db, id: string) {
  return db.trainingModule.findUnique({ where: { id } });
}

export function findModuleBySlug(db: Db, slug: string) {
  return db.trainingModule.findUnique({ where: { slug } });
}

export function findActivityById(db: Db, id: string) {
  return db.activity.findUnique({ where: { id }, include: { module: true } });
}

export function updateModuleStatus(db: Db, id: string, status: CatalogStatus) {
  return db.trainingModule.update({ where: { id }, data: { status } });
}

export function updateActivityStatus(db: Db, id: string, status: CatalogStatus) {
  return db.activity.update({ where: { id }, data: { status } });
}

// Evaluación vigente (versión ACTIVE más reciente) de cada actividad.
export async function activeEvaluations(db: Db, activityIds: string[]) {
  if (activityIds.length === 0) return new Map<string, Prisma.EvaluationGetPayload<object>>();
  const rows = await db.evaluation.findMany({ where: { activityId: { in: activityIds }, status: 'ACTIVE' }, orderBy: [{ activityId: 'asc' }, { version: 'desc' }] });
  const map = new Map<string, (typeof rows)[number]>();
  for (const row of rows) if (!map.has(row.activityId)) map.set(row.activityId, row);
  return map;
}

export function latestEvaluationVersion(db: Db, activityId: string) {
  return db.evaluation.findFirst({ where: { activityId }, orderBy: { version: 'desc' }, select: { version: true } });
}

export function archiveActiveEvaluations(db: Db, activityId: string) {
  return db.evaluation.updateMany({ where: { activityId, status: 'ACTIVE' }, data: { status: 'ARCHIVED' } });
}

export function createEvaluation(db: Db, data: Prisma.EvaluationUncheckedCreateInput) {
  return db.evaluation.create({ data });
}

export function listPrerequisiteEdges(db: Db) {
  return db.modulePrerequisite.findMany({ select: { moduleId: true, prerequisiteModuleId: true } });
}

export function replacePrerequisites(db: Db, moduleId: string, prerequisiteIds: string[]) {
  return Promise.all([
    db.modulePrerequisite.deleteMany({ where: { moduleId, prerequisiteModuleId: { notIn: prerequisiteIds } } }),
    db.modulePrerequisite.createMany({ data: prerequisiteIds.map((prerequisiteModuleId) => ({ moduleId, prerequisiteModuleId })), skipDuplicates: true }),
  ]);
}
