import type { PracticeAction } from '../domain/excel-practice.js';
export const PRACTICE_ACTIONS: PracticeAction[][] = [
  [{ type: 'filter', value: 'Pendiente' }],
  [{ type: 'undo', method: 'shortcut' }],
  [{ type: 'sort', direction: 'asc' }],
  [{ type: 'sort', direction: 'desc' }],
  [{ type: 'copy', cell: { row: 'c1', column: 'cliente' }, method: 'shortcut' }],
  [{ type: 'paste', cell: { row: 'c2', column: 'observacion' }, method: 'shortcut' }],
  [{ type: 'open-search', method: 'shortcut' }, { type: 'search', query: 'Laura Méndez' }],
  [{ type: 'save', method: 'shortcut' }],
];
