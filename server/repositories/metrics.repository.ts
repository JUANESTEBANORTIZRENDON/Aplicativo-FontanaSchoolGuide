import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';

// Todas las métricas se calculan con SQL agregado y parámetros (Prisma.sql).
// Este archivo no usa findMany: nunca se cargan colecciones completas para contar.

export type MetricsFilters = {
  from?: Date;
  to?: Date;
  advisorStatus?: string;
  moduleId?: string;
  activityId?: string;
};

const empty = Prisma.empty;

function advisorsCte(filters: MetricsFilters): Prisma.Sql {
  return Prisma.sql`adv AS (
    SELECT id FROM induccion.usuarios
    WHERE rol = 'asesor' ${filters.advisorStatus ? Prisma.sql`AND estado = ${filters.advisorStatus}` : empty}
  )`;
}

function range(column: Prisma.Sql, filters: MetricsFilters): Prisma.Sql {
  return Prisma.sql`${filters.from ? Prisma.sql`AND ${column} >= ${filters.from}` : empty} ${filters.to ? Prisma.sql`AND ${column} < ${filters.to}` : empty}`;
}

function scope(filters: MetricsFilters, moduleColumn: Prisma.Sql, activityColumn: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`${filters.moduleId ? Prisma.sql`AND ${moduleColumn} = ${filters.moduleId}::uuid` : empty} ${filters.activityId ? Prisma.sql`AND ${activityColumn} = ${filters.activityId}::uuid` : empty}`;
}

const SUBMITTED = Prisma.sql`('SUBMITTED', 'PASSED', 'FAILED')`;

export async function activeAdvisors(): Promise<number> {
  const [row] = await prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM induccion.usuarios WHERE rol = 'asesor' AND estado = 'activo'`;
  return row?.n ?? 0;
}

// Actividades obligatorias aprobadas / (actividades obligatorias activas × asesores).
export async function overallProgress(filters: MetricsFilters) {
  const [row] = await prisma.$queryRaw<{ activities: number; advisors: number; passed: number }[]>`
    WITH ${advisorsCte(filters)},
    acts AS (
      SELECT a.id FROM induccion.actividades a JOIN induccion.modulos_formacion m ON m.id = a.module_id
      WHERE a.status = 'ACTIVE' AND a.is_required AND m.status = 'ACTIVE' ${scope(filters, Prisma.sql`m.id`, Prisma.sql`a.id`)}
    )
    SELECT (SELECT count(*) FROM acts)::int AS activities,
           (SELECT count(*) FROM adv)::int AS advisors,
           (SELECT count(*) FROM induccion.progreso_actividad p
             WHERE p.status = 'PASSED' AND p.activity_id IN (SELECT id FROM acts) AND p.user_id IN (SELECT id FROM adv))::int AS passed`;
  return row!;
}

// Por módulo: participantes (al menos un intento) y cuántos de ellos aprobaron el módulo.
export function approvalByModule(filters: MetricsFilters) {
  return prisma.$queryRaw<{ moduleId: string; slug: string; name: string; order: number; participants: number; passed: number }[]>`
    WITH ${advisorsCte(filters)},
    part AS (
      SELECT a.module_id, i.user_id, bool_or(pm.status = 'PASSED') AS passed
      FROM induccion.intentos i
      JOIN induccion.evaluaciones e ON e.id = i.evaluation_id
      JOIN induccion.actividades a ON a.id = e.activity_id
      LEFT JOIN induccion.progreso_modulo pm ON pm.user_id = i.user_id AND pm.module_id = a.module_id
      WHERE i.user_id IN (SELECT id FROM adv) ${range(Prisma.sql`i.started_at`, filters)} ${scope(filters, Prisma.sql`a.module_id`, Prisma.sql`a.id`)}
      GROUP BY a.module_id, i.user_id
    )
    SELECT m.id::text AS "moduleId", m.slug, m.name, m."order",
           count(part.user_id)::int AS participants,
           count(part.user_id) FILTER (WHERE part.passed)::int AS passed
    FROM induccion.modulos_formacion m
    LEFT JOIN part ON part.module_id = m.id
    WHERE m.status IN ('ACTIVE', 'INACTIVE') ${filters.moduleId ? Prisma.sql`AND m.id = ${filters.moduleId}::uuid` : empty}
    GROUP BY m.id ORDER BY m."order"`;
}

export function distribution(filters: MetricsFilters) {
  return prisma.$queryRaw<{ moduleId: string; status: string; advisors: number }[]>`
    WITH ${advisorsCte(filters)}
    SELECT pm.module_id::text AS "moduleId", pm.status::text AS status, count(*)::int AS advisors
    FROM induccion.progreso_modulo pm
    WHERE pm.user_id IN (SELECT id FROM adv) ${filters.moduleId ? Prisma.sql`AND pm.module_id = ${filters.moduleId}::uuid` : empty}
    GROUP BY pm.module_id, pm.status`;
}

export async function attemptsAndScores(filters: MetricsFilters) {
  const [row] = await prisma.$queryRaw<{ attempts: number; participants: number; avgScore: string | null }[]>`
    WITH ${advisorsCte(filters)}
    SELECT count(*)::int AS attempts, count(DISTINCT i.user_id)::int AS participants, round(avg(i.score), 2)::text AS "avgScore"
    FROM induccion.intentos i
    JOIN induccion.evaluaciones e ON e.id = i.evaluation_id
    JOIN induccion.actividades a ON a.id = e.activity_id
    WHERE i.status::text IN ${SUBMITTED} AND i.user_id IN (SELECT id FROM adv)
      ${range(Prisma.sql`i.submitted_at`, filters)} ${scope(filters, Prisma.sql`a.module_id`, Prisma.sql`a.id`)}`;
  return row!;
}

// Promedio y mediana del tiempo empleado por actividad.
export function timeByActivity(filters: MetricsFilters) {
  return prisma.$queryRaw<{ activityId: string; title: string; moduleId: string; attempts: number; avgSeconds: string | null; medianSeconds: string | null }[]>`
    WITH ${advisorsCte(filters)}
    SELECT a.id::text AS "activityId", a.title, a.module_id::text AS "moduleId", count(i.duration_seconds)::int AS attempts,
           round(avg(i.duration_seconds), 2)::text AS "avgSeconds",
           round(percentile_cont(0.5) WITHIN GROUP (ORDER BY i.duration_seconds)::numeric, 2)::text AS "medianSeconds"
    FROM induccion.intentos i
    JOIN induccion.evaluaciones e ON e.id = i.evaluation_id
    JOIN induccion.actividades a ON a.id = e.activity_id
    WHERE i.status::text IN ${SUBMITTED} AND i.duration_seconds IS NOT NULL AND i.user_id IN (SELECT id FROM adv)
      ${range(Prisma.sql`i.submitted_at`, filters)} ${scope(filters, Prisma.sql`a.module_id`, Prisma.sql`a.id`)}
    GROUP BY a.id ORDER BY a.module_id, a."order"`;
}

export function timeByModule(filters: MetricsFilters) {
  return prisma.$queryRaw<{ moduleId: string; attempts: number; avgSeconds: string | null; medianSeconds: string | null }[]>`
    WITH ${advisorsCte(filters)}
    SELECT a.module_id::text AS "moduleId", count(i.duration_seconds)::int AS attempts,
           round(avg(i.duration_seconds), 2)::text AS "avgSeconds",
           round(percentile_cont(0.5) WITHIN GROUP (ORDER BY i.duration_seconds)::numeric, 2)::text AS "medianSeconds"
    FROM induccion.intentos i
    JOIN induccion.evaluaciones e ON e.id = i.evaluation_id
    JOIN induccion.actividades a ON a.id = e.activity_id
    WHERE i.status::text IN ${SUBMITTED} AND i.duration_seconds IS NOT NULL AND i.user_id IN (SELECT id FROM adv)
      ${range(Prisma.sql`i.submitted_at`, filters)} ${scope(filters, Prisma.sql`a.module_id`, Prisma.sql`a.id`)}
    GROUP BY a.module_id`;
}

// Asesores activos cuyo último avance es anterior a `days` días (sin avance alguno no cuentan como detenidos).
export async function stalledAdvisors(days: number, now: Date, limit: number, cursor: { at: Date; id: string } | null) {
  const threshold = new Date(now.getTime() - days * 24 * 60 * 60_000);
  const base = Prisma.sql`
    SELECT u.id::text AS id, u.nombre_completo AS "nombreCompleto", u.numero_documento AS "numeroDocumento", max(pm.last_activity_at) AS "lastActivityAt"
    FROM induccion.usuarios u JOIN induccion.progreso_modulo pm ON pm.user_id = u.id
    WHERE u.rol = 'asesor' AND u.estado = 'activo'
    GROUP BY u.id
    HAVING max(pm.last_activity_at) IS NOT NULL AND max(pm.last_activity_at) < ${threshold}`;
  const [count] = await prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM (${base}) s`;
  const items = await prisma.$queryRaw<{ id: string; nombreCompleto: string; numeroDocumento: string; lastActivityAt: Date }[]>`
    SELECT * FROM (${base}) s
    ${cursor ? Prisma.sql`WHERE (s."lastActivityAt", s.id) < (${cursor.at}, ${cursor.id})` : empty}
    ORDER BY s."lastActivityAt" DESC, s.id DESC LIMIT ${limit + 1}`;
  return { count: count?.n ?? 0, threshold, items };
}

// Mecanografía interna del módulo de Ofimática: solo intentos completados (los vencidos y abandonados
// cuentan como intentos fallidos en la tasa de aprobación general, no en las métricas de escritura).
export async function typingStats(filters: MetricsFilters) {
  const [row] = await prisma.$queryRaw<{ results: number; advisors: number; avgPpm: string | null; avgCorrectCpm: string | null; avgAccuracy: string | null; avgErrors: string | null; passed: number }[]>`
    WITH ${advisorsCte(filters)}
    SELECT count(*)::int AS results, count(DISTINCT i.user_id)::int AS advisors,
           round(avg(t.ppm), 2)::text AS "avgPpm", round(avg(t.correct_cpm), 2)::text AS "avgCorrectCpm",
           round(avg(t.accuracy), 2)::text AS "avgAccuracy", round(avg(t.error_count), 2)::text AS "avgErrors",
           count(*) FILTER (WHERE t.passed)::int AS passed
    FROM induccion.resultados_mecanografia_interna t
    JOIN induccion.intentos i ON i.id = t.attempt_id
    WHERE t.close_reason = 'COMPLETED' AND i.user_id IN (SELECT id FROM adv) ${range(Prisma.sql`t.completed_at`, filters)}`;
  return row!;
}

export async function dictationStats(filters: MetricsFilters) {
  const [row] = await prisma.$queryRaw<{ results: number; advisors: number; avgScore: string | null; avgWordMatch: string | null; passed: number }[]>`
    WITH ${advisorsCte(filters)}
    SELECT count(*)::int AS results, count(DISTINCT i.user_id)::int AS advisors,
           round(avg(r.score), 2)::text AS "avgScore", round(avg(r.word_match_percent), 2)::text AS "avgWordMatch",
           count(*) FILTER (WHERE r.passed)::int AS passed
    FROM induccion.resultados_dictado r
    JOIN induccion.intentos i ON i.id = r.attempt_id
    WHERE r.completed_at IS NOT NULL AND i.user_id IN (SELECT id FROM adv) ${range(Prisma.sql`r.completed_at`, filters)}`;
  return row!;
}

// Errores más frecuentes del dictado, por categoría y regla.
export function dictationErrors(filters: MetricsFilters) {
  return prisma.$queryRaw<{ category: string; rule: string; total: number }[]>`
    WITH ${advisorsCte(filters)}
    SELECT coalesce(e.item->>'category', e.item->>'type') AS category, coalesce(e.item->>'ruleKey', '(sin regla)') AS rule, count(*)::int AS total
    FROM induccion.resultados_dictado r
    JOIN induccion.intentos i ON i.id = r.attempt_id
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(r.detected_errors::jsonb, '[]'::jsonb)) AS e(item)
    WHERE r.completed_at IS NOT NULL AND i.user_id IN (SELECT id FROM adv) ${range(Prisma.sql`r.completed_at`, filters)}
    GROUP BY 1, 2 ORDER BY 3 DESC, 1, 2 LIMIT 20`;
}

export async function excelStats(filters: MetricsFilters) {
  const [row] = await prisma.$queryRaw<{ results: number; advisors: number; avgScore: string | null; passed: number }[]>`
    WITH ${advisorsCte(filters)}
    SELECT count(*)::int AS results, count(DISTINCT i.user_id)::int AS advisors, round(avg(x.score), 2)::text AS "avgScore",
           count(*) FILTER (WHERE x.passed)::int AS passed
    FROM induccion.resultados_excel x
    JOIN induccion.intentos i ON i.id = x.attempt_id
    WHERE x.completed_at IS NOT NULL AND i.user_id IN (SELECT id FROM adv) ${range(Prisma.sql`x.completed_at`, filters)}`;
  return row!;
}

// Tasa de acierto de la práctica de Excel por paso.
export function excelSteps(filters: MetricsFilters) {
  return prisma.$queryRaw<{ questionId: string; lesson: string; attempts: number; correct: number }[]>`
    WITH ${advisorsCte(filters)}
    SELECT s.item->>'questionId' AS "questionId", s.item->>'lesson' AS lesson, count(*)::int AS attempts,
           count(*) FILTER (WHERE (s.item->>'correct')::boolean)::int AS correct
    FROM induccion.resultados_excel x
    JOIN induccion.intentos i ON i.id = x.attempt_id
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(x.step_results::jsonb, '[]'::jsonb)) AS s(item)
    WHERE x.completed_at IS NOT NULL AND i.user_id IN (SELECT id FROM adv) ${range(Prisma.sql`x.completed_at`, filters)}
    GROUP BY 1, 2 ORDER BY 1`;
}

export function reactivationsBy(dimension: 'action' | 'reason' | 'activity' | 'admin', filters: MetricsFilters) {
  const group = {
    action: Prisma.sql`o.action::text`,
    reason: Prisma.sql`o.reason`,
    activity: Prisma.sql`a.title`,
    admin: Prisma.sql`u.nombre_completo`,
  }[dimension];
  return prisma.$queryRaw<{ key: string; total: number }[]>`
    SELECT ${group} AS key, count(*)::int AS total
    FROM induccion.excepciones_actividad o
    JOIN induccion.actividades a ON a.id = o.activity_id
    JOIN induccion.usuarios u ON u.id = o.created_by_id
    WHERE true ${range(Prisma.sql`o.created_at`, filters)} ${scope(filters, Prisma.sql`a.module_id`, Prisma.sql`a.id`)}
    GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 20`;
}

// Resultado posterior: primer intento enviado después de la excepción en la misma actividad.
export async function reactivationOutcomes(filters: MetricsFilters) {
  const [row] = await prisma.$queryRaw<{ total: number; followed: number; passed: number }[]>`
    SELECT count(*)::int AS total,
           count(nxt.status)::int AS followed,
           count(*) FILTER (WHERE nxt.status = 'PASSED')::int AS passed
    FROM induccion.excepciones_actividad o
    JOIN induccion.actividades a ON a.id = o.activity_id
    LEFT JOIN LATERAL (
      SELECT i.status FROM induccion.intentos i JOIN induccion.evaluaciones e ON e.id = i.evaluation_id
      WHERE i.user_id = o.user_id AND e.activity_id = o.activity_id AND i.started_at >= o.created_at AND i.status::text IN ${SUBMITTED}
      ORDER BY i.started_at LIMIT 1
    ) nxt ON true
    WHERE true ${range(Prisma.sql`o.created_at`, filters)} ${scope(filters, Prisma.sql`a.module_id`, Prisma.sql`a.id`)}`;
  return row!;
}

// Ubicación actual: primer módulo activo no aprobado de cada asesor y su actividad en curso.
export function currentLocation(filters: MetricsFilters, limit: number, afterId: string | null) {
  return prisma.$queryRaw<{
    userId: string; nombreCompleto: string; numeroDocumento: string; estado: string;
    moduleName: string | null; moduleStatus: string | null; activityTitle: string | null; lastActivityAt: Date | null;
  }[]>`
    SELECT u.id::text AS "userId", u.nombre_completo AS "nombreCompleto", u.numero_documento AS "numeroDocumento", u.estado,
           cur.name AS "moduleName", cur.status AS "moduleStatus", act.title AS "activityTitle", cur.last_activity_at AS "lastActivityAt"
    FROM induccion.usuarios u
    LEFT JOIN LATERAL (
      SELECT m.id, m.name, pm.status::text AS status, pm.last_activity_at
      FROM induccion.progreso_modulo pm JOIN induccion.modulos_formacion m ON m.id = pm.module_id
      WHERE pm.user_id = u.id AND pm.status <> 'PASSED' AND m.status = 'ACTIVE' AND m.slug <> 'certificado'
      ORDER BY m."order" LIMIT 1
    ) cur ON true
    LEFT JOIN LATERAL (
      SELECT a.title FROM induccion.progreso_actividad pa JOIN induccion.actividades a ON a.id = pa.activity_id
      WHERE pa.user_id = u.id AND a.module_id = cur.id AND pa.status <> 'PASSED'
      ORDER BY pa.last_activity_at DESC NULLS LAST, a."order" LIMIT 1
    ) act ON true
    WHERE u.rol = 'asesor' ${filters.advisorStatus ? Prisma.sql`AND u.estado = ${filters.advisorStatus}` : empty}
      ${filters.moduleId ? Prisma.sql`AND cur.id = ${filters.moduleId}::uuid` : empty}
      ${afterId ? Prisma.sql`AND u.id > ${afterId}::uuid` : empty}
    ORDER BY u.id LIMIT ${limit + 1}`;
}

export function attemptsByActivity(filters: MetricsFilters) {
  return prisma.$queryRaw<{ activityId: string; title: string; attempts: number; participants: number; passed: number; avgScore: string | null }[]>`
    WITH ${advisorsCte(filters)}
    SELECT a.id::text AS "activityId", a.title,
           count(i.id)::int AS attempts, count(DISTINCT i.user_id)::int AS participants,
           count(i.id) FILTER (WHERE i.status = 'PASSED')::int AS passed,
           round(avg(i.score), 2)::text AS "avgScore"
    FROM induccion.actividades a
    LEFT JOIN induccion.evaluaciones e ON e.activity_id = a.id
    LEFT JOIN induccion.intentos i ON i.evaluation_id = e.id AND i.status::text IN ${SUBMITTED}
      AND i.user_id IN (SELECT id FROM adv) ${range(Prisma.sql`i.submitted_at`, filters)}
    WHERE a.module_id = ${filters.moduleId!}::uuid
    GROUP BY a.id ORDER BY a."order"`;
}
