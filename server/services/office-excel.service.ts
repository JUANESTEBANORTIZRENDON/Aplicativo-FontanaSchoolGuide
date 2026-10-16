import { randomInt } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { ConflictError, NotFoundError } from '../domain/errors.js';
import { gradeQuiz, publicQuiz, type QuizAnswer } from '../domain/excel-quiz.js';
import { EXCEL_LESSONS, OFFICE_IMAGES } from '../domain/office-content.js';
import type { OfficeConfigSnapshot } from '../domain/office.js';
import { activeConfig, officeActivities } from '../repositories/office.repository.js';
import { lockActivityProgress } from '../repositories/progress.repository.js';
import { startAttemptTx, submitAttemptTx } from './attempt.service.js';
import { snapshotOf } from './office-config.service.js';
import { loadSnapshot } from './progress.service.js';

type Tx = Prisma.TransactionClient;


async function excelActivityId(tx: Tx): Promise<string> {
  const activity = (await officeActivities(tx))?.bySection.excel;
  if (!activity || activity.status !== 'ACTIVE') throw new ConflictError('La práctica de Excel no está disponible.', 'EXCEL_UNAVAILABLE');
  return activity.id;
}

// La evaluación es de opción múltiple (domain/excel-quiz). El escenario activo solo se guarda como referencia de
// versión del intento. Se elige el menos usado por el asesor.
async function pickScenario(tx: Tx, userId: string) {
  const rows = await tx.excelActivity.findMany({ where: { status: 'ACTIVE' }, orderBy: [{ key: 'asc' }, { version: 'desc' }] });
  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows) if (!latest.has(row.key)) latest.set(row.key, row);
  const candidates = [...latest.values()];
  if (candidates.length === 0) throw new ConflictError('Todavía no hay escenarios de Excel disponibles.', 'NO_EXCEL_SCENARIOS');
  const used = await tx.excelAttemptResult.findMany({ where: { attempt: { userId } }, select: { excelActivity: { select: { key: true } } }, orderBy: { startedAt: 'asc' } });
  const lastUse = new Map<string, number>();
  used.forEach((row, index) => lastUse.set(row.excelActivity.key, index));
  const unused = candidates.filter((item) => !lastUse.has(item.key));
  if (unused.length) return unused[randomInt(unused.length)]!;
  return [...candidates].sort((a, b) => lastUse.get(a.key)! - lastUse.get(b.key)!)[0]!;
}

const QUIZ_TITLE = 'Evaluación de Excel';
// Preguntas del intento (orden según su semilla), sin respuestas.
const viewOf = (seed: number) => ({ questions: publicQuiz(seed) });

const lessonsView = () => EXCEL_LESSONS.map((lesson) => ({ ...lesson, image: OFFICE_IMAGES[lesson.image] ?? null }));

// GET: escenario activo. Si el asesor ya tiene un intento abierto, vuelve el mismo (misma semilla).
export async function getActivity(userId: string) {
  const activityId = await excelActivityId(prisma);
  const open = await prisma.excelAttemptResult.findFirst({
    where: { attempt: { userId, status: 'IN_PROGRESS', evaluation: { activityId } } },
    include: { excelActivity: true },
  });
  const config = await activeConfig();
  const base = { lessons: lessonsView(), minScore: config.excelMinScore, maxAttempts: config.excelMaxAttempts };
  if (open) {
    return { ...base, id: open.excelActivity.id, title: QUIZ_TITLE, attemptId: open.attemptId, ...viewOf(open.seed) };
  }
  const scenario = await pickScenario(prisma, userId);
  return { ...base, id: scenario.id, title: QUIZ_TITLE, attemptId: null };
}

// POST attempts: crea (o reanuda) el intento y entrega el escenario sin respuestas.
export async function startPractice(userId: string, excelId: string, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const activityId = await excelActivityId(tx);
    await tx.userActivityProgress.upsert({ where: { userId_activityId: { userId, activityId } }, create: { userId, activityId, status: 'AVAILABLE' }, update: {} });
    await lockActivityProgress(tx, userId, activityId);
    const chosen = await tx.excelActivity.findUnique({ where: { id: excelId } });
    if (!chosen || chosen.status !== 'ACTIVE') throw new NotFoundError('El escenario no está disponible.', 'EXCEL_SCENARIO_NOT_FOUND');
    const { attempt, resumed } = await startAttemptTx(tx, userId, activityId, { now });
    if (resumed) {
      const existing = await tx.excelAttemptResult.findUnique({ where: { attemptId: attempt.id }, include: { excelActivity: true } });
      if (existing) return { attemptId: attempt.id, number: attempt.number, resumed: true, title: QUIZ_TITLE, ...viewOf(existing.seed) };
    }
    const snapshot = snapshotOf(await activeConfig(tx));
    const seed = randomInt(1, 2_147_483_647);
    await tx.excelAttemptResult.create({
      data: { attemptId: attempt.id, excelActivityId: chosen.id, excelVersion: chosen.version, seed, configSnapshot: snapshot as unknown as Prisma.InputJsonValue },
    });
    return { attemptId: attempt.id, number: attempt.number, resumed: false, title: QUIZ_TITLE, ...viewOf(seed) };
  }, { timeout: 30_000 });
}

export async function submitPractice(userId: string, excelId: string, input: { attemptId: string; answers: QuizAnswer[] }, now = new Date()) {
  const outcome = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM induccion.intentos WHERE id = ${input.attemptId}::uuid FOR UPDATE`;
    const attempt = await tx.attempt.findUnique({
      where: { id: input.attemptId }, include: { excelResult: { include: { excelActivity: true } } },
    });
    if (!attempt || attempt.userId !== userId || !attempt.excelResult || attempt.excelResult.excelActivityId !== excelId) {
      throw new NotFoundError('Intento no encontrado.', 'ATTEMPT_NOT_FOUND');
    }
    if (attempt.status !== 'IN_PROGRESS') throw new ConflictError('La práctica ya fue enviada.', 'ATTEMPT_CLOSED');
    const result = attempt.excelResult;
    const snapshot = result.configSnapshot as unknown as OfficeConfigSnapshot;
    const graded = gradeQuiz(input.answers, snapshot.excelMinScore);
    await tx.excelAttemptResult.update({
      where: { attemptId: attempt.id },
      data: { score: new Prisma.Decimal(graded.score), passed: graded.passed, stepResults: graded.results as unknown as Prisma.InputJsonValue, completedAt: now },
    });
    await submitAttemptTx(tx, userId, attempt.id, {
      score: graded.score, passed: graded.passed, now,
      answers: graded.results.map((step) => ({
        questionId: step.questionId, optionId: step.chosen,
        isCorrect: step.correct, awardedScore: step.awardedScore,
      })),
    });
    return { graded, number: attempt.number, minScore: snapshot.excelMinScore };
  });
  const snapshot = await loadSnapshot(prisma, userId, now);
  const activityId = (await officeActivities())?.bySection.excel?.id;
  const availability = activityId ? snapshot.availability.get(activityId) : undefined;
  return {
    attemptNumber: outcome.number, score: outcome.graded.score, passed: outcome.graded.passed, minScore: outcome.minScore,
    // Retroalimentación inmediata por pregunta: lo que eligió, la respuesta correcta y la explicación.
    steps: outcome.graded.results.map((step) => ({
      questionId: step.questionId, lesson: step.lesson, correct: step.correct, awardedScore: step.awardedScore, weight: step.weight,
      chosen: step.chosen, correctOption: step.correctOption, feedback: step.hint,
    })),
    attemptsRemaining: availability?.remaining ?? null,
  };
}
