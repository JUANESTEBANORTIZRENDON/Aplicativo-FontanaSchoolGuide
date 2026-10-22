import { describe, expect, it } from 'vitest';
import { TIPIFICA_ASSIGNED_COUNT, assignedExerciseNumbers } from '../domain/tipifica/assignment.js';

describe('asignación de llamadas de Tipifica', () => {
  it('cada asesor recibe 2 de las 6 llamadas, ordenadas y siempre las mismas', () => {
    const id = '5b0e7b9e-2f64-4a43-9c1d-0c9a1f7f1a11';
    const mine = assignedExerciseNumbers(id);
    expect(mine).toHaveLength(TIPIFICA_ASSIGNED_COUNT);
    expect(new Set(mine).size).toBe(2);
    expect(mine.every((n) => n >= 1 && n <= 6)).toBe(true);
    expect([...mine].sort((a, b) => a - b)).toEqual(mine);
    expect(assignedExerciseNumbers(id)).toEqual(mine);
  });

  it('asesores distintos reciben pares distintos y todas las llamadas se reparten', () => {
    const pairs = new Set<string>();
    const used = new Set<number>();
    for (let index = 0; index < 200; index++) {
      const pair = assignedExerciseNumbers(`asesor-${index}`);
      pairs.add(pair.join('-'));
      pair.forEach((n) => used.add(n));
    }
    expect(pairs.size).toBeGreaterThanOrEqual(10);
    expect(used.size).toBe(6);
  });
});
