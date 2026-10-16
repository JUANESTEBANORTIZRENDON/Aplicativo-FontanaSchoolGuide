import type { Prisma, ProgressStatus } from '@prisma/client';
import type { Db } from '../config/prisma.js';

// Crea las filas de progreso que falten sin tocar las existentes (usuarios antiguos o módulos nuevos).
export function createMissingModuleProgress(db: Db, userId: string, rows: { moduleId: string; status: ProgressStatus }[]) {
  return db.userModuleProgress.createMany({ data: rows.map((row) => ({ userId, ...row })), skipDuplicates: true });
}

export function moduleProgressForUser(db: Db, userId: string) {
  return db.userModuleProgress.findMany({ where: { userId } });
}

export function activityProgressForUser(db: Db, userId: string) {
  return db.userActivityProgress.findMany({ where: { userId } });
}

export function activeSealsForUser(db: Db, userId: string) {
  return db.seal.findMany({ where: { userId, status: 'ACTIVE' }, include: { module: { select: { slug: true, name: true } } }, orderBy: { issuedAt: 'asc' } });
}

export function findActiveSeal(db: Db, userId: string, moduleId: string) {
  return db.seal.findFirst({ where: { userId, moduleId, status: 'ACTIVE' } });
}

export function createSeal(db: Db, data: Prisma.SealUncheckedCreateInput) {
  return db.seal.create({ data });
}

export function overridesForUser(db: Db, userId: string) {
  return db.userActivityOverride.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
}

// Intentos del asesor en las actividades indicadas, de todas las versiones de su evaluación: cambiar la
// configuración (más intentos, otra nota mínima) no borra lo que el asesor ya usó.
export function attemptsForUser(db: Db, userId: string, activityIds: string[]) {
  return db.attempt.findMany({
    where: { userId, evaluation: { activityId: { in: activityIds } } },
    select: { id: true, number: true, status: true, overrideId: true, submittedAt: true, startedAt: true, evaluationId: true, evaluation: { select: { activityId: true } } },
  });
}

export function upsertModuleProgress(db: Db, userId: string, moduleId: string, data: Omit<Prisma.UserModuleProgressUncheckedCreateInput, 'userId' | 'moduleId'>) {
  return db.userModuleProgress.upsert({
    where: { userId_moduleId: { userId, moduleId } },
    create: { userId, moduleId, ...data },
    update: data,
  });
}

export function upsertActivityProgress(db: Db, userId: string, activityId: string, data: Omit<Prisma.UserActivityProgressUncheckedCreateInput, 'userId' | 'activityId'>) {
  return db.userActivityProgress.upsert({
    where: { userId_activityId: { userId, activityId } },
    create: { userId, activityId, ...data },
    update: data,
  });
}

export function findActivityProgress(db: Db, userId: string, activityId: string) {
  return db.userActivityProgress.findUnique({ where: { userId_activityId: { userId, activityId } } });
}

export function findModuleProgress(db: Db, userId: string, moduleId: string) {
  return db.userModuleProgress.findUnique({ where: { userId_moduleId: { userId, moduleId } } });
}

// Bloqueo de fila para serializar operaciones del mismo usuario sobre la misma actividad.
export async function lockActivityProgress(db: Db, userId: string, activityId: string): Promise<void> {
  await db.$queryRaw`SELECT id FROM induccion.progreso_actividad WHERE user_id = ${userId}::uuid AND activity_id = ${activityId}::uuid FOR UPDATE`;
}

// Módulos que dependen de `moduleId` junto con todos sus prerrequisitos.
export function dependentsOf(db: Db, moduleId: string) {
  return db.trainingModule.findMany({
    where: { prerequisites: { some: { prerequisiteModuleId: moduleId } } },
    include: { prerequisites: { select: { prerequisiteModuleId: true } } },
  });
}
