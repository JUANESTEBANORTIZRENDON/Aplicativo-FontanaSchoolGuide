import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { ConflictError, ValidationError } from '../domain/errors.js';
import { OFFICE_MODULE_SLUG, type OfficeConfigSnapshot, type OfficeConfigValues } from '../domain/office.js';
import { activeConfig, configHistory, officeActivities, type OfficeConfig } from '../repositories/office.repository.js';
import { audit, type ActionContext } from './audit.service.js';
import { createEvaluationVersion } from './catalog.service.js';

export { activeConfig };

// Lo que se guarda en cada intento: así un cambio posterior no altera su evaluación.
export function snapshotOf(config: OfficeConfig): OfficeConfigSnapshot {
  const { id: _id, status: _status, reason: _reason, createdAt: _createdAt, ...values } = config;
  void _id; void _status; void _reason; void _createdAt;
  return values;
}

// Valores y metadatos para el panel: versión vigente e historial.
export async function getConfigWithHistory() {
  const [config, history] = await Promise.all([activeConfig(), configHistory()]);
  return {
    config,
    history: history.map((row) => ({
      id: row.id, version: row.version, status: row.status, reason: row.reason, createdAt: row.createdAt.toISOString(),
      createdBy: row.createdBy ? { id: row.createdBy.id, nombreCompleto: row.createdBy.nombreCompleto } : null,
      values: {
        typingDurationSeconds: row.typingDurationSeconds, typingMinCorrectCpm: row.typingMinCorrectCpm, typingMinAccuracy: Number(row.typingMinAccuracy),
        typingMaxAttempts: row.typingMaxAttempts, typingStartWindowSeconds: row.typingStartWindowSeconds, typingAttemptTtlMinutes: row.typingAttemptTtlMinutes,
        excelMinScore: Number(row.excelMinScore), excelMaxAttempts: row.excelMaxAttempts,
        dictationMinScore: Number(row.dictationMinScore), dictationMaxAttempts: row.dictationMaxAttempts, dictationMaxPlays: row.dictationMaxPlays,
      },
    })),
  };
}

export type ConfigChange = Partial<OfficeConfigValues>;

// No edita la versión vigente: archiva la anterior, crea la nueva y sincroniza las evaluaciones
// que usa el servicio de intentos (intentos máximos y nota mínima), todo en una transacción.
export async function updateConfig(changes: ConfigChange, reason: string, context: ActionContext) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('office-module-config'))`;
    const current = await activeConfig(tx);
    const next: OfficeConfigValues = { ...snapshotValues(current), ...changes };
    const changed = (Object.keys(changes) as (keyof OfficeConfigValues)[]).filter((key) => changes[key] !== undefined && changes[key] !== current[key]);
    if (changed.length === 0) throw new ValidationError('No hay cambios respecto a la configuración vigente.', { _: 'Sin cambios.' }, 'NO_CHANGES');

    if (current.id) await tx.officeModuleConfig.update({ where: { id: current.id }, data: { status: 'ARCHIVED' } });
    const created = await tx.officeModuleConfig.create({
      data: {
        moduleKey: OFFICE_MODULE_SLUG, version: current.version + 1, status: 'ACTIVE', reason, createdById: context.actorUserId,
        typingDurationSeconds: next.typingDurationSeconds, typingMinCorrectCpm: next.typingMinCorrectCpm, typingMinAccuracy: new Prisma.Decimal(next.typingMinAccuracy),
        typingMaxAttempts: next.typingMaxAttempts, typingStartWindowSeconds: next.typingStartWindowSeconds, typingAttemptTtlMinutes: next.typingAttemptTtlMinutes,
        excelMinScore: new Prisma.Decimal(next.excelMinScore), excelMaxAttempts: next.excelMaxAttempts,
        dictationMinScore: new Prisma.Decimal(next.dictationMinScore), dictationMaxAttempts: next.dictationMaxAttempts, dictationMaxPlays: next.dictationMaxPlays,
      },
    });

    // Evaluaciones afectadas: solo las que cambian de intentos máximos o nota mínima.
    const activities = await officeActivities(tx);
    const targets: { section: 'mecanografia' | 'excel' | 'ortografia'; minimumScore: number; maxAttempts: number; changed: boolean }[] = [
      { section: 'mecanografia', minimumScore: 100, maxAttempts: next.typingMaxAttempts, changed: changed.includes('typingMaxAttempts') },
      { section: 'excel', minimumScore: next.excelMinScore, maxAttempts: next.excelMaxAttempts, changed: changed.includes('excelMinScore') || changed.includes('excelMaxAttempts') },
      { section: 'ortografia', minimumScore: next.dictationMinScore, maxAttempts: next.dictationMaxAttempts, changed: changed.includes('dictationMinScore') || changed.includes('dictationMaxAttempts') },
    ];
    const evaluations: { section: string; evaluationId: string; version: number }[] = [];
    for (const target of targets) {
      const activity = activities?.bySection[target.section];
      if (!target.changed || !activity) continue;
      const evaluation = await createEvaluationVersion(activity.id, {
        minimumScore: target.minimumScore, maxAttempts: target.maxAttempts, waitMinutes: 0, title: activity.title,
      }, null, tx);
      evaluations.push({ section: target.section, evaluationId: evaluation.id, version: evaluation.version });
    }

    await audit(tx, context, {
      action: 'OFFICE_CONFIG_UPDATED', entityType: 'OfficeModuleConfig', entityId: created.id,
      before: { version: current.version, ...snapshotValues(current) },
      after: { version: created.version, ...next, changed, evaluations },
      reason,
    });
    return { config: await activeConfig(tx), changed, evaluations };
  }, { timeout: 30_000 });
}

function snapshotValues(config: OfficeConfig): OfficeConfigValues {
  const { version: _version, ...values } = snapshotOf(config);
  void _version;
  return values;
}

export function assertConfigAvailable(config: OfficeConfig): void {
  if (!config.id) throw new ConflictError('La configuración del módulo todavía no está disponible.', 'OFFICE_CONFIG_MISSING');
}
