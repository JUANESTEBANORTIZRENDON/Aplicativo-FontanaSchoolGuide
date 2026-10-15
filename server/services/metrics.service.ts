import { Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { NotFoundError } from '../domain/errors.js';
import { findModuleById } from '../repositories/catalog.repository.js';
import { prisma } from '../config/prisma.js';
import * as metrics from '../repositories/metrics.repository.js';
import { decodeCursor, encodeCursor } from '../utils/cursor.js';
import { rangeToUtc } from '../utils/time.js';

export type MetricsQuery = { from?: string; to?: string; advisorStatus?: string; moduleId?: string; activityId?: string; days?: number; cursor?: string; limit: number };

// División segura: sin denominador devuelve null y sinDatos.
export function ratio(numerator: number | string | Prisma.Decimal, denominator: number | string | Prisma.Decimal, scale = 100): { value: string | null; sinDatos: boolean } {
  const den = new Prisma.Decimal(denominator);
  if (den.isZero()) return { value: null, sinDatos: true };
  return { value: new Prisma.Decimal(numerator).div(den).mul(scale).toDecimalPlaces(2).toFixed(2), sinDatos: false };
}

function filtersOf(query: MetricsQuery): metrics.MetricsFilters {
  return { ...rangeToUtc(query.from, query.to), advisorStatus: query.advisorStatus, moduleId: query.moduleId, activityId: query.activityId };
}

function average(value: string | null): { value: string | null; sinDatos: boolean } {
  return value === null ? { value: null, sinDatos: true } : { value, sinDatos: false };
}

export async function summary(query: MetricsQuery, now = new Date()) {
  const filters = filtersOf(query);
  const days = query.days ?? env.STALLED_DAYS;
  const [advisors, progress, approval, distribution, attempts, timeModules, timeActivities, stalled, typing, outcome, byAction, byReason, byActivity, byAdmin, location] = await Promise.all([
    metrics.activeAdvisors(),
    metrics.overallProgress(filters),
    metrics.approvalByModule(filters),
    metrics.distribution(filters),
    metrics.attemptsAndScores(filters),
    metrics.timeByModule(filters),
    metrics.timeByActivity(filters),
    metrics.stalledAdvisors(days, now, query.limit, decodeCursor(query.cursor)),
    metrics.typingStats(filters),
    metrics.reactivationOutcomes(filters),
    metrics.reactivationsBy('action', filters),
    metrics.reactivationsBy('reason', filters),
    metrics.reactivationsBy('activity', filters),
    metrics.reactivationsBy('admin', filters),
    metrics.currentLocation(filters, query.limit, null),
  ]);
  const stalledItems = stalled.items.slice(0, query.limit);
  const lastStalled = stalledItems.at(-1);
  return {
    activeAdvisors: advisors,
    overallProgress: { ...ratio(progress.passed, progress.activities * progress.advisors), passed: progress.passed, requiredActivities: progress.activities, advisors: progress.advisors },
    approvalByModule: approval.map((row) => ({ ...row, approval: ratio(row.passed, row.participants) })),
    distribution,
    attempts: { total: attempts.attempts, participants: attempts.participants, averagePerAdvisor: ratio(attempts.attempts, attempts.participants, 1) },
    score: { average: average(attempts.avgScore) },
    time: { byModule: timeModules, byActivity: timeActivities, sinDatos: timeActivities.length === 0 },
    stalled: {
      days, threshold: stalled.threshold.toISOString(), count: stalled.count, items: stalledItems,
      nextCursor: stalled.items.length > query.limit && lastStalled ? encodeCursor(lastStalled.lastActivityAt, lastStalled.id) : null,
    },
    typing: {
      results: typing.results, advisors: typing.advisors, sinDatos: typing.results === 0,
      avgWpm: typing.avgWpm, avgAccuracy: typing.avgAccuracy, avgErrors: typing.avgErrors,
      approvalRate: ratio(typing.passed, typing.linked),
    },
    reactivations: {
      total: outcome.total, byAction, byReason, byActivity, byAdmin,
      followedByAttempt: outcome.followed, nextAttemptPassed: outcome.passed, nextAttemptPassRate: ratio(outcome.passed, outcome.followed),
    },
    location: { items: location.slice(0, query.limit), nextCursor: location.length > query.limit ? location[query.limit - 1]!.userId : null },
  };
}

export async function locationPage(query: MetricsQuery) {
  const rows = await metrics.currentLocation(filtersOf(query), query.limit, query.cursor ?? null);
  return { items: rows.slice(0, query.limit), nextCursor: rows.length > query.limit ? rows[query.limit - 1]!.userId : null };
}

export async function moduleDetail(moduleId: string, query: MetricsQuery) {
  const module = await findModuleById(prisma, moduleId);
  if (!module) throw new NotFoundError('Módulo no encontrado.', 'MODULE_NOT_FOUND');
  const filters = { ...filtersOf(query), moduleId };
  const [approval, distribution, activities, time, progress] = await Promise.all([
    metrics.approvalByModule(filters),
    metrics.distribution(filters),
    metrics.attemptsByActivity(filters),
    metrics.timeByActivity(filters),
    metrics.overallProgress(filters),
  ]);
  const row = approval[0];
  return {
    module: { id: module.id, slug: module.slug, name: module.name, status: module.status },
    approval: row ? { participants: row.participants, passed: row.passed, ...ratio(row.passed, row.participants) } : { participants: 0, passed: 0, value: null, sinDatos: true },
    progress: ratio(progress.passed, progress.activities * progress.advisors),
    distribution,
    activities: activities.map((activity) => ({ ...activity, approval: ratio(activity.passed, activity.attempts), avgScore: average(activity.avgScore) })),
    time,
  };
}
