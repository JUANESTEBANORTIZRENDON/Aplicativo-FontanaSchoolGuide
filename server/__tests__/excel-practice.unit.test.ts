import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { applyPracticeAction as act, cellValue, EXERCISES, initialRows, newPractice, parseNumber, practiceScore, practiceSteps, upgradePractice, visibleRows, type AnyPracticeState, type PracticeAction, type PracticeState } from '../domain/excel-practice.js';
import { computeAvailability } from '../domain/progress.js';
import { excelActionBody, excelSubmitBody } from '../validators/office.validator.js';
import { PRACTICE_ACTIONS } from './excel-practice-actions.js';

const play = (s: PracticeState, actions: PracticeAction[]) => actions.reduce((state, action) => act(state, action), s);
function reach(index: number) {
  let s = newPractice();
  for (let i = 0; i < index; i++) s = act(play(s, PRACTICE_ACTIONS[i]!), { type: 'next' });
  return s;
}
const saldos = (s: PracticeState) => s.rows.map(row => Number(row.saldo));
const filterPending: PracticeAction = { type: 'filter', column: 'estado', values: ['Pendiente'] };
const editSaldo = (value: string): PracticeAction => ({ type: 'edit', cell: { row: 'c1', column: 'saldo' }, value });

describe('siete ejercicios de Excel que suman 100 puntos', () => {
  it('define siete ejercicios, reparte 100 puntos exactos y no completa por pulsar Continuar', () => {
    expect(EXERCISES.map(ex => ex.id)).toEqual(['filtrar', 'ordenar', 'copiar', 'buscar', 'sumar', 'restar', 'guardar']);
    const weights = practiceSteps(newPractice()).map(step => step.weight);
    expect(weights).toEqual([14.29, 14.29, 14.29, 14.29, 14.28, 14.28, 14.28]); expect(Math.round(weights.reduce((a, b) => a + b) * 100)).toBe(10000);
    expect(act(newPractice(), { type: 'next' })).toMatchObject({ current: 0, ok: false });
    expect(practiceScore(play(newPractice(), PRACTICE_ACTIONS[0]!))).toBe(14.29);
  });

  it('el recorrido correcto completa los siete ejercicios con 100 puntos', () => {
    let s = newPractice();
    for (let i = 0; i < EXERCISES.length; i++) {
      s = play(s, PRACTICE_ACTIONS[i]!);
      expect(s.completed[i]).toBe(true);
      if (i < EXERCISES.length - 1) s = act(s, { type: 'next' });
    }
    expect(practiceScore(s)).toBe(100);
    expect(s.completed).toEqual(Array(7).fill(true));
  });

  describe('1. filtrar y deshacer', () => {
    it('exige filtrar solo Pendiente, luego editar C2 a 450000 y restaurarlo con Ctrl+Z', () => {
      let s = act(newPractice(), { type: 'filter', column: 'estado', values: ['Pagado'] });
      expect(s).toMatchObject({ stage: 0, ok: false }); expect(s.completed[0]).toBe(false);
      s = act(s, filterPending);
      expect(visibleRows(s).map(row => row.id)).toEqual(['c1', 'c3', 'c6', 'c7', 'c9', 'c11', 'c13']);
      expect(s.stage).toBe(1);
      s = act(s, editSaldo('300000')); expect(s).toMatchObject({ stage: 1, ok: false });
      s = act(s, { type: 'undo', method: 'button' }); expect(s.rows[0]!.saldo).toBe(400000);
      s = act(s, editSaldo('450000')); expect(s.stage).toBe(2); expect(s.rows[0]!.saldo).toBe(450000);
      expect(s.dirty).toBe(true); expect(s.completed[0]).toBe(false);
      s = act(s, { type: 'undo', method: 'shortcut' });
      expect(s.rows[0]!.saldo).toBe(400000); expect(s.completed[0]).toBe(true); expect(s.dirty).toBe(false);
      expect(Object.keys(s.filters)).toEqual(['estado']);
      expect(s.methods).toContainEqual({ exercise: 0, command: 'undo', method: 'shortcut' });
    });
    it('Ctrl+Z sin haber hecho el cambio no completa y deshacer el filtro devuelve al primer paso', () => {
      let s = act(newPractice(), filterPending);
      s = act(s, { type: 'undo', method: 'shortcut' });
      expect(s.completed[0]).toBe(false); expect(s.stage).toBe(0); expect(s.filters).toEqual({});
      s = play(newPractice(), [filterPending, editSaldo('450000')]);
      s = act(s, { type: 'filter', column: 'estado', values: null });
      expect(s).toMatchObject({ stage: 0, ok: false }); expect(s.completed[0]).toBe(false);
    });
    it('rechaza un saldo que no es número y conserva el valor', () => {
      const s = act(act(newPractice(), filterPending), editSaldo('mucho'));
      expect(s.rows[0]!.saldo).toBe(400000); expect(s.ok).toBe(false); expect(s.history).toHaveLength(1);
    });
    it('recorre varios cambios y los deshace en orden inverso', () => {
      let s = play(newPractice(), [editSaldo('1'), editSaldo('2'), editSaldo('3')]);
      for (const expected of [2, 1, 400000]) { s = act(s, { type: 'undo', method: 'button' }); expect(s.rows[0]!.saldo).toBe(expected); }
      expect(act(s, { type: 'undo', method: 'button' })).toMatchObject({ ok: false });
    });
  });

  describe('2. ordenar', () => {
    it('ordena de menor a mayor y luego de mayor a menor moviendo siempre filas completas', () => {
      let s = reach(1);
      expect(act(s, { type: 'sort', column: 'saldo', direction: 'desc' })).toMatchObject({ stage: 0 });
      s = act(s, { type: 'sort', column: 'saldo', direction: 'asc' });
      expect(saldos(s)).toEqual([...saldos(s)].sort((a, b) => a - b)); expect(s.stage).toBe(1); expect(s.completed[1]).toBe(false);
      s = act(s, { type: 'sort', column: 'saldo', direction: 'desc' });
      expect(saldos(s)).toEqual([...saldos(s)].sort((a, b) => b - a)); expect(s.completed[1]).toBe(true);
      expect(s.rows).toHaveLength(14);
      for (const row of s.rows) expect(row).toEqual(initialRows().find(original => original.id === row.id));
    });
    it('ordena numéricamente, no como texto: 90.000 va antes que 1.250.000', () => {
      const s = act(reach(1), { type: 'sort', column: 'saldo', direction: 'asc' });
      expect(saldos(s).slice(0, 3)).toEqual([70000, 90000, 130000]); expect(saldos(s).at(-1)).toBe(1250000);
    });
    it('ordenar otra columna no avanza y Ctrl+Z restaura el orden original', () => {
      let s = act(reach(1), { type: 'sort', column: 'cliente', direction: 'asc' });
      expect(s).toMatchObject({ stage: 0, ok: false });
      s = act(s, { type: 'undo', method: 'shortcut' });
      expect(s.rows.map(row => row.id)).toEqual(initialRows().map(row => row.id)); expect(s.sort).toBeNull();
    });
  });

  describe('3. copiar y pegar', () => {
    it('muestra el origen copiado y valida destino y contenido', () => {
      let s = reach(2);
      s = act(s, { type: 'copy', cell: { row: 'c3', column: 'cliente' }, method: 'button' });
      expect(s).toMatchObject({ stage: 0, ok: false });
      s = act(s, PRACTICE_ACTIONS[2]![0]!);
      expect(s.clipboard).toEqual({ cell: { row: 'c1', column: 'cliente' }, value: 'Camila Rojas' }); expect(s.stage).toBe(1);
      s = act(s, { type: 'paste', cell: { row: 'c4', column: 'observacion' }, method: 'shortcut' });
      expect(s.completed[2]).toBe(false); expect(s.ok).toBe(false);
      s = act(s, { type: 'undo', method: 'shortcut' });
      s = act(s, PRACTICE_ACTIONS[2]![1]!);
      expect(s.rows[1]!.observacion).toBe('Camila Rojas'); expect(s.rows[0]!.cliente).toBe('Camila Rojas'); expect(s.completed[2]).toBe(true);
    });
    it('pegar sin copiar antes no completa y pegar un texto en una columna numérica se rechaza', () => {
      let s = reach(2);
      s = act(s, { type: 'paste', cell: { row: 'c2', column: 'observacion' }, method: 'shortcut' });
      expect(s.ok).toBe(false); expect(s.completed[2]).toBe(false);
      s = act(act(s, PRACTICE_ACTIONS[2]![0]!), { type: 'paste', cell: { row: 'c2', column: 'saldo' }, method: 'shortcut' });
      expect(s.rows[1]!.saldo).toBe(150000); expect(s.ok).toBe(false);
    });
    it('copiar otra celda después de copiar A2 devuelve al paso de copiar', () => {
      let s = act(reach(2), PRACTICE_ACTIONS[2]![0]!);
      s = act(s, { type: 'copy', cell: { row: 'c2', column: 'estado' }, method: 'shortcut' });
      expect(s.stage).toBe(0);
      s = act(s, { type: 'paste', cell: { row: 'c2', column: 'observacion' }, method: 'shortcut' });
      expect(s.completed[2]).toBe(false);
    });
  });

  describe('4. buscar', () => {
    it('abre el buscador y localiza a Laura aunque falte la tilde; rechaza otros clientes', () => {
      let s = reach(3);
      s = act(s, { type: 'search', query: 'Laura Méndez' });
      expect(s.completed[3]).toBe(false); expect(s.ok).toBe(false);
      s = act(s, { type: 'open-search', method: 'button' });
      expect(s.stage).toBe(1);
      s = act(s, { type: 'search', query: 'No existe' }); expect(s.found).toBeNull(); expect(s.ok).toBe(false);
      s = act(s, { type: 'search', query: 'Camila Rojas' }); expect(s.completed[3]).toBe(false); expect(s.found).toEqual({ row: 'c1', column: 'cliente' });
      s = act(s, { type: 'search', query: ' laura mendez ' });
      expect(s.found).toEqual({ row: 'c12', column: 'cliente' }); expect(s.completed[3]).toBe(true);
    });
    it('repetir la misma búsqueda avanza a la siguiente coincidencia y respeta las filas ocultas', () => {
      let s = act(reach(3), { type: 'open-search', method: 'shortcut' });
      s = act(s, { type: 'search', query: 'pagar' }); const first = s.found;
      s = act(s, { type: 'search', query: 'pagar' }); expect(s.found).not.toEqual(first);
      s = play(reach(3), [{ type: 'open-search', method: 'shortcut' }, { type: 'filter', column: 'estado', values: ['Pagado'] }, { type: 'search', query: 'Laura' }]);
      expect(s.found).toBeNull();
    });
  });

  describe('5. guardar', () => {
    it('distingue cambios pendientes de guardados y persiste las filas en savedRows', () => {
      let s = reach(6);
      expect(s.dirty).toBe(false);
      s = act(s, { type: 'save', method: 'shortcut' }); expect(s.completed[6]).toBe(false); expect(s.ok).toBe(false);
      s = act(s, PRACTICE_ACTIONS[6]![0]!);
      expect(s).toMatchObject({ dirty: true, stage: 1 }); expect(s.savedRows![0]!.observacion).toBe(''); // lo guardado aún no incluye la edición pendiente
      s = act(s, { type: 'save', method: 'shortcut' }, new Date('2026-10-22T18:00:00Z'));
      expect(s).toMatchObject({ dirty: false, savedAt: '2026-10-22T18:00:00.000Z', savedExercise: 6 }); expect(s.completed[6]).toBe(true);
      const recovered: PracticeState = JSON.parse(JSON.stringify(s));
      expect(recovered.savedRows![0]!.observacion).toBe('Prometió pagar el viernes');
      expect(practiceScore(recovered)).toBe(100); // reach(6) ya traía los seis ejercicios anteriores
    });
    it('guardar una edición que dejó la observación vacía no completa', () => {
      let s = play(reach(6), [PRACTICE_ACTIONS[6]![0]!, { type: 'edit', cell: { row: 'c1', column: 'observacion' }, value: '' }]);
      expect(s.stage).toBe(0);
      s = act(s, { type: 'save', method: 'button' }); expect(s.completed[6]).toBe(false);
    });
  });

  describe('5 y 6. fórmulas de suma y resta', () => {
    const total = (s: PracticeState) => cellValue(s, 'total', 'saldo');
    const typeTotal = (value: string): PracticeAction => ({ type: 'edit', cell: { row: 'total', column: 'saldo' }, value });
    it('suma tres saldos en un solo paso y rechaza números y rangos incorrectos', () => {
      let s = reach(4);
      expect(s.rows).toHaveLength(3);
      for (const formula of ['1330000', '=C2+C3', '=SUMA(C2:C3)', '=SUMA(C2:C5)']) {
        s = act(s, typeTotal(formula)); expect(s.completed[4]).toBe(false); expect(s.ok).toBe(false);
      }
      s = act(s, typeTotal('=suma(c2:c4)'));
      expect(s.footer.saldo).toBe('=SUMA(C2:C4)'); expect(total(s)).toBe(1330000);
      expect(s.completed[4]).toBe(true); expect(s.rows.map(row => row.saldo)).toEqual([400000, 150000, 780000]);
    });
    it('resta dos saldos en un solo paso sin abonos ni cambios posteriores', () => {
      let s = reach(5);
      expect(s.rows).toHaveLength(3);
      for (const formula of ['250000', '=400000-150000', '=C3-C2', '=C2-C4']) {
        s = act(s, typeTotal(formula)); expect(s.completed[5]).toBe(false); expect(s.ok).toBe(false);
      }
      s = act(s, typeTotal('=C2-C3'));
      expect(total(s)).toBe(250000); expect(s.completed[5]).toBe(true);
      expect(s.rows.map(row => row.saldo)).toEqual([400000, 150000, 780000]);
    });
    it('permite corregir una fórmula inválida y deshacer una referencia con texto', () => {
      let s = act(reach(5), typeTotal('=PROMEDIO(C2:C4)'));
      expect(s.ok).toBe(false); expect(s.footer.saldo).toBe('');
      s = act(s, typeTotal('=A2-C2')); expect(total(s)).toBe('#VALOR!');
      s = act(s, { type: 'undo', method: 'shortcut' }); expect(s.footer.saldo).toBe('');
      s = act(s, typeTotal('=C2-C3')); expect(s.completed[5]).toBe(true);
    });
    it('ordenar por una columna con fórmulas usa el resultado calculado y la fila de total no se mueve', () => {
      const s = play(newPractice(), [{ type: 'edit', cell: { row: 'c14', column: 'pendiente' }, value: '=C15-G15' }, { type: 'edit', cell: { row: 'c1', column: 'pendiente' }, value: '=C2-G2' }, { type: 'sort', column: 'pendiente', direction: 'desc' }]);
      expect(s.rows[0]!.id).toBe('c1'); expect(s.rows.at(-1)!.id).not.toBe('c1'); expect(s.footer.id).toBe('total');
    });
    it('el total se guarda y deshace como cualquier celda (cuenta para cambios pendientes)', () => {
      let s = act(newPractice(), typeTotal('=SUMA(C2:C15)')); expect(s.dirty).toBe(true);
      s = act(s, { type: 'undo', method: 'button' }); expect(s.footer.saldo).toBe(''); expect(s.dirty).toBe(false);
    });
  });

  it('reiniciar repone la hoja del ejercicio y conserva los otros', () => {
    let s = reach(2); s = act(s, { type: 'review' });
    expect(s.current).toBe(2);
    s = act(s, PRACTICE_ACTIONS[2]![0]!); s = act(s, { type: 'reset' });
    expect(s.completed).toEqual([true, true, false, false, false, false, false]); expect(s.clipboard).toBeNull(); expect(s.stage).toBe(0);
    expect(s.rows).toEqual(initialRows());
  });

  it('distingue botones y atajos y conserva 80 como umbral de aprobación', () => {
    let s = play(reach(6), PRACTICE_ACTIONS[6]!.map(action => 'method' in action ? { ...action, method: 'button' as const } : action));
    expect(s.methods.at(-1)).toEqual({ exercise: 6, command: 'save', method: 'button' });
    expect(practiceScore(s)).toBe(100);
    s.completed[0] = false; expect(practiceScore(s)).toBe(85.71); // seis de siete aprueban
    s.completed[1] = false; expect(practiceScore(s)).toBe(71.42); // cinco de siete no
    s = act(s, { type: 'review' }); expect(s.current).toBe(0);
  });

  it('saltar deja el ejercicio sin puntos y permite continuar', () => {
    const s = act(newPractice(), { type: 'skip' });
    expect(s).toMatchObject({ current: 1 }); expect(s.completed[0]).toBe(false); expect(s.visited.slice(0, 2)).toEqual([true, true]);
  });

  it('interpreta números escritos con formato colombiano', () => {
    expect(parseNumber('450000')).toBe(450000); expect(parseNumber('$ 450.000')).toBe(450000); expect(parseNumber('1.250.000,50')).toBe(1250000.5);
    expect(parseNumber('abc')).toBeNull(); expect(parseNumber('')).toBeNull(); expect(parseNumber('-5')).toBeNull();
  });

  describe('intentos de versiones anteriores', () => {
    const legacy = (version: 1 | 2 | 3, completed: boolean[], current = 0): AnyPracticeState => ({ version, revision: 7, current, rows: initialRows().slice(0, 5), completed, visited: completed.map(Boolean), methods: [{ exercise: 1, command: 'undo', method: 'shortcut' }], savedRows: null, savedAt: null });
    it('version 4 conserva borradores y pasos de otros comandos', () => {
      const original = act(reach(1), { type: 'sort', column: 'saldo', direction: 'asc' });
      const old = { ...original, version: 4 as const };
      expect(upgradePractice(old)).toEqual({ ...original, version: 5 });
      expect(practiceScore(old)).toBe(practiceScore(original));
    });
    it('version 4 simplifica la hoja de formulas conservando lo completado', () => {
      const original = reach(4);
      const old = { ...original, version: 4 as const, stage: 1, rows: initialRows(), footer: { ...original.footer, saldo: '=SUMA(C2:C15)' } };
      const s = upgradePractice(old);
      expect(s).toMatchObject({ version: 5, current: 4, stage: 0 });
      expect(s.rows).toHaveLength(3); expect(s.footer.saldo).toBe(''); expect(s.completed).toEqual(original.completed);
      expect(practiceScore(old)).toBe(practiceScore(original));
      expect(old.rows).toHaveLength(14);
    });
    it('versión 2 (ocho ejercicios): conserva solo lo que ya cubría cada ejercicio actual', () => {
      const old = legacy(2, [true, true, true, false, true, true, true, false], 3);
      const upgraded = upgradePractice(old);
      expect(upgraded).toMatchObject({ version: 5, revision: 7, current: 1 });
      expect(upgraded.completed).toEqual([true, false, true, true, false, false, false]);
      expect(upgraded.methods[0]).toEqual({ exercise: 0, command: 'undo', method: 'shortcut' });
      expect(practiceSteps(old)).toHaveLength(8); expect(practiceScore(old)).toBe(75);
      expect(practiceSteps(upgraded)).toHaveLength(7);
    });
    it('versión 1 (cinco ejercicios): coincide uno a uno', () => {
      const old = legacy(1, [true, false, true, false, false], 1);
      expect(upgradePractice(old)).toMatchObject({ version: 5, current: 1, completed: [true, false, true, false, false, false, false] });
      expect(practiceScore(old)).toBe(40);
    });
    it('versión 3 (cinco ejercicios con 20 puntos): guarda y observación pasan al último lugar', () => {
      const old = legacy(3, [true, true, false, true, true], 4);
      const upgraded = upgradePractice(old);
      expect(upgraded).toMatchObject({ version: 5, current: 6, completed: [true, true, false, true, false, false, true] });
      expect(practiceScore(old)).toBe(80); expect(practiceSteps(old)).toHaveLength(5);
    });
    it('una acción sobre un intento antiguo lo convierte y conserva la revisión', () => {
      const s = act(legacy(2, Array(8).fill(false)), { type: 'filter', column: 'estado', values: ['Pendiente'] });
      expect(s).toMatchObject({ version: 5, revision: 8, stage: 1 });
    });
  });

  it('rechaza notas falsificadas y acciones mal formadas; mantiene los límites de otras actividades', () => {
    const attemptId = '88567ef7-ed5b-44d0-9f4f-b956731d876b';
    expect(excelSubmitBody.safeParse({ attemptId, revision: 1, score: 100 }).success).toBe(false);
    expect(excelActionBody.safeParse({ attemptId, revision: 0, action: { type: 'save', method: 'shortcut', completed: true } }).success).toBe(false);
    expect(excelActionBody.safeParse({ attemptId, revision: 0, action: { type: 'filter', column: 'estado', values: ['Pendiente'] } }).success).toBe(true);
    expect(excelActionBody.safeParse({ attemptId, revision: 0, action: { type: 'filter', column: 'otra', values: null } }).success).toBe(false);
    expect(excelActionBody.safeParse({ attemptId, revision: 0, action: { type: 'edit', cell: { row: 'c15', column: 'saldo' }, value: '1' } }).success).toBe(false);
    expect(excelActionBody.safeParse({ attemptId, revision: 0, action: { type: 'sort', column: 'saldo', direction: 'asc' } }).success).toBe(true);
    const evaluation = { id: 'e', maxAttempts: 3, waitMinutes: 30, minimumScore: new Prisma.Decimal(80) }; const now = new Date();
    const attempts = [1, 2, 3].map(n => ({ id: String(n), number: n, status: 'FAILED' as const, overrideId: null, submittedAt: now, startedAt: now }));
    expect(computeAvailability(evaluation, attempts, [], now)).toMatchObject({ exhausted: true, canStart: false });
    expect(computeAvailability(evaluation, attempts, [], now, true)).toMatchObject({ exhausted: false, canStart: true, waitUntil: null });
  });
});
