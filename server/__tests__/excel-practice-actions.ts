import type { PracticeAction } from '../domain/excel-practice.js';
// Recorrido correcto de los siete ejercicios, como lo haría un asesor en la hoja.
export const PRACTICE_ACTIONS: PracticeAction[][] = [
  [{ type: 'filter', column: 'estado', values: ['Pendiente'] }, { type: 'edit', cell: { row: 'c1', column: 'saldo' }, value: '450000' }, { type: 'undo', method: 'shortcut' }],
  [{ type: 'sort', column: 'saldo', direction: 'asc' }, { type: 'sort', column: 'saldo', direction: 'desc' }],
  [{ type: 'copy', cell: { row: 'c1', column: 'cliente' }, method: 'shortcut' }, { type: 'paste', cell: { row: 'c2', column: 'observacion' }, method: 'shortcut' }],
  [{ type: 'open-search', method: 'shortcut' }, { type: 'search', query: 'Laura Méndez' }],
  [{ type: 'edit', cell: { row: 'total', column: 'saldo' }, value: '=SUMA(C2:C4)' }],
  [{ type: 'edit', cell: { row: 'total', column: 'saldo' }, value: '=C2-C3' }],
  [{ type: 'edit', cell: { row: 'c1', column: 'observacion' }, value: 'Prometió pagar el viernes' }, { type: 'save', method: 'shortcut' }],
];
