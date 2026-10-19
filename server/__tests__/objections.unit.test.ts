import { describe, expect, it } from 'vitest';
import { OBJECTIONS_BLOCKS, OBJECTIONS_BLOCK_PERCENT, OBJECTIONS_KEYS, OBJECTIONS_NAME, OBJECTIONS_SLUG } from '../domain/objections.js';
import * as domain from '../domain/objections.js';

describe('módulo 03 «Enfréntate a la objeción»', () => {
  it('conserva el slug técnico y cambia solo el nombre visible', () => {
    expect(OBJECTIONS_SLUG).toBe('simulador-cobranzas');
    expect(OBJECTIONS_NAME).toBe('Enfréntate a la objeción');
    expect(OBJECTIONS_BLOCKS.map((block) => block.key)).toEqual([...OBJECTIONS_KEYS]);
    expect(OBJECTIONS_BLOCKS).toHaveLength(4);
  });

  it('es solo formativo: cuatro bloques de 25 % y ninguna evaluación', () => {
    expect(OBJECTIONS_BLOCK_PERCENT * OBJECTIONS_KEYS.length).toBe(100);
    expect(Object.keys(domain).filter((name) => /exam|grade|quiz/i.test(name))).toEqual([]);
  });
});
