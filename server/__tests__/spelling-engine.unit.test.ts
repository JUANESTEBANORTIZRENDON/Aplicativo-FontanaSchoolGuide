import { describe, expect, it } from 'vitest';
import { evaluateDictation, prioritize, type SpellingRuleInput } from '../domain/spelling/engine.js';
import { templateRecommendation } from '../domain/spelling/recommendations.js';
import { SPELLING_RULES } from '../../prisma/seed-office-content.js';

const RULES: SpellingRuleInput[] = SPELLING_RULES.map((rule) => ({
  key: rule.key, category: rule.category, severity: rule.severity, weight: rule.weight, pairs: rule.pairs, explanation: rule.explanation,
}));
const evaluate = (expected: string, typed: string, minScore = 85) => evaluateDictation(expected, typed, RULES, { minScore });

describe('sistema experto de ortografía', () => {
  it('texto idéntico: 100 puntos y aprobado', () => {
    const result = evaluate('El cliente confirmó el pago, y quedó para el lunes.', 'El cliente confirmó el pago, y quedó para el lunes.');
    expect(result).toMatchObject({ score: 100, passed: true, criticalCount: 0, wordMatchPercent: 100 });
    expect(result.errors).toEqual([]);
  });

  it('falta una tilde: error TILDE de 3 puntos, sin quitar la tilde antes de clasificar', () => {
    const result = evaluate('Quedó pendiente la confirmación del pago.', 'Quedo pendiente la confirmación del pago.');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ type: 'TILDE', expected: 'Quedó', written: 'Quedo', weight: 3, severity: 'MINOR' });
    expect(result.score).toBe(97);
    expect(result.passed).toBe(true);
  });

  it('«a ver» por «haber»: error crítico por la regla del catálogo', () => {
    const result = evaluate('Debe haber un error en el saldo.', 'Debe a ver un error en el saldo.');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ ruleKey: 'homofona-a-ver-haber', severity: 'CRITICAL', weight: 15, expected: 'haber', written: 'a ver' });
    expect(result.criticalCount).toBe(1);
    expect(result.score).toBe(85);
    // 85 puntos alcanzan el mínimo, pero un error crítico impide aprobar.
    expect(result.passed).toBe(false);
  });

  it('«hay» por «ahí»: error crítico', () => {
    const result = evaluate('Ahí está el soporte del pago.', 'Hay está el soporte del pago.');
    expect(result.errors[0]).toMatchObject({ ruleKey: 'homofona-hay-ahi-ay', severity: 'CRITICAL' });
    expect(result.passed).toBe(false);
  });

  it('«sino» frente a «si no» (varias palabras)', () => {
    const result = evaluate('No pagó el lunes sino el martes.', 'No pagó el lunes si no el martes.');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ ruleKey: 'homofona-sino-si-no', severity: 'CRITICAL', expected: 'sino', written: 'si no' });
    const reverse = evaluate('Si no paga hoy, se reporta.', 'Sino paga hoy, se reporta.');
    expect(reverse.errors[0]).toMatchObject({ ruleKey: 'homofona-sino-si-no', severity: 'CRITICAL' });
  });

  it('coma omitida: error de puntuación de 2 puntos', () => {
    const result = evaluate('Buenas tardes, le habla un asesor.', 'Buenas tardes le habla un asesor.');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ type: 'PUNTUACION', expected: ',', weight: 2 });
    expect(result.score).toBe(98);
  });

  it('mayúscula inicial omitida: 1 punto', () => {
    const result = evaluate('El cliente confirmó el pago.', 'el cliente confirmó el pago.');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ type: 'MAYUSCULA', expected: 'El', written: 'el', weight: 1 });
    expect(result.score).toBe(99);
  });

  it('palabra omitida: 8 puntos', () => {
    const result = evaluate('Se acordó el pago para el viernes.', 'Se acordó pago para el viernes.');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ type: 'OMISION', expected: 'el', weight: 8 });
    expect(result.score).toBe(92);
  });

  it('palabra extra: 8 puntos', () => {
    const result = evaluate('Se acordó el pago para el viernes.', 'Se acordó el pago para el próximo viernes.');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ type: 'INSERCION', written: 'próximo', weight: 8 });
  });

  it('sustitución de una palabra: 8 puntos', () => {
    const result = evaluate('El cliente pagó el martes.', 'El cliente pagó el jueves.');
    expect(result.errors[0]).toMatchObject({ type: 'SUSTITUCION', expected: 'martes', written: 'jueves', weight: 8 });
  });

  it('tilde diacrítica con regla propia: explica la diferencia', () => {
    const result = evaluate('Tú debes registrar la observación.', 'Tu debes registrar la observación.');
    expect(result.errors[0]).toMatchObject({ type: 'TILDE', ruleKey: 'tilde-tu', severity: 'MINOR' });
    expect(result.errors[0]!.explanation).toMatch(/pronombre/);
  });

  it('formas verbales frecuentes al hablar son críticas', () => {
    const result = evaluate('Es posible que haya un error.', 'Es posible que haiga un error.');
    expect(result.errors[0]).toMatchObject({ ruleKey: 'verbal-haya', severity: 'CRITICAL' });
  });

  it('el puntaje nunca baja de 0 aunque lo escrito no se parezca al texto', () => {
    const result = evaluate('Debe haber un error porque ya pagó, sino hoy.', 'a ver por que si no');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.passed).toBe(false);
  });

  it('prioriza las críticas sobre el resto', () => {
    const result = evaluate('Debe haber un error porque ya pagó, sino hoy.', 'Debe a ver un error por que ya pago, si no hoy.');
    const ordered = prioritize(result.errors);
    expect(result.criticalCount).toBeGreaterThanOrEqual(2);
    expect(ordered[0]!.severity).toBe('CRITICAL');
    expect(ordered.at(-1)!.weight).toBeLessThanOrEqual(ordered[0]!.weight);
  });

  it('es determinístico', () => {
    const a = evaluate('Debe haber un error porque ya pagó.', 'Debe a ver un error por que ya pago.');
    const b = evaluate('Debe haber un error porque ya pagó.', 'Debe a ver un error por que ya pago.');
    expect(a).toEqual(b);
  });

  it('la plantilla de recomendación respeta los límites', () => {
    const result = evaluate('Debe haber un error porque ya pagó, sino hoy.', 'Debe a ver un error por que ya pago, si no hoy.');
    const recommendation = templateRecommendation(result, 85);
    expect(recommendation.recomendaciones.length).toBeLessThanOrEqual(3);
    for (const item of recommendation.recomendaciones) expect(item.length).toBeLessThanOrEqual(180);
    expect(recommendation.proximoPaso).toMatch(/Repasa/);
  });
});
