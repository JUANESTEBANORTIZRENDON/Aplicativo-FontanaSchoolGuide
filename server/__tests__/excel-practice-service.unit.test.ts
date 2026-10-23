import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EXERCISES, initialRows, newPractice, type AnyPracticeState, type PracticeState } from '../domain/excel-practice.js';
import { PRACTICE_ACTIONS } from './excel-practice-actions.js';

const db = vi.hoisted(() => {
  let stored: Record<string, any>;
  const attempt = { findUnique: vi.fn(async () => structuredClone(stored)), findFirst: vi.fn(async ({ where }: any) => where.status === 'IN_PROGRESS' ? structuredClone(stored) : null) };
  const excelAttemptResult = { update: vi.fn(async ({ data }: any) => { stored.excelResult = JSON.parse(JSON.stringify({ ...stored.excelResult, ...data })); return structuredClone(stored.excelResult); }) };
  const tx = { $queryRaw: vi.fn(async () => []), attempt, excelAttemptResult };
  return { tx, reset: () => { stored = { id: 'attempt-1', userId: 'owner', number: 1, status: 'IN_PROGRESS', excelResult: { excelActivityId: 'scenario', configSnapshot: { practice: null } } }; }, set: (state: unknown) => { stored.excelResult.configSnapshot.practice = state; }, close: () => { stored.status = 'PASSED'; }, get: () => structuredClone(stored), failWrite: () => excelAttemptResult.update.mockRejectedValueOnce(new Error('Database unavailable')) };
});
vi.mock('../config/prisma.js', () => ({ prisma: { ...db.tx, $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db.tx), excelActivity: { findFirst: async () => ({ id: 'scenario' }) } } }));
vi.mock('../repositories/office.repository.js', () => ({ officeActivities: async () => ({ bySection: { excel: { id: 'excel', status: 'ACTIVE' } } }) }));
const submit = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock('../services/attempt.service.js', () => ({ startAttemptTx: vi.fn(), submitAttemptTx: submit }));
import { getActivity, performAction, submitPractice } from '../services/office-excel.service.js';

describe('persistencia y aislamiento de la práctica de Excel', () => {
  beforeEach(() => { vi.clearAllMocks(); db.reset(); db.set(newPractice()); });
  it('guarda cada acción en el resultado del intento y recupera hoja y avance con GET', async () => {
    let revision = 0;
    for (let i = 0; i < EXERCISES.length; i++) {
      for (const action of PRACTICE_ACTIONS[i]!) {
        const result = await performAction('owner', 'scenario', { attemptId: 'attempt-1', revision, action });
        revision = result.state.revision;
      }
      if (i < EXERCISES.length - 1) { await performAction('owner', 'scenario', { attemptId: 'attempt-1', revision, action: { type: 'next' } }); revision++; }
    }
    // La lectura proviene del registro persistido, serializado como JSON igual que en Prisma.
    const loaded = await getActivity('owner');
    expect(loaded.practice?.state.completed).toEqual(Array(7).fill(true));
    expect((loaded.practice?.state as PracticeState).savedRows?.[0]?.observacion).toBe('Prometió pagar el viernes');
    expect(db.tx.excelAttemptResult.update).toHaveBeenLastCalledWith(expect.objectContaining({ where: { attemptId: 'attempt-1' }, data: expect.objectContaining({ stepResults: expect.any(Array) }) }));
    const result = await submitPractice('owner', 'scenario', { attemptId: 'attempt-1', revision });
    expect(result).toMatchObject({ score: 100, passed: true });
    expect(submit).toHaveBeenCalledWith(db.tx, 'owner', 'attempt-1', expect.objectContaining({ score: 100, passed: true, answers: expect.arrayContaining([expect.objectContaining({ questionId: 'guardar', awardedScore: 14.28 })]) }));
  });
  it('no confirma guardado si falla la base de datos; conserva la revisión anterior para reintentar', async () => {
    const state = newPractice(); state.current = 6; state.stage = 1; state.visited.fill(true); state.rows[0]!.observacion = 'Prometió pagar el viernes'; state.dirty = true;
    db.set(state); db.failWrite();
    await expect(performAction('owner', 'scenario', { attemptId: 'attempt-1', revision: 0, action: { type: 'save', method: 'shortcut' } })).rejects.toThrow('Database unavailable');
    expect(db.get().excelResult.configSnapshot.practice).toMatchObject({ savedAt: null, dirty: true, revision: 0 });
    const retried = await performAction('owner', 'scenario', { attemptId: 'attempt-1', revision: 0, action: { type: 'save', method: 'button' } });
    expect(retried.state).toMatchObject({ dirty: false, completed: [false, false, false, false, false, false, true] });
    expect(retried.state.methods).toEqual([{ exercise: 6, command: 'save', method: 'button' }]);
  });
  it('rechaza otro asesor, otra actividad, revisiones antiguas e intentos cerrados', async () => {
    const body = { attemptId: 'attempt-1', revision: 0, action: { type: 'skip' as const } };
    await expect(performAction('other', 'scenario', body)).rejects.toMatchObject({ code: 'ATTEMPT_NOT_FOUND' });
    await expect(performAction('owner', 'other-scenario', body)).rejects.toMatchObject({ code: 'ATTEMPT_NOT_FOUND' });
    await expect(performAction('owner', 'scenario', { ...body, revision: 20 })).rejects.toMatchObject({ code: 'PRACTICE_STALE' });
    db.close();
    await expect(performAction('owner', 'scenario', body)).rejects.toMatchObject({ code: 'ATTEMPT_CLOSED' });
    expect(db.tx.excelAttemptResult.update).not.toHaveBeenCalled();
  });
  it('no permite finalizar antes de recorrer los cinco ejercicios o con cambios sin guardar', async () => {
    await expect(submitPractice('owner', 'scenario', { attemptId: 'attempt-1', revision: 0 })).rejects.toMatchObject({ code: 'PRACTICE_INCOMPLETE' });
    const state = newPractice(); state.visited.fill(true); state.dirty = true; db.set(state);
    await expect(submitPractice('owner', 'scenario', { attemptId: 'attempt-1', revision: 0 })).rejects.toMatchObject({ code: 'UNSAVED_CHANGES' });
    expect(submit).not.toHaveBeenCalled();
  });
  it('califica exclusivamente el estado persistido: seis de siete aprueban y cinco no', async () => {
    const state: PracticeState = newPractice(); state.visited.fill(true); state.completed = [true, true, true, true, true, true, false]; db.set(state);
    expect(await submitPractice('owner', 'scenario', { attemptId: 'attempt-1', revision: 0 })).toMatchObject({ score: 85.72, passed: true });
    state.completed[3] = false; db.set(state); // quedan cinco de siete
    expect(await submitPractice('owner', 'scenario', { attemptId: 'attempt-1', revision: 0 })).toMatchObject({ score: 71.43, passed: false });
  });
  it('convierte un intento abierto de la versión anterior sin perder lo practicado ni la revisión', async () => {
    const old: AnyPracticeState = { version: 2, revision: 4, current: 6, rows: initialRows().slice(0, 5), completed: [true, true, true, true, false, false, false, false], visited: [true, true, true, true, true, true, true, false], savedRows: null, savedAt: null };
    db.set(old);
    const result = await performAction('owner', 'scenario', { attemptId: 'attempt-1', revision: 4, action: { type: 'open-search', method: 'shortcut' } });
    expect(result.state).toMatchObject({ version: 5, revision: 5, completed: [true, true, false, false, false, false, false] });
  });
  it('un intento cerrado conserva su resultado original al consultarlo', async () => {
    const closed: AnyPracticeState = { version: 2, revision: 9, current: 7, rows: initialRows().slice(0, 5), completed: Array(8).fill(true), visited: Array(8).fill(true), savedRows: initialRows().slice(0, 5), savedAt: '2026-10-21T10:00:00.000Z' };
    db.set(closed); db.close();
    const loaded = await getActivity('owner');
    expect(loaded.practice?.state).toMatchObject({ version: 2, completed: Array(8).fill(true) });
  });
});
