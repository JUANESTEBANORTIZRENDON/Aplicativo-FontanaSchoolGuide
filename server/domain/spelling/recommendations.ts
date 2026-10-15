import { prioritize, type DictationEvaluation } from './engine.js';

// Recomendación determinística (plantilla) armada con los mismos errores que calificó el sistema experto.
// Es el respaldo cuando Ollama está desactivado o falla: la nota nunca depende de él.

export type Recommendation = { resumen: string; fortalezas: string[]; recomendaciones: string[]; proximoPaso: string };

export const MAX_RECOMMENDATIONS = 3;
export const MAX_RECOMMENDATION_LENGTH = 180;

const clip = (value: string, max = MAX_RECOMMENDATION_LENGTH): string => (value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`);

export function templateRecommendation(result: DictationEvaluation, minScore: number): Recommendation {
  const ordered = prioritize(result.errors);
  const seen = new Set<string>();
  const recomendaciones: string[] = [];
  for (const error of ordered) {
    if (seen.has(error.explanation)) continue;
    seen.add(error.explanation);
    recomendaciones.push(clip(error.explanation));
    if (recomendaciones.length === MAX_RECOMMENDATIONS) break;
  }
  const fortalezas: string[] = [];
  if (result.errors.length === 0) fortalezas.push('Escribiste el dictado sin ningún error.');
  else {
    if (result.criticalCount === 0) fortalezas.push('No tuviste errores críticos de palabras que suenan igual.');
    if (result.wordMatchPercent >= 85) fortalezas.push(`Acertaste el ${Math.round(result.wordMatchPercent)} % de las palabras.`);
    if (!result.errors.some((error) => error.type === 'TILDE')) fortalezas.push('Cuidaste las tildes.');
    if (!result.errors.some((error) => error.type === 'PUNTUACION')) fortalezas.push('La puntuación fue adecuada.');
  }
  if (fortalezas.length === 0) fortalezas.push('Completaste el dictado completo.');

  const resumen = result.passed
    ? `Aprobaste el dictado con ${result.score.toFixed(2)} puntos.`
    : result.criticalCount > 0
      ? `Obtuviste ${result.score.toFixed(2)} puntos, pero hay errores críticos que debes corregir para aprobar.`
      : `Obtuviste ${result.score.toFixed(2)} puntos y se necesitan ${minScore.toFixed(0)} para aprobar.`;
  const proximoPaso = result.passed
    ? 'Continúa con el resultado del módulo.'
    : 'Repasa las lecciones de ortografía y vuelve a intentarlo.';
  return { resumen: clip(resumen, 240), fortalezas: fortalezas.slice(0, 3).map((item) => clip(item)), recomendaciones, proximoPaso };
}
