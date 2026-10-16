// Cálculo puro de la prueba de mecanografía. El servidor es el único que lo ejecuta para efectos de nota.

export type TypingMetrics = {
  totalCharacters: number;
  correctCharacters: number;
  insertions: number;
  omissions: number;
  substitutions: number;
  errorCount: number;
  // Con dos decimales.
  accuracy: number;
  ppm: number;
  // Caracteres correctos por minuto, entero hacia abajo (149,9 no alcanza 150).
  correctCpm: number;
  // Duración oficial usada en el cálculo, en segundos.
  durationSeconds: number;
};

export type TypingThresholds = { minCorrectCpm: number; minAccuracy: number };

export function normalizeText(value: string): string {
  return value.normalize('NFC');
}

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

type Alignment = { matches: number; substitutions: number; insertions: number; omissions: number };

// Distancia de edición entre lo escrito y el prefijo de `target` que mejor lo explica, con retroceso
// para contar cada operación. Se comparan caracteres (code points) sin quitar tildes ni mayúsculas;
// los espacios cuentan.
export function alignWithPrefix(target: string[], typed: string[]): Alignment {
  const n = typed.length;
  const m = target.length;
  if (n === 0) return { matches: 0, substitutions: 0, insertions: 0, omissions: 0 };
  const width = m + 1;
  const table = new Uint16Array((n + 1) * width);
  for (let j = 0; j <= m; j++) table[j] = j;
  for (let i = 1; i <= n; i++) {
    table[i * width] = i;
    for (let j = 1; j <= m; j++) {
      const cost = typed[i - 1] === target[j - 1] ? 0 : 1;
      table[i * width + j] = Math.min(
        table[(i - 1) * width + (j - 1)]! + cost,
        table[(i - 1) * width + j]! + 1, // carácter escrito de más
        table[i * width + (j - 1)]! + 1, // carácter omitido
      );
    }
  }
  // Prefijo del texto objetivo que mejor se parece a lo escrito: menor distancia; a igualdad, el más largo
  // (quien llegó más lejos no sale perjudicado por no haber terminado el texto).
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let j = 0; j <= m; j++) {
    const distance = table[n * width + j]!;
    if (distance < bestDistance || (distance === bestDistance && j > best)) { best = j; bestDistance = distance; }
  }
  let i = n;
  let j = best;
  const result: Alignment = { matches: 0, substitutions: 0, insertions: 0, omissions: 0 };
  while (i > 0 || j > 0) {
    const here = table[i * width + j]!;
    if (i > 0 && j > 0) {
      const same = typed[i - 1] === target[j - 1];
      if (here === table[(i - 1) * width + (j - 1)]! + (same ? 0 : 1)) {
        if (same) result.matches += 1; else result.substitutions += 1;
        i -= 1; j -= 1;
        continue;
      }
    }
    if (i > 0 && here === table[(i - 1) * width + j]! + 1) { result.insertions += 1; i -= 1; continue; }
    result.omissions += 1; j -= 1;
  }
  return result;
}

export function computeTypingMetrics(target: string, typed: string, durationSeconds: number): TypingMetrics {
  const targetChars = [...normalizeText(target)];
  const typedChars = [...normalizeText(typed)];
  const duration = Math.max(1, durationSeconds);
  const alignment = alignWithPrefix(targetChars, typedChars);
  const total = typedChars.length;
  const correct = alignment.matches;
  const perMinute = (correct * 60) / duration;
  return {
    totalCharacters: total,
    correctCharacters: correct,
    insertions: alignment.insertions,
    omissions: alignment.omissions,
    substitutions: alignment.substitutions,
    errorCount: alignment.insertions + alignment.omissions + alignment.substitutions,
    accuracy: total === 0 ? 0 : round2((correct / total) * 100),
    ppm: round2(perMinute / 5),
    correctCpm: Math.floor(perMinute + 1e-9),
    durationSeconds: duration,
  };
}

// Aprueba con los umbrales del snapshot: caracteres correctos por minuto y precisión (ya redondeada).
export function typingPassed(metrics: Pick<TypingMetrics, 'correctCpm' | 'accuracy'>, thresholds: TypingThresholds): boolean {
  return metrics.correctCpm >= thresholds.minCorrectCpm && metrics.accuracy >= thresholds.minAccuracy;
}

// Valor informativo de 0 a 100: avance respecto a la meta de caracteres por minuto.
export function typingScore(correctCpm: number, minCorrectCpm: number): number {
  if (minCorrectCpm <= 0) return 100;
  return round2(Math.min(100, (correctCpm / minCorrectCpm) * 100));
}

// Sospechoso (no se rechaza): lo escrito supera el texto objetivo o la velocidad es irreal.
export function isSuspicious(target: string, typed: string, correctCpm: number, implausibleCpm: number): boolean {
  return [...normalizeText(typed)].length > [...normalizeText(target)].length || correctCpm > implausibleCpm;
}

// Duración oficial: lo transcurrido en el servidor, sin pasar de la duración de la prueba.
export function officialDuration(configuredSeconds: number, elapsedMs: number): number {
  return round2(Math.max(1, Math.min(configuredSeconds, elapsedMs / 1000)));
}
