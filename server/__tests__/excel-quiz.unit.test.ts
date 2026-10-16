import { describe, expect, it } from 'vitest';
import { EXCEL_QUIZ, gradeQuiz, publicQuiz, quizFor } from '../domain/excel-quiz.js';

describe('evaluación de Excel (opción múltiple)', () => {
  it('cada pregunta tiene cuatro opciones a–d, una correcta válida y explicación', () => {
    for (const question of EXCEL_QUIZ) {
      expect(question.options.map((option) => option.id)).toEqual(['a', 'b', 'c', 'd']);
      expect(question.options.some((option) => option.id === question.correct)).toBe(true);
      expect(question.explanation.length).toBeGreaterThan(20);
    }
    expect(new Set(EXCEL_QUIZ.map((question) => question.id)).size).toBe(EXCEL_QUIZ.length);
  });

  it('el navegador no recibe la respuesta ni la explicación, y el orden depende de la semilla', () => {
    const visible = publicQuiz(42);
    expect(JSON.stringify(visible)).not.toMatch(/"correct"|explanation/);
    expect(quizFor(42).map((q) => q.id)).toEqual(quizFor(42).map((q) => q.id));
    expect(new Set(visible.map((q) => q.id))).toEqual(new Set(EXCEL_QUIZ.map((q) => q.id)));
  });

  it('califica sobre 100 y aprueba con el mínimo', () => {
    const all = EXCEL_QUIZ.map((question) => ({ questionId: question.id, optionId: question.correct }));
    expect(gradeQuiz(all, 80)).toMatchObject({ score: 100, passed: true });
    const eight = all.slice(0, 8);
    expect(gradeQuiz(eight, 80)).toMatchObject({ score: 80, passed: true });
    const result = gradeQuiz(all.slice(0, 7), 80);
    expect(result).toMatchObject({ score: 70, passed: false });
    expect(result.results.find((step) => step.questionId === all[9]!.questionId)).toMatchObject({ correct: false, chosen: null });
  });
});
