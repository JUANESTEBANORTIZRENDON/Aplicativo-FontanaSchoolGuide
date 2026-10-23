import { describe, expect, it } from 'vitest';
import { referenceSlot, referenceRange, closeSumFormula } from './excel-formula-input';

describe('selección de referencias al escribir fórmulas', () => {
  it('inserta después de un operador y reemplaza la última referencia señalada', () => {
    expect(referenceSlot('=SUMA(', 6)).toEqual({ start: 6, end: 6 });
    expect(referenceSlot('=C2-', 4)).toEqual({ start: 4, end: 4 });
    expect(referenceSlot('=C2', 3, 3, { start: 1, end: 3, text: '=C2' })).toEqual({ start: 1, end: 3 });
    expect(referenceSlot('=C2', 3)).toBeNull();
    expect(referenceSlot('Camila', 6)).toBeNull();
  });
  it('forma rangos en ambos sentidos sin invertir la referencia', () => {
    expect(referenceRange({ r: 1, c: 2 }, { r: 3, c: 2 })).toBe('C2:C4');
    expect(referenceRange({ r: 3, c: 2 }, { r: 1, c: 2 })).toBe('C2:C4');
    expect(referenceRange({ r: 2, c: 2 }, { r: 2, c: 2 })).toBe('C3');
  });
  it('cierra solo una suma de rango pendiente al confirmar', () => {
    expect(closeSumFormula('=SUMA(C2:C4')).toBe('=SUMA(C2:C4)');
    expect(closeSumFormula('=SUMA(C2:C4)')).toBe('=SUMA(C2:C4)');
    expect(closeSumFormula('=C2-C3')).toBe('=C2-C3');
    expect(closeSumFormula('=SUMA(')).toBe('=SUMA(');
  });
});
