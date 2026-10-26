import { randomInt } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { ConflictError, NotFoundError } from '../domain/errors.js';
import { applyPracticeAction, EXCEL_PASS_SCORE, EXCEL_PRACTICE_VERSION, EXERCISES, isPractice, newPractice, practiceScore, practiceSteps, upgradePractice, type AnyPracticeState } from '../domain/excel-practice.js';
import { EXCEL_LESSONS, OFFICE_IMAGES } from '../domain/office-content.js';
import { officeActivities } from '../repositories/office.repository.js';
import { startAttemptTx, submitAttemptTx } from './attempt.service.js';
import type { ExcelActionBody, ExcelSubmitBody } from '../validators/office.validator.js';

const TITLE = 'Excel para cobranzas · práctica interactiva';
type Snapshot = Record<string, unknown> & { practice?: AnyPracticeState };
const snapshotOf = (value: unknown): Snapshot => value && typeof value === 'object' ? value as Snapshot : {};
// Un intento cerrado conserva su forma original (upgrade = false); uno abierto se convierte a la versión actual.
const stateOf = (value: unknown, upgrade = true): AnyPracticeState => { const state = snapshotOf(value).practice; return isPractice(state) ? upgrade ? upgradePractice(state) : state : newPractice(); };
const json = (value: unknown) => value as Prisma.InputJsonValue;
async function activityOf(db: Prisma.TransactionClient = prisma) {
  const activity = (await officeActivities(db))?.bySection.excel;
  if (!activity || activity.status !== 'ACTIVE') throw new ConflictError('La práctica de Excel no está disponible.', 'EXCEL_UNAVAILABLE');
  return activity;
}
const view = (attemptId: string, number: number, state: AnyPracticeState, status = 'IN_PROGRESS') => ({ attemptId, number, title: TITLE, state, exercises: EXERCISES, status, minScore: EXCEL_PASS_SCORE });

export async function getActivity(userId: string) {
  const activity = await activityOf();
  const [open, latest, scenario] = await Promise.all([
    prisma.attempt.findFirst({ where: { userId, status: 'IN_PROGRESS', evaluation: { activityId: activity.id } }, orderBy: { startedAt: 'desc' }, include: { excelResult: true } }),
    prisma.attempt.findFirst({ where: { userId, status: { in: ['PASSED', 'FAILED'] }, evaluation: { activityId: activity.id } }, orderBy: { submittedAt: 'desc' }, include: { excelResult: true } }),
    prisma.excelActivity.findFirst({ where: { status: 'ACTIVE' }, orderBy: [{ key: 'asc' }, { version: 'desc' }] }),
  ]);
  if (!scenario) throw new ConflictError('Todavía no hay escenarios de Excel disponibles.', 'NO_EXCEL_SCENARIOS');
  const current = open ?? latest;
  const practice = current?.excelResult && isPractice(snapshotOf(current.excelResult.configSnapshot).practice)
    ? view(current.id, current.number, stateOf(current.excelResult.configSnapshot, current.status === 'IN_PROGRESS'), current.status)
    : open ? view(open.id, open.number, newPractice()) : null;
  return { id: open?.excelResult?.excelActivityId ?? scenario.id, title: TITLE, attemptId: open?.id ?? null,
    lessons: EXCEL_LESSONS.map(lesson => ({ ...lesson, image: OFFICE_IMAGES[lesson.image] ?? null })),
    minScore: EXCEL_PASS_SCORE, maxAttempts: 1, practice };
}

export async function startPractice(userId: string, excelId: string, now = new Date()) {
  return prisma.$transaction(async tx => {
    const activity = await activityOf(tx);
    const scenario = await tx.excelActivity.findUnique({ where: { id: excelId } });
    const { attempt, resumed } = await startAttemptTx(tx, userId, activity.id, { now });
    const result = await tx.excelAttemptResult.findUnique({ where: { attemptId: attempt.id } });
    if (!result && (!scenario || scenario.status !== 'ACTIVE')) throw new NotFoundError('El escenario no está disponible.', 'EXCEL_SCENARIO_NOT_FOUND');
    if (result && result.excelActivityId !== excelId) throw new NotFoundError('El escenario no corresponde a este intento.', 'ATTEMPT_NOT_FOUND');
    const state = stateOf(result?.configSnapshot);
    if (result) {
      // Un intento abierto de la evaluación anterior se convierte sin borrar su historial cerrado.
      if (snapshotOf(result.configSnapshot).practice?.version !== EXCEL_PRACTICE_VERSION) await tx.excelAttemptResult.update({ where: { attemptId: attempt.id }, data: { configSnapshot: json({ ...snapshotOf(result.configSnapshot), excelMinScore: EXCEL_PASS_SCORE, practice: state }), stepResults: json(practiceSteps(state)) } });
    } else {
      await tx.excelAttemptResult.create({ data: { attemptId: attempt.id, excelActivityId: scenario!.id, excelVersion: scenario!.version, seed: randomInt(1, 2147483647), configSnapshot: json({ excelMinScore: EXCEL_PASS_SCORE, practice: state }), stepResults: json(practiceSteps(state)) } });
    }
    return { ...view(attempt.id, attempt.number, state), resumed };
  });
}

export async function performAction(userId: string, excelId: string, input: ExcelActionBody, now = new Date()) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM induccion.intentos WHERE id = ${input.attemptId}::uuid FOR UPDATE`;
    const attempt = await tx.attempt.findUnique({ where: { id: input.attemptId }, include: { excelResult: true } });
    if (!attempt || attempt.userId !== userId || attempt.excelResult?.excelActivityId !== excelId) throw new NotFoundError('Intento no encontrado.', 'ATTEMPT_NOT_FOUND');
    if (attempt.status !== 'IN_PROGRESS') throw new ConflictError('La práctica ya fue finalizada.', 'ATTEMPT_CLOSED');
    const state = stateOf(attempt.excelResult.configSnapshot);
    if (state.revision !== input.revision) throw new ConflictError('El avance cambió en otra pestaña. Recarga para recuperar la versión guardada.', 'PRACTICE_STALE');
    const next = applyPracticeAction(state, input.action, now);
    await tx.excelAttemptResult.update({ where: { attemptId: attempt.id }, data: { configSnapshot: json({ ...snapshotOf(attempt.excelResult.configSnapshot), practice: next }), stepResults: json(practiceSteps(next)) } });
    return view(attempt.id, attempt.number, next);
  });
}

export async function submitPractice(userId: string, excelId: string, input: ExcelSubmitBody, now = new Date()) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM induccion.intentos WHERE id = ${input.attemptId}::uuid FOR UPDATE`;
    const attempt = await tx.attempt.findUnique({ where: { id: input.attemptId }, include: { excelResult: true } });
    if (!attempt || attempt.userId !== userId || attempt.excelResult?.excelActivityId !== excelId) throw new NotFoundError('Intento no encontrado.', 'ATTEMPT_NOT_FOUND');
    if (attempt.status !== 'IN_PROGRESS') throw new ConflictError('La práctica ya fue finalizada.', 'ATTEMPT_CLOSED');
    const state = upgradePractice(stateOf(attempt.excelResult.configSnapshot));
    if (state.revision !== input.revision) throw new ConflictError('Recarga para recuperar el avance actualizado.', 'PRACTICE_STALE');
    if (!state.visited.every(Boolean)) throw new ConflictError('Recorre los cinco ejercicios antes de finalizar.', 'PRACTICE_INCOMPLETE');
    if (state.dirty) throw new ConflictError('Tienes cambios sin guardar. Guárdalos con Ctrl+G o reinicia este ejercicio antes de finalizar.', 'UNSAVED_CHANGES');
    const score = practiceScore(state); const passed = score >= EXCEL_PASS_SCORE; const steps = practiceSteps(state);
    await tx.excelAttemptResult.update({ where: { attemptId: attempt.id }, data: { score, passed, stepResults: json(steps), completedAt: now } });
    await submitAttemptTx(tx, userId, attempt.id, { score, passed, now, answers: steps.map(step => ({ questionId: step.questionId, isCorrect: step.correct, awardedScore: step.awardedScore })) });
    return { ...view(attempt.id, attempt.number, state, passed ? 'PASSED' : 'FAILED'), score, passed, steps };
  });
}
