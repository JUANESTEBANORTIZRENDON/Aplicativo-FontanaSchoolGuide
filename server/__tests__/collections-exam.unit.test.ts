import { describe, expect, it } from 'vitest';
import { COLLECTIONS_EXAM, EXAM_SECTIONS, gradeExam, publicExam, validateExamSection } from '../domain/collections-exam.js';

const goodAnswers = () => Object.fromEntries(COLLECTIONS_EXAM.map((q) => [q.key, q.kind === 'text' ? q.example : q.options.find((o) => o.correct)!.id]));

describe('examen práctico de siete secciones', () => {
  it('reparte 100 puntos y cubre selección, desplegables y redacción en el orden solicitado', () => {
    expect(EXAM_SECTIONS.map((s) => s.key)).toEqual(['inicio', 'escenario', 'negociacion', 'objeciones', 'cierre', 'seguimiento', 'tipificacion']);
    expect(EXAM_SECTIONS.map((s) => s.points)).toEqual([15, 10, 20, 15, 15, 10, 15]);
    expect(new Set(COLLECTIONS_EXAM.map((q) => q.key)).size).toBe(COLLECTIONS_EXAM.length);
    expect(new Set(COLLECTIONS_EXAM.map((q) => q.kind))).toEqual(new Set(['choice', 'select', 'text']));
    for (const section of EXAM_SECTIONS) {
      expect(section.questions.reduce((sum, q) => sum + q.points, 0)).toBe(section.points);
      for (const q of section.questions) if (q.kind !== 'text') expect(q.options.filter((o) => o.correct)).toHaveLength(1);
    }
  });

  it('no entrega soluciones, rúbricas ni explicaciones durante el intento', () => {
    const content = publicExam();
    for (const section of content.sections) for (const q of section.questions) {
      expect(q).not.toHaveProperty('criteria'); expect(q).not.toHaveProperty('example');
      if (q.kind !== 'text') for (const o of q.options) expect(Object.keys(o).sort()).toEqual(['id', 'text']);
    }
    expect(JSON.stringify(content)).not.toContain('correct');
  });

  it('registra respuestas equivocadas y textos breves sin exigir aciertos para avanzar', () => {
    EXAM_SECTIONS.forEach((section, index) => {
      const answers = Object.fromEntries(section.questions.map((q) => [q.key, q.kind === 'text' ? 'No sé.' : q.options.find((o) => !o.correct)!.id]));
      expect(() => validateExamSection(index, answers)).not.toThrow();
    });
  });

  it('califica los ejemplos completos con 100 y resultado Apto', () => {
    const result = gradeExam(goodAnswers());
    expect(result).toMatchObject({ score: 100, passed: true, verdict: 'Apto', minScore: 80, criticalErrors: [] });
    expect(result.strengths).toHaveLength(7); expect(result.improvements).toEqual([]);
  });

  it('aprueba exactamente desde 80, siempre que no haya errores críticos', () => {
    const at80 = { ...goodAnswers(), 'inicio-accion': 'ordenar', 'escenario-saldo': '480', 'objeciones-accion': 'terminar', 'tipificacion-no-acuerdo': 'voluntad' };
    expect(gradeExam(at80)).toMatchObject({ score: 80, passed: true });
    const at79: Record<string, string> = { ...goodAnswers(), 'inicio-accion': 'ordenar', 'escenario-saldo': '480', 'objeciones-accion': 'terminar', 'tipificacion-no-contesta': 'tercero' };
    at79['inicio-guion'] = at79['inicio-guion']!.replace('Buenos días', 'Camila');
    expect(gradeExam(at79)).toMatchObject({ score: 79, passed: false, verdict: 'Requiere refuerzo' });
  });

  const criticalChoices = COLLECTIONS_EXAM.flatMap((q) => q.kind === 'text' ? [] : q.options.filter((o) => o.critical).map((o) => ({ key: q.key, id: o.id })));
  it.each(criticalChoices)('un error crítico en $key impide aprobar aunque el puntaje alcance', ({ key, id }) => {
    const result = gradeExam({ ...goodAnswers(), [key]: id });
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.passed).toBe(false); expect(result.criticalErrors).toHaveLength(1);
  });

  it('muestra criterios pendientes en textos y no da puntos solo por escribir algo', () => {
    const result = gradeExam({ ...goodAnswers(), 'inicio-guion': 'Hola', 'objeciones-respuesta': 'Pague.', 'cierre-guion': 'De acuerdo.' });
    expect(result.sections[0]!.score).toBe(7);
    expect(result.sections[3]!.score).toBe(6);
    expect(result.sections[4]!.score).toBe(5);
    expect(result.improvements.length).toBeGreaterThan(0);
    expect(result.sections[0]!.results[1]!.criteria.some((c) => !c.met)).toBe(true);
  });

  it.each(['Le apruebo un descuento del 30 %.','Mañana le embargamos sus bienes.', 'Registro pago confirmado.'])('detecta una afirmación crítica en un texto: %s', (text) => {
    const result = gradeExam({ ...goodAnswers(), 'objeciones-respuesta': `${goodAnswers()['objeciones-respuesta']} ${text}` });
    expect(result.passed).toBe(false); expect(result.criticalErrors.length).toBeGreaterThan(0);
  });

  it('no confunde negar una aprobación o un pago con afirmarlos', () => {
    const text = `${goodAnswers()['objeciones-respuesta']} No puedo ofrecer un descuento. No hay pago confirmado; solo voluntad de pago.`;
    expect(gradeExam({ ...goodAnswers(), 'objeciones-respuesta': text }).criticalErrors).toEqual([]);
  });

  it('no interpreta «no se preocupe» como negación de una aprobación posterior', () => {
    const result = gradeExam({ ...goodAnswers(), 'objeciones-respuesta': 'No se preocupe le apruebo un descuento.' });
    expect(result.criticalErrors).toHaveLength(1);
  });

  it('no da por correctas fechas de cierre intercambiadas entre los montos', () => {
    const result = gradeExam({ ...goodAnswers(), 'cierre-guion': 'Confirma un abono de $100.000 el 30/11/2026 y $300.000 el 20/11/2026. Daré seguimiento y verificaré cada pago.' });
    expect(result.sections[4]!.score).toBe(11);
  });

  it('rechaza claves ajenas, faltantes, opciones inventadas y textos vacíos o excesivos', () => {
    const valid = goodAnswers(); const incomplete = { ...valid }; delete incomplete['inicio-guion'];
    for (const answers of [incomplete, { ...valid, extra: 'sí' }, { ...valid, 'inicio-accion': 'inventado' }, { ...valid, 'inicio-guion': ' ' }, { ...valid, 'inicio-guion': 'a'.repeat(1001) }]) expect(() => gradeExam(answers)).toThrow();
    expect(() => validateExamSection(0, {})).toThrow();
    expect(() => validateExamSection(7, {})).toThrow();
  });
});
