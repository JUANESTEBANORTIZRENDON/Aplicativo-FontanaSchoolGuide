import type { Db } from '../config/prisma.js';
import { gradeFinalExam, isLetter, type OptionLetter } from '../domain/final-exam.js';
import { exerciseRules } from '../domain/tipifica/exercises.js';

// Resultado legible de un intento oficial para el asesor y el administrador. El puntaje y el veredicto salen de lo
// que guardó el servidor al calificar; nada se recalcula con datos del navegador.

export type TypificationCheck = { id: string; ok: boolean; detail: string; label?: string; goal?: string };

export type AttemptResult = {
  attemptId: string;
  number: number;
  status: string;
  score: string | null;
  passed: boolean;
  startedAt: string;
  submittedAt: string | null;
  reactivated: boolean;
  typification?: { exerciseKey: string | null; exerciseNumber: number | null; metCount: number; unmetCount: number; checks: TypificationCheck[]; fields: Record<string, unknown> | null; scenarioVersion: number | null; rulesVersion: number | null };
  finalExam?: ReturnType<typeof gradeFinalExam>;
};

// Las reglas guardan solo { id, ok, detail }: el texto del checkmark se toma de la versión de reglas vigente.
function labelChecks(exerciseKey: string | null, checks: TypificationCheck[]): TypificationCheck[] {
  const number = exerciseKey ? Number(exerciseKey.replace('ejercicio-', '')) : NaN;
  const rules = exerciseRules(number)?.rules ?? [];
  return checks.map((check) => {
    const rule = rules.find((item) => item.id === check.id);
    return { ...check, label: rule?.label ?? check.id, goal: rule?.goal ?? rule?.label ?? check.id };
  });
}

export async function attemptResults(db: Db, attemptIds: string[], minimumScores = new Map<string, number>()): Promise<Map<string, AttemptResult>> {
  if (!attemptIds.length) return new Map();
  const attempts = await db.attempt.findMany({
    where: { id: { in: attemptIds } },
    include: {
      typificationResults: { orderBy: { createdAt: 'desc' }, take: 1 },
      answers: { orderBy: { position: 'asc' }, select: { questionId: true, optionId: true, position: true } },
      evaluation: { select: { minimumScore: true, questionCount: true, activity: { select: { type: true } } } },
    },
  });
  return new Map(attempts.map((attempt) => {
    const typification = attempt.typificationResults[0];
    const base: AttemptResult = {
      attemptId: attempt.id, number: attempt.number, status: attempt.status, score: attempt.score?.toFixed(2) ?? null,
      passed: attempt.status === 'PASSED', startedAt: attempt.startedAt.toISOString(), submittedAt: attempt.submittedAt?.toISOString() ?? null,
      reactivated: Boolean(attempt.overrideId),
    };
    if (typification) {
      const number = typification.exerciseKey ? Number(typification.exerciseKey.replace('ejercicio-', '')) : null;
      base.typification = {
        exerciseKey: typification.exerciseKey, exerciseNumber: number, metCount: typification.metCount ?? 0, unmetCount: typification.unmetCount ?? 0,
        checks: labelChecks(typification.exerciseKey, (typification.checks ?? []) as TypificationCheck[]),
        fields: (typification.fields ?? null) as Record<string, unknown> | null,
        scenarioVersion: typification.scenarioVersion, rulesVersion: typification.rulesVersion,
      };
    }
    // Examen general: preguntas con posición. Solo se califica un intento enviado.
    if (attempt.evaluation.questionCount && attempt.submittedAt && attempt.answers.length) {
      const answers: Record<string, OptionLetter | null> = Object.fromEntries(attempt.answers.map((row) => [row.questionId, isLetter(row.optionId) ? row.optionId : null]));
      base.finalExam = gradeFinalExam(attempt.answers.map((row) => row.questionId), answers, minimumScores.get(attempt.id) ?? Number(attempt.evaluation.minimumScore));
    }
    return [attempt.id, base];
  }));
}
