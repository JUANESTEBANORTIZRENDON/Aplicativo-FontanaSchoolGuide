import { describe, expect, it } from 'vitest';
import { computeTypingMetrics, isSuspicious, officialDuration, typingPassed, typingScore } from '../domain/typing.js';

const TARGET = 'Buenas tardes, le escribimos para confirmar su acuerdo de pago. Gracias por su atención y por su tiempo.';

describe('cálculo de mecanografía', () => {
  it('texto idéntico: todo correcto', () => {
    const metrics = computeTypingMetrics(TARGET, TARGET, 60);
    expect(metrics).toMatchObject({ totalCharacters: TARGET.length, correctCharacters: TARGET.length, errorCount: 0, accuracy: 100 });
    expect(metrics.correctCpm).toBe(TARGET.length);
  });

  it('texto vacío: sin división por cero', () => {
    expect(computeTypingMetrics(TARGET, '', 60)).toMatchObject({ totalCharacters: 0, correctCharacters: 0, accuracy: 0, ppm: 0, correctCpm: 0, errorCount: 0 });
  });

  it('tildes omitidas cuentan como sustituciones (no se quitan las tildes)', () => {
    const metrics = computeTypingMetrics('atención y comunicación', 'atencion y comunicacion', 60);
    expect(metrics.substitutions).toBe(2);
    expect(metrics.correctCharacters).toBe('atención y comunicación'.length - 2);
  });

  it('palabra omitida: cuenta omisiones y conserva lo escrito', () => {
    const metrics = computeTypingMetrics('uno dos tres cuatro', 'uno tres cuatro', 60);
    expect(metrics.omissions).toBe(4);
    expect(metrics.insertions).toBe(0);
    expect(metrics.correctCharacters).toBe('uno tres cuatro'.length);
    expect(metrics.accuracy).toBe(100);
  });

  it('inserciones: caracteres de más', () => {
    const metrics = computeTypingMetrics('hola mundo', 'holaaa mundo', 60);
    expect(metrics.insertions).toBe(2);
    expect(metrics.correctCharacters).toBe('hola mundo'.length);
    expect(metrics.accuracy).toBe(83.33);
  });

  it('espacios dobles cuentan como inserciones', () => {
    const metrics = computeTypingMetrics('uno dos', 'uno  dos', 60);
    expect(metrics.insertions).toBe(1);
    expect(metrics.correctCharacters).toBe(7);
  });

  it('compara solo con el prefijo equivalente: no penaliza lo que falta por escribir', () => {
    const metrics = computeTypingMetrics(TARGET, TARGET.slice(0, 40), 60);
    expect(metrics.omissions).toBe(0);
    expect(metrics.accuracy).toBe(100);
  });

  it('149 frente a 150 caracteres correctos por minuto', () => {
    const base = 'a'.repeat(300);
    const thresholds = { minCorrectCpm: 150, minAccuracy: 90 };
    const at150 = computeTypingMetrics(base, 'a'.repeat(150), 60);
    const at149 = computeTypingMetrics(base, 'a'.repeat(149), 60);
    expect(at150.correctCpm).toBe(150);
    expect(typingPassed(at150, thresholds)).toBe(true);
    expect(at149.correctCpm).toBe(149);
    expect(typingPassed(at149, thresholds)).toBe(false);
  });

  it('89,99 % frente a 90 % de precisión', () => {
    const thresholds = { minCorrectCpm: 1, minAccuracy: 90 };
    expect(typingPassed({ correctCpm: 200, accuracy: 89.99 }, thresholds)).toBe(false);
    expect(typingPassed({ correctCpm: 200, accuracy: 90 }, thresholds)).toBe(true);
    // 9 aciertos de 10 = 90 %; 8 de 9 = 88,89 %.
    expect(computeTypingMetrics('abcdefghij', 'abcdefghix', 60).accuracy).toBe(90);
    expect(computeTypingMetrics('abcdefghi', 'abcdefghx'.slice(0, 9), 60).accuracy).toBe(88.89);
  });

  it('usa la duración oficial: 60 caracteres en 30 s son 120 por minuto', () => {
    const metrics = computeTypingMetrics('a'.repeat(100), 'a'.repeat(60), 30);
    expect(metrics.correctCpm).toBe(120);
    expect(metrics.ppm).toBe(24);
  });

  it('nota informativa, duración oficial y sospecha', () => {
    expect(typingScore(75, 150)).toBe(50);
    expect(typingScore(300, 150)).toBe(100);
    expect(officialDuration(60, 75_000)).toBe(60);
    expect(officialDuration(60, 42_500)).toBe(42.5);
    expect(isSuspicious('abc', 'abcd', 10, 1200)).toBe(true);
    expect(isSuspicious('abcdef', 'abc', 1300, 1200)).toBe(true);
    expect(isSuspicious('abcdef', 'abc', 100, 1200)).toBe(false);
  });
});
