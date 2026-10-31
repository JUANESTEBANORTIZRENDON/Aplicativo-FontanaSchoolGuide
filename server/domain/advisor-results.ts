import type { ObjectionsGrade } from './objections-expert.js';
import type { gradeExam } from './collections-exam.js';
import type { AttemptResult } from '../services/evaluation-result.service.js';
import type { RetryReport } from '../services/retry-report.service.js';
import { practiceScore } from './excel-practice.js';
import type { getActivity, submitPractice } from '../services/office-excel.service.js';
import type { submitDictation } from '../services/office-dictation.service.js';

// Contratos del asesor después de entregar: se conserva el diagnóstico
// pedagógico, pero nunca se devuelve la respuesta escrita ni la evidencia
// textual original. El registro completo se conserva únicamente en el servidor
// para el área administrativa.
export function advisorObjectionsResult(result: ObjectionsGrade) {
  return { version: result.version, score: result.score, passed: result.passed, minimumScore: result.minimumScore,
    recommendations: ['Repasa las lecciones y las pautas generales de atención antes de volver a practicar.'],
    cases: result.cases.map(c => ({ key: c.key, title: c.title, score: c.score, maximum: c.maximum,
      checks: c.checks.map(({ id, label, ok, points, feedback }) => ({ id, label, ok, points, feedback })),
      critical: c.critical, recommendations: c.recommendations })) };
}
export type AdvisorObjectionsResult = ReturnType<typeof advisorObjectionsResult>;

export function advisorDiagnosticResult(result: ReturnType<typeof gradeExam>) {
  return { version: result.version, passed: result.passed, verdict: result.verdict, score: result.score, maxScore: result.maxScore, minScore: result.minScore,
    sections: result.sections.map(s => ({ key: s.key, title: s.title, score: s.score, maxScore: s.maxScore })),
    strengths: [] as string[], improvements: ['Repasa las lecciones de los temas con menor puntaje.'] };
}
export type AdvisorDiagnosticResult = ReturnType<typeof advisorDiagnosticResult>;

export function advisorAttemptResult(result: AttemptResult) {
  return { attemptId: result.attemptId, number: result.number, status: result.status, score: result.score, passed: result.passed,
    startedAt: result.startedAt, submittedAt: result.submittedAt, reactivated: result.reactivated,
    ...(result.finalExam ? { finalExam: { score: result.finalExam.score, correct: result.finalExam.correct, total: result.finalExam.total,
      minimumScore: result.finalExam.minimumScore, passed: result.finalExam.passed, topics: result.finalExam.topics,
      recommendations: ['Repasa las lecciones de los temas con menor puntaje.'] } } : {}),
    ...(result.objections ? { objections: advisorObjectionsResult(result.objections) } : {}),
    ...(result.typification ? { typification: { metCount: result.typification.metCount, unmetCount: result.typification.unmetCount } } : {}) };
}

export function advisorRetryReport(report: RetryReport) {
  return { version: report.version, name: report.name, document: report.document, issuedAt: report.issuedAt,
    activityId: report.activityId, attemptId: report.attemptId, attemptNumber: report.attemptNumber, activityTitle: report.activityTitle,
    scores: report.scores, attempts: report.attempts.map(advisorAttemptResult),
    recommendations: ['Repasa las lecciones y las instrucciones de la evaluación antes de volver a intentarlo.'] };
}

export function advisorObjectionsState<T extends { exam: { result: ObjectionsGrade | null } }>(state: T) {
  return { ...state, exam: { ...state.exam, result: state.exam.result ? advisorObjectionsResult(state.exam.result) : null } };
}
export function advisorCollectionsState<T extends { exam: { lastResult: ReturnType<typeof gradeExam> | null } }>(state: T) {
  return { ...state, exam: { ...state.exam, lastResult: state.exam.lastResult ? advisorDiagnosticResult(state.exam.lastResult) : null } };
}
export function advisorFinalExamState<T extends { result: AttemptResult | null }>(state: T) {
  return { ...state, result: state.result ? advisorAttemptResult(state.result) : null };
}
export function advisorTipificaState<T extends { exercises: { result: AttemptResult | null }[] }>(state: T) {
  return { ...state, exercises: state.exercises.map(e => ({ ...e, result: e.result ? advisorAttemptResult(e.result) : null })) };
}

export function advisorExcelResult(result: Awaited<ReturnType<typeof submitPractice>>) {
  return { attemptId: result.attemptId, number: result.number, title: result.title, status: result.status, minScore: result.minScore,
    score: result.score, passed: result.passed };
}
export function advisorExcelActivity(info: Awaited<ReturnType<typeof getActivity>>) {
  const closed = info.practice && info.practice.status !== 'IN_PROGRESS' ? info.practice : null;
  return { ...info, practice: closed ? null : info.practice, result: closed ? advisorExcelResult({ ...closed,
    score: practiceScore(closed.state), passed: closed.status === 'PASSED', steps: [] }) : null };
}
export function advisorDictationResult(result: Awaited<ReturnType<typeof submitDictation>>) {
  return { attemptNumber: result.attemptNumber, score: result.score, passed: result.passed, minScore: result.minScore,
    criticalCount: result.criticalCount, wordMatchPercent: result.wordMatchPercent, attemptsRemaining: result.attemptsRemaining,
    recommendation: { resumen: 'Tu evaluación quedó registrada.', fortalezas: [] as string[],
      recomendaciones: ['Repasa las lecciones de ortografía y practica con textos distintos.'], proximoPaso: 'Continúa con tu recorrido de formación.' } };
}
