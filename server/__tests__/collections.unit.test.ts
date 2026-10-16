import { describe, expect, it } from 'vitest';
import { COLLECTIONS_BLOCKS, COLLECTIONS_EXAM, COLLECTIONS_KEYS, EXAM_MIN_CORRECT, gradeCollections, gradeExam, mergeCollectionsAnswers, publicBlock, publicExam, reviewCollections } from '../domain/collections.js';

describe('inducción para asesores nuevos', () => {
  it('incluye los cinco bloques, objetivos y validaciones internas', () => {
    expect(COLLECTIONS_BLOCKS.map((block) => block.key)).toEqual([...COLLECTIONS_KEYS]);
    for (const block of COLLECTIONS_BLOCKS) {
      expect(block.objective.length).toBeGreaterThan(30);
      expect(block.validation.some((item) => item.includes('Validación interna'))).toBe(true);
      for (const question of block.questions) {
        expect(question.options.filter((option) => option.correct)).toHaveLength(1);
        expect(question.options.every((option) => option.feedback.length > 30)).toBe(true);
      }
    }
  });

  it('no envía las respuestas ni la corrección antes de enviar la actividad', () => {
    for (const block of COLLECTIONS_BLOCKS) {
      const content = publicBlock(block);
      expect(content).not.toHaveProperty('expected');
      for (const question of content.questions) for (const option of question.options) {
        expect(Object.keys(option).sort()).toEqual(['id', 'text']);
      }
    }
  });

  it('distingue el compromiso de pago y permite corregir la respuesta', () => {
    const block = COLLECTIONS_BLOCKS[0]!;
    const answers = { cartera: 'cartera', saldo: 'saldo', vencimiento: 'vencimiento', mora: 'mora', abono: 'abono', compromiso: 'compromiso', pago: 'pago', promesa: 'confirmado' };
    const failed = gradeCollections(block, answers);
    expect(failed.passed).toBe(false);
    expect(failed.correctCount).toBe(7);
    expect(failed.results.at(-1)?.feedback).toContain('promesa');
    expect(failed.results.at(-1)?.options).toHaveLength(3);
    expect(gradeCollections(block, { ...answers, promesa: 'compromiso' }).passed).toBe(true);
  });

  it('rechaza respuestas incompletas, inventadas o con claves adicionales', () => {
    const block = COLLECTIONS_BLOCKS[3]!;
    const valid = { opcion: 'autorizada', limite: 'consultar', confirmacion: 'pendiente' };
    expect(gradeCollections(block, valid).passed).toBe(true);
    expect(() => gradeCollections(block, {})).toThrow();
    expect(() => gradeCollections(block, { ...valid, opcion: 'inexistente' })).toThrow();
    expect(() => gradeCollections(block, { ...valid, passed: 'true' })).toThrow();
    expect(gradeCollections(block, { ...valid, limite: 'aprobar' }).passed).toBe(false);
  });

  it('corrige una pregunta sin aprobar un bloque incompleto ni revelar las pendientes', () => {
    const result = reviewCollections(COLLECTIONS_BLOCKS[0]!, { cartera: 'cartera', saldo: 'abono' });
    expect(result).toMatchObject({ passed: false, correctCount: 1, correctKeys: ['cartera'], total: 8, expected: null });
    expect(result.results.map((question) => question.key)).toEqual(['cartera', 'saldo']);
    expect(result.results[1]!.correct).toBe(false);
  });

  it('conserva los aciertos aunque después se envíe una respuesta incorrecta', () => {
    const block = COLLECTIONS_BLOCKS[0]!;
    const answers = mergeCollectionsAnswers(block, { cartera: 'cartera', saldo: 'abono' }, { cartera: 'saldo', saldo: 'saldo' });
    expect(answers).toEqual({ cartera: 'cartera', saldo: 'saldo' });
    expect(reviewCollections(block, answers).correctCount).toBe(2);
    expect(() => mergeCollectionsAnswers(block, answers, { inventada: 'cartera' })).toThrow();
    expect(() => mergeCollectionsAnswers(block, answers, { cartera: 'inexistente' })).toThrow();
  });

  it('ignora distractores antiguos retirados y conserva el resto del progreso', () => {
    const answers = mergeCollectionsAnswers(COLLECTIONS_BLOCKS[0]!, { cartera: 'abono', saldo: 'saldo' }, { abono: 'abono' });
    expect(answers).toEqual({ saldo: 'saldo', abono: 'abono' });
  });
});

describe('examen final del módulo 02', () => {
  const answers = (wrong: number) => Object.fromEntries(COLLECTIONS_EXAM.map((q, index) => [q.key, q.options.find((o) => o.correct === (index >= wrong))!.id]));

  it('cubre los cinco bloques con una sola respuesta correcta por pregunta', () => {
    expect(COLLECTIONS_EXAM).toHaveLength(10);
    expect(new Set(COLLECTIONS_EXAM.map((q) => q.block))).toEqual(new Set(COLLECTIONS_KEYS));
    expect(new Set(COLLECTIONS_EXAM.map((q) => q.key)).size).toBe(COLLECTIONS_EXAM.length);
    for (const question of COLLECTIONS_EXAM) expect(question.options.filter((option) => option.correct)).toHaveLength(1);
  });

  it('no envía las respuestas correctas antes de calificar', () => {
    for (const question of publicExam().questions) for (const option of question.options) expect(Object.keys(option).sort()).toEqual(['id', 'text']);
  });

  it('aprueba con 8 de 10 y muestra la respuesta correcta de cada error', () => {
    expect(gradeExam(answers(2))).toMatchObject({ passed: true, correctCount: 8 });
    const failed = gradeExam(answers(3));
    expect(failed).toMatchObject({ passed: false, correctCount: 7, minCorrect: EXAM_MIN_CORRECT });
    const first = failed.results[0]!;
    expect(first.correct).toBe(false);
    expect(first.correctOption).toBe(COLLECTIONS_EXAM[0]!.options.find((o) => o.correct)!.id);
  });

  it('rechaza exámenes incompletos o con opciones inventadas', () => {
    const complete = answers(0);
    const { reporte: _omitted, ...incomplete } = complete;
    expect(() => gradeExam(incomplete)).toThrow();
    expect(() => gradeExam({ ...complete, reporte: 'inventada' })).toThrow();
    expect(() => gradeExam({ ...complete, extra: 'reportado' })).toThrow();
  });
});
