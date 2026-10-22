// Cada asesor presenta solo dos de las seis llamadas de la prueba de tipificación. La asignación sale del id del asesor
// (siempre la misma para la misma persona, sin tabla ni estado): recargar, cambiar de equipo o reactivar un ejercicio
// no la cambia, y asesores distintos reciben pares distintos para que no se pasen las respuestas.

import { EXERCISE_RULES } from './exercises.js';

export const TIPIFICA_ASSIGNED_COUNT = 2;

// FNV-1a de 32 bits del id del asesor.
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Números de ejercicio (1 a 6) que le tocan al asesor, de menor a mayor. */
export function assignedExerciseNumbers(userId: string, count = TIPIFICA_ASSIGNED_COUNT): number[] {
  const next = random(hash(userId));
  const pool = EXERCISE_RULES.map((exercise) => exercise.number);
  for (let index = pool.length - 1; index > 0; index--) {
    const other = Math.floor(next() * (index + 1));
    [pool[index], pool[other]] = [pool[other]!, pool[index]!];
  }
  return pool.slice(0, Math.min(count, pool.length)).sort((a, b) => a - b);
}
