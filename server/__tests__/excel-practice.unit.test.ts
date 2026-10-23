import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { applyPracticeAction as act, EXERCISES, initialRows, newPractice, practiceScore, practiceSteps, upgradePractice, visibleRows, type PracticeState } from '../domain/excel-practice.js';
import { computeAvailability } from '../domain/progress.js';
import { excelActionBody, excelSubmitBody } from '../validators/office.validator.js';
import { PRACTICE_ACTIONS } from './excel-practice-actions.js';
function reach(index: number) {
  let s = newPractice();
  for (let i = 0; i < index; i++) { for (const action of PRACTICE_ACTIONS[i]!) s = act(s, action); s = act(s, { type: 'next' }); }
  return s;
}
describe('ocho ejercicios individuales de Excel', () => {
  it('define ocho comandos, reparte 100 puntos y no completa por pulsar Continuar', () => {
    expect(EXERCISES.map(ex => ex.id)).toEqual(['filtrar', 'deshacer', 'ascendente', 'descendente', 'copiar', 'pegar', 'buscar', 'guardar']);
    expect(practiceSteps(newPractice()).map(step => step.weight)).toEqual(Array(8).fill(12.5));
    expect(act(newPractice(), { type: 'next' })).toMatchObject({ current: 0, ok: false });
  });
  it('filtrar se completa sin editar saldos ni usar Deshacer', () => {
    let s = act(newPractice(), { type: 'filter', value: 'Pagado' });
    expect(s.completed[0]).toBe(false);
    s = act(s, { type: 'filter', value: 'Pendiente' });
    expect(visibleRows(s).map(row => row.id)).toEqual(['c1', 'c3', 'c4']);
    expect(s.completed).toEqual([true, false, false, false, false, false, false, false]);
    expect(s.rows[0]!.saldo).toBe(400000); expect(s.methods).toHaveLength(0);
  });
  it('Deshacer tiene preparado el error y valida únicamente Ctrl+Z', () => {
    let s = reach(1);
    expect(s.rows[0]!.saldo).toBe(450000); expect(s.filter).toBe('Todos');
    const rejected = act(s, { type: 'filter', value: 'Pendiente' }); expect(rejected.ok).toBe(false);
    s = act(s, { type: 'undo', method: 'shortcut' });
    expect(s.rows).toEqual(initialRows()); expect(s.completed[1]).toBe(true);
    expect(s.methods).toContainEqual({ exercise: 1, command: 'undo', method: 'shortcut' });
  });
  it('cada sentido de ordenación se valida en su propio ejercicio y conserva filas completas', () => {
    let s = reach(2);
    expect(act(s, { type: 'sort', direction: 'desc' }).completed[2]).toBe(false);
    s = act(s, { type: 'sort', direction: 'asc' });
    expect(s.rows.map(row => row.saldo)).toEqual([90000, 150000, 250000, 400000, 600000]);
    expect(s.completed[2]).toBe(true); expect(s.completed[3]).toBe(false);
    s = act(s, { type: 'next' });
    expect(act(s, { type: 'sort', direction: 'asc' }).completed[3]).toBe(false);
    s = act(s, { type: 'sort', direction: 'desc' });
    expect(s.rows.map(row => row.saldo)).toEqual([600000, 400000, 250000, 150000, 90000]);
    expect(s.completed[3]).toBe(true);
    for (const row of s.rows) expect(row).toEqual(initialRows().find(r => r.id === row.id));
  });
  it('copiar valida el origen sin exigir pegar; pegar tiene su portapapeles preparado', () => {
    let s = reach(4);
    expect(act(s, { type: 'copy', cell: { row: 'c3', column: 'cliente' }, method: 'button' }).completed[4]).toBe(false);
    s = act(s, PRACTICE_ACTIONS[4]![0]!); expect(s.completed[4]).toBe(true); expect(s.completed[5]).toBe(false);
    expect(s.rows[1]!.observacion).toBe('');
    s = act(s, { type: 'next' }); expect(s.clipboard?.value).toBe('Camila Rojas');
    expect(act(s, { type: 'paste', cell: { row: 'c1', column: 'observacion' }, method: 'shortcut' }).completed[5]).toBe(false);
    s = act(s, PRACTICE_ACTIONS[5]![0]!);
    expect(s.rows[1]!.observacion).toBe('Camila Rojas'); expect(s.completed[5]).toBe(true);
  });
  it('pegar funciona aunque se haya omitido el ejercicio de copiar', () => {
    let s = reach(4); s = act(s, { type: 'skip' });
    s = act(s, PRACTICE_ACTIONS[5]![0]!);
    expect(s.completed[4]).toBe(false); expect(s.completed[5]).toBe(true);
  });
  it('buscar permite corregir un nombre incorrecto y acepta tildes opcionales', () => {
    let s = reach(6);
    expect(act(s, { type: 'search', query: 'Laura Méndez' }).completed[6]).toBe(false);
    s = act(s, { type: 'open-search', method: 'button' });
    s = act(s, { type: 'search', query: 'No existe' }); expect(s.found).toBeNull();
    s = act(s, { type: 'search', query: 'Camila Rojas' }); expect(s.completed[6]).toBe(false);
    s = act(s, { type: 'search', query: ' laura mendez ' }); expect(s.found).toBe('c3'); expect(s.completed[6]).toBe(true);
  });
  it('Guardar valida solo el comando sobre la observación preparada y recupera el avance', () => {
    let s = reach(7);
    expect(s.rows[0]!.observacion).toBe('Cliente solicita llamada mañana.');
    expect(s.dirty).toBe(true); expect(s.completed[7]).toBe(false);
    s = act(s, { type: 'save', method: 'shortcut' }, new Date('2026-10-22T18:00:00Z'));
    expect(s).toMatchObject({ dirty: false, savedAt: '2026-10-22T18:00:00.000Z' });
    const recovered: PracticeState = JSON.parse(JSON.stringify(s));
    expect(recovered.savedRows![0]!.observacion).toBe('Cliente solicita llamada mañana.');
    expect(practiceScore(recovered)).toBe(100); expect(recovered.completed).toEqual(Array(8).fill(true));
  });
  it('reiniciar repone el escenario del comando y conserva los otros ejercicios', () => {
    let s = reach(2); s = act(s, { type: 'review' });
    s = act(s, { type: 'sort', direction: 'asc' }); s = act(s, { type: 'reset' });
    expect(s.completed.slice(0, 3)).toEqual([true, true, false]);
    let undo = reach(1); undo = act(undo, { type: 'undo', method: 'button' }); undo = act(undo, { type: 'reset' });
    expect(undo.rows[0]!.saldo).toBe(450000); expect(undo.undo?.value).toBe(400000); expect(undo.completed[0]).toBe(true);
  });
  it('distingue botones y atajos y conserva 80 como umbral de aprobación', () => {
    let s = reach(7); s = act(s, { type: 'save', method: 'button' });
    expect(s.methods.at(-1)).toEqual({ exercise: 7, command: 'save', method: 'button' });
    s.completed[0] = false; expect(practiceScore(s)).toBe(87.5);
    s.completed[1] = false; expect(practiceScore(s)).toBe(75);
    s = act(s, { type: 'review' }); expect(s.current).toBe(0);
  });
  it('migra intentos anteriores conservando comandos ya practicados y sus métodos', () => {
    const old: PracticeState = { ...newPractice(), version: 1, current: 1, completed: [true, false, false, false, false], visited: [true, true, false, false, false], flags: ['ascending'], methods: [{ exercise: 0, command: 'undo', method: 'shortcut' }] };
    const upgraded = upgradePractice(old);
    expect(upgraded).toMatchObject({ version: 2, current: 3 });
    expect(upgraded.completed).toEqual([true, true, true, false, false, false, false, false]);
    expect(upgraded.methods[0]).toEqual({ exercise: 1, command: 'undo', method: 'shortcut' });
    expect(practiceSteps(old)).toHaveLength(5); expect(practiceScore(old)).toBe(20);
    expect(practiceSteps(upgraded)).toHaveLength(8);
  });
  it('rechaza notas falsificadas y mantiene los límites de otras actividades', () => {
    const attemptId = '88567ef7-ed5b-44d0-9f4f-b956731d876b';
    expect(excelSubmitBody.safeParse({ attemptId, revision: 1, score: 100 }).success).toBe(false);
    expect(excelActionBody.safeParse({ attemptId, revision: 0, action: { type: 'save', method: 'shortcut', completed: true } }).success).toBe(false);
    const evaluation = { id: 'e', maxAttempts: 3, waitMinutes: 30, minimumScore: new Prisma.Decimal(80) }; const now = new Date();
    const attempts = [1, 2, 3].map(n => ({ id: String(n), number: n, status: 'FAILED' as const, overrideId: null, submittedAt: now, startedAt: now }));
    expect(computeAvailability(evaluation, attempts, [], now)).toMatchObject({ exhausted: true, canStart: false });
    expect(computeAvailability(evaluation, attempts, [], now, true)).toMatchObject({ exhausted: false, canStart: true, waitUntil: null });
  });
});
