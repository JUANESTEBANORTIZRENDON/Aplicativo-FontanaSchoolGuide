import { Prisma } from '@prisma/client';
import type { AttemptStatus, CatalogStatus, OverrideAction, ProgressStatus } from '@prisma/client';
import { CERTIFICATE_MODULE_SLUG } from './enums.js';

// Reglas puras de progreso: sin acceso a datos, para poder probarlas y reutilizarlas
// desde el área del asesor, el panel administrativo y las métricas.

export const MODULE_INACTIVE_REASON = 'Módulo no disponible temporalmente';
export const EXHAUSTED_REASON = 'Agotaste los intentos disponibles. Solicita una reactivación al administrador.';
// Módulos con pantalla de resultados: al aprobarlos siguen abiertos para repasar su resumen.
// Los demás se habilitan cuando tengan su pantalla de resultados.
export const RESULT_SCREEN_AVAILABLE = false;
export const RESULT_SCREEN_SLUGS: ReadonlySet<string> = new Set(["ofimatica-mecanografia", "induccion-cobranzas"]);

const GRANT_ACTIONS: OverrideAction[] = ['EXTRA_ATTEMPT', 'REACTIVATE'];

export type OverrideLite = {
  id: string;
  activityId: string;
  action: OverrideAction;
  extraAttempts: number;
  expiresAt: Date | null;
  revokedAt: Date | null;
  consumedAt: Date | null;
  createdAt: Date;
};

export type AttemptLite = {
  id: string;
  number: number;
  status: AttemptStatus;
  overrideId: string | null;
  submittedAt: Date | null;
  startedAt: Date;
};

export type EvaluationLite = { id: string; maxAttempts: number; waitMinutes: number; minimumScore: Prisma.Decimal };

// Vigente = no revocada, no consumida y sin vencer.
export function isOverrideActive(override: OverrideLite, now: Date): boolean {
  return !override.revokedAt && !override.consumedAt && (!override.expiresAt || override.expiresAt > now);
}

export function overrideState(override: OverrideLite, now: Date): 'VIGENTE' | 'REVOCADA' | 'VENCIDA' | 'CONSUMIDA' {
  if (override.revokedAt) return 'REVOCADA';
  if (override.consumedAt) return 'CONSUMIDA';
  if (override.expiresAt && override.expiresAt <= now) return 'VENCIDA';
  return 'VIGENTE';
}

// Intentos que concede una excepción: REACTIVATE concede al menos uno.
export function grantedAttempts(override: Pick<OverrideLite, 'action' | 'extraAttempts'>): number {
  if (override.action === 'REACTIVATE') return Math.max(1, override.extraAttempts);
  if (override.action === 'EXTRA_ATTEMPT') return override.extraAttempts;
  return 0;
}

export type Availability = {
  passed: boolean;
  openAttemptId: string | null;
  remaining: number;
  exhausted: boolean;
  waitUntil: Date | null;
  canStart: boolean;
  // Excepción a la que se cargará el siguiente intento cuando se agotó el cupo base.
  grantOverrideId: string | null;
  resetWaitOverrideId: string | null;
  nextNumber: number;
};

// Los intentos sin overrideId consumen el cupo base (maxAttempts); los que llevan overrideId
// consumen el cupo de esa excepción. Así una excepción consumida o revocada no devuelve intentos.
export function computeAvailability(evaluation: EvaluationLite, attempts: AttemptLite[], overrides: OverrideLite[], now: Date): Availability {
  const counted = attempts.filter((attempt) => attempt.status !== 'CANCELLED');
  const passed = counted.some((attempt) => attempt.status === 'PASSED');
  const open = counted.find((attempt) => attempt.status === 'IN_PROGRESS') ?? null;
  const baseRemaining = Math.max(0, evaluation.maxAttempts - counted.filter((attempt) => !attempt.overrideId).length);
  const grants = overrides
    .filter((override) => GRANT_ACTIONS.includes(override.action) && isOverrideActive(override, now))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((override) => ({ id: override.id, left: grantedAttempts(override) - counted.filter((attempt) => attempt.overrideId === override.id).length }))
    .filter((grant) => grant.left > 0);
  const remaining = baseRemaining + grants.reduce((sum, grant) => sum + grant.left, 0);
  const lastFailed = counted
    .filter((attempt) => attempt.status === 'FAILED' && attempt.submittedAt)
    .sort((a, b) => b.submittedAt!.getTime() - a.submittedAt!.getTime())[0];
  const resetWait = overrides.find((override) => override.action === 'RESET_WAIT' && isOverrideActive(override, now)) ?? null;
  let waitUntil = lastFailed && evaluation.waitMinutes > 0 ? new Date(lastFailed.submittedAt!.getTime() + evaluation.waitMinutes * 60_000) : null;
  if (waitUntil && (waitUntil <= now || resetWait)) waitUntil = null;
  const exhausted = !passed && !open && remaining === 0;
  return {
    passed,
    openAttemptId: open?.id ?? null,
    remaining,
    exhausted,
    waitUntil,
    canStart: !passed && !open && remaining > 0 && !waitUntil,
    grantOverrideId: baseRemaining > 0 ? null : grants[0]?.id ?? null,
    resetWaitOverrideId: resetWait && lastFailed && evaluation.waitMinutes > 0 ? resetWait.id : null,
    nextNumber: attempts.reduce((max, attempt) => Math.max(max, attempt.number), 0) + 1,
  };
}

export type ModuleInput = {
  id: string;
  slug: string;
  name: string;
  order: number;
  status: CatalogStatus;
  route: string;
  prerequisites: { id: string; name: string }[];
  activities: { id: string; title: string; type: string; order: number; status: CatalogStatus; isRequired: boolean; route: string | null }[];
};

export type ModuleView = {
  moduleId: string;
  slug: string;
  name: string;
  order: number;
  status: ProgressStatus;
  progressPercent: string;
  actionLabel: string;
  route: string;
  enabled: boolean;
  blockedReason: string | null;
  catalogStatus: CatalogStatus;
  hasSeal: boolean;
  waitUntil: string | null;
  missingSeals?: string[];
  lastActivityAt: string | null;
};

export type UserTrainingState = {
  moduleProgress: Map<string, { status: ProgressStatus; lastActivityAt: Date | null; percent?: Prisma.Decimal }>;
  activityProgress: Map<string, { status: ProgressStatus }>;
  sealedModuleIds: Set<string>;
  overrides: OverrideLite[];
  availability: Map<string, Availability>;
};

export function percentOf(passed: number, total: number): Prisma.Decimal {
  if (total === 0) return new Prisma.Decimal(0);
  return new Prisma.Decimal(passed).div(total).mul(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function joinNames(names: string[]): string {
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`;
}

// Estado efectivo de cada módulo para un usuario. Una sola función para asesor, panel y métricas.
export function computeModuleViews(modules: ModuleInput[], state: UserTrainingState, now: Date): ModuleView[] {
  return [...modules].sort((a, b) => a.order - b.order).map((module) => {
    const activityIds = new Set(module.activities.map((activity) => activity.id));
    const moduleOverrides = state.overrides.filter((override) => activityIds.has(override.activityId) && isOverrideActive(override, now));
    const required = module.activities.filter((activity) => activity.status === 'ACTIVE' && activity.isRequired);
    const passedCount = required.filter((activity) => state.activityProgress.get(activity.id)?.status === 'PASSED' || state.availability.get(activity.id)?.passed).length;
    const hasSeal = state.sealedModuleIds.has(module.id);
    const stored = state.moduleProgress.get(module.id);
    const base = {
      moduleId: module.id, slug: module.slug, name: module.name, order: module.order, route: module.route,
      catalogStatus: module.status, hasSeal, waitUntil: null as string | null,
      lastActivityAt: stored?.lastActivityAt?.toISOString() ?? null,
    };
    const percent = (module.slug === 'induccion-cobranzas' && stored?.percent && !hasSeal && stored.status !== 'PASSED'
      ? stored.percent
      : hasSeal && required.length === 0 ? new Prisma.Decimal(100) : percentOf(passedCount, required.length)).toFixed(2);
    const missing = module.prerequisites.filter((prerequisite) => !state.sealedModuleIds.has(prerequisite.id)).map((prerequisite) => prerequisite.name);

    if (module.status !== 'ACTIVE') {
      return { ...base, status: 'BLOCKED', progressPercent: percent, actionLabel: 'No disponible', enabled: false, blockedReason: MODULE_INACTIVE_REASON };
    }

    if (module.slug === CERTIFICATE_MODULE_SLUG) {
      if (missing.length === 0) return { ...base, status: 'AVAILABLE', progressPercent: '100.00', actionLabel: 'Ver certificado', enabled: true, blockedReason: null, missingSeals: [] };
      const sealed = module.prerequisites.length - missing.length;
      return {
        ...base, status: 'BLOCKED', progressPercent: percentOf(sealed, module.prerequisites.length).toFixed(2), actionLabel: 'Bloqueado', enabled: false,
        blockedReason: `Te faltan los sellos de: ${joinNames(missing)}`, missingSeals: missing,
      };
    }

    if (hasSeal || stored?.status === 'PASSED') {
      if (moduleOverrides.some((override) => override.action === 'REOPEN_MODULE')) {
        return { ...base, status: 'IN_PROGRESS', progressPercent: percent, actionLabel: 'Continuar', enabled: true, blockedReason: null };
      }
      return { ...base, status: 'PASSED', progressPercent: percent, actionLabel: 'Completado', enabled: RESULT_SCREEN_AVAILABLE || RESULT_SCREEN_SLUGS.has(module.slug), blockedReason: null };
    }

    if (missing.length > 0 && !moduleOverrides.some((override) => override.action === 'UNLOCK')) {
      return { ...base, status: 'BLOCKED', progressPercent: percent, actionLabel: 'Bloqueado', enabled: false, blockedReason: `Aprueba ${joinNames(missing)} para continuar` };
    }

    const availabilities = required.map((activity) => state.availability.get(activity.id)).filter((value): value is Availability => Boolean(value));
    // Una actividad sin intentos no frena las demás: el asesor sigue con lo que le falta y el administrador
    // decide si reactiva la agotada. El módulo solo se detiene cuando todo lo pendiente está agotado.
    const pending = required.filter((activity) => !(state.activityProgress.get(activity.id)?.status === 'PASSED' || state.availability.get(activity.id)?.passed));
    if (pending.length > 0 && pending.every((activity) => state.availability.get(activity.id)?.exhausted)) {
      return { ...base, status: 'FAILED', progressPercent: percent, actionLabel: 'Sin intentos', enabled: false, blockedReason: EXHAUSTED_REASON };
    }

    const started = stored?.status === 'IN_PROGRESS' || stored?.status === 'FAILED' || passedCount > 0
      || availabilities.some((availability) => availability.openAttemptId || availability.nextNumber > 1);
    const waits = availabilities.map((availability) => availability.waitUntil).filter((value): value is Date => Boolean(value));
    const waitUntil = waits.length ? new Date(Math.min(...waits.map((date) => date.getTime()))).toISOString() : null;
    return { ...base, waitUntil, status: started ? 'IN_PROGRESS' : 'AVAILABLE', progressPercent: percent, actionLabel: 'Continuar', enabled: true, blockedReason: null };
  });
}

// Estado inicial: módulos sin prerrequisitos disponibles, el resto bloqueados.
export function initialStatus(module: { prerequisites: unknown[] }): ProgressStatus {
  return module.prerequisites.length === 0 ? 'AVAILABLE' : 'BLOCKED';
}
