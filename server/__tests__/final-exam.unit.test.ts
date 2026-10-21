import { describe, expect, it } from 'vitest';
import { evaluationStatusOf } from '../domain/evaluation-status.js';
import { FINAL_EXAM_BANK, FINAL_EXAM_TOPICS } from '../domain/final-exam-bank.js';
import { OPTION_LETTERS, findQuestion, gradeFinalExam, pickQuestions, publicQuestion } from '../domain/final-exam.js';
import { certificationStatusOf } from '../domain/progress.js';

describe('banco del examen general', () => {
  it('cada pregunta tiene cuatro opciones, una respuesta, tema y fuente; ninguna trata cobranza preventiva', () => {
    const ids = new Set<string>();
    for (const question of FINAL_EXAM_BANK) {
      expect(question.options).toHaveLength(4);
      expect(question.answer).toBeGreaterThanOrEqual(0);
      expect(question.answer).toBeLessThanOrEqual(3);
      expect(Object.keys(FINAL_EXAM_TOPICS)).toContain(question.topic);
      expect(question.source.length).toBeGreaterThan(0);
      expect(new Set(question.options).size).toBe(4);
      expect(`${question.prompt} ${question.options.join(' ')}`.toLowerCase()).not.toContain('preventiva');
      ids.add(question.id);
    }
    expect(ids.size).toBe(FINAL_EXAM_BANK.length);
  });

  it('sortea 30 preguntas equilibradas por tema, sin repetir y sin las pendientes de validación', () => {
    const picked = pickQuestions(30, 12345);
    expect(picked).toHaveLength(30);
    expect(new Set(picked).size).toBe(30);
    const perTopic = new Map<string, number>();
    for (const id of picked) {
      const question = findQuestion(id)!;
      expect(question.needsValidation).toBeUndefined();
      perTopic.set(question.topic, (perTopic.get(question.topic) ?? 0) + 1);
    }
    const counts = [...perTopic.values()];
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    // La misma semilla da el mismo examen; otra semilla, otro orden.
    expect(pickQuestions(30, 12345)).toEqual(picked);
    expect(pickQuestions(30, 999)).not.toEqual(picked);
  });

  it('lo que ve el asesor no incluye la respuesta ni la explicación', () => {
    const shown = publicQuestion(FINAL_EXAM_BANK[0]!);
    expect(Object.keys(shown).sort()).toEqual(['id', 'options', 'prompt', 'topic', 'topicLabel']);
    expect(shown.options.map((option) => option.letter)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('califica sobre 100, cuenta vacías como incorrectas y recomienda los temas débiles', () => {
    const ids = pickQuestions(30, 7);
    const all = Object.fromEntries(ids.map((id) => [id, OPTION_LETTERS[findQuestion(id)!.answer]!]));
    expect(gradeFinalExam(ids, all, 80)).toMatchObject({ score: 100, correct: 30, passed: true, review: [] });
    const half = Object.fromEntries(ids.map((id, index) => [id, index % 2 ? all[id]! : null]));
    const graded = gradeFinalExam(ids, half, 80);
    expect(graded.score).toBe(50);
    expect(graded.passed).toBe(false);
    expect(graded.review).toHaveLength(15);
    expect(graded.recommendations.length).toBeGreaterThan(0);
    expect(gradeFinalExam(ids, Object.fromEntries(ids.slice(0, 24).map((id) => [id, all[id]!])), 80)).toMatchObject({ score: 80, passed: true });
  });
});

describe('estados de evaluación y de certificación', () => {
  const base = { passed: false, openAttemptId: null, remaining: 1, nextNumber: 1 };
  it('distingue pendiente, en progreso, no aprobado, solicitada y reactivado', () => {
    expect(evaluationStatusOf({ availability: base, lastAttemptFailed: false, pendingRequest: false })).toBe('PENDIENTE');
    expect(evaluationStatusOf({ availability: { ...base, openAttemptId: 'a', nextNumber: 2 }, lastAttemptFailed: false, pendingRequest: false })).toBe('EN_PROGRESO');
    expect(evaluationStatusOf({ availability: { ...base, remaining: 0, nextNumber: 2 }, lastAttemptFailed: true, pendingRequest: false })).toBe('NO_APROBADO');
    expect(evaluationStatusOf({ availability: { ...base, remaining: 0, nextNumber: 2 }, lastAttemptFailed: true, pendingRequest: true })).toBe('REACTIVACION_SOLICITADA');
    expect(evaluationStatusOf({ availability: { ...base, remaining: 1, nextNumber: 2 }, lastAttemptFailed: true, pendingRequest: false })).toBe('REACTIVADO');
    expect(evaluationStatusOf({ availability: { ...base, remaining: 0 }, lastAttemptFailed: false, pendingRequest: false })).toBe('SIN_INTENTOS');
    expect(evaluationStatusOf({ availability: { ...base, passed: true }, lastAttemptFailed: false, pendingRequest: false })).toBe('APROBADO');
  });

  it('los sellos solo dejan pendiente de validación; la devolución vale hasta un avance nuevo', () => {
    const at = new Date('2026-10-20T10:00:00Z');
    expect(certificationStatusOf({ requirementsMet: true, hasActiveCertificate: false, lastDecision: null, lastProgressAt: at }).status).toBe('PENDIENTE_VALIDACION');
    expect(certificationStatusOf({ requirementsMet: true, hasActiveCertificate: true, lastDecision: null, lastProgressAt: at }).status).toBe('CERTIFICADO');
    const returned = { decision: 'RETURNED' as const, reason: 'Repetir ejercicio 2', createdAt: new Date('2026-10-21T10:00:00Z') };
    expect(certificationStatusOf({ requirementsMet: true, hasActiveCertificate: false, lastDecision: returned, lastProgressAt: at })).toEqual({ status: 'DEVUELTO', reason: 'Repetir ejercicio 2' });
    expect(certificationStatusOf({ requirementsMet: true, hasActiveCertificate: false, lastDecision: returned, lastProgressAt: new Date('2026-10-22T10:00:00Z') }).status).toBe('PENDIENTE_VALIDACION');
    expect(certificationStatusOf({ requirementsMet: false, hasActiveCertificate: false, lastDecision: null, lastProgressAt: null }).status).toBe('EN_FORMACION');
  });
});
