import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLessonAdvance, LESSON_TRANSITION_MS } from './excel-lesson-advance';

function setup(save = vi.fn().mockResolvedValue(undefined), advance = vi.fn().mockResolvedValue(undefined)) {
  const state = vi.fn();
  const isCurrent = vi.fn(() => true);
  const flow = createLessonAdvance({save, advance, state, isCurrent});
  return {flow, save, advance, state, isCurrent};
}
describe('avance automático de las lecciones de Excel', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it('guarda antes de contar y permite leer durante cuatro segundos; no duplica el avance', async () => {
    const {flow, save, advance, state} = setup();
    await Promise.all([flow.start(), flow.start()]);
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(advance).not.toHaveBeenCalled();
    expect(state).toHaveBeenLastCalledWith(expect.objectContaining({phase:'counting', seconds:1}));
    await vi.advanceTimersByTimeAsync(1000);
    expect(state).toHaveBeenLastCalledWith(expect.objectContaining({phase:'redirecting'}));
    expect(advance).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(LESSON_TRANSITION_MS);
    expect(advance).toHaveBeenCalledTimes(1);
    await flow.start();
    await vi.advanceTimersByTimeAsync(5000);
    expect(advance).toHaveBeenCalledTimes(1);
  });
  it('pausa para leer y reanuda con el tiempo restante', async () => {
    const {flow, advance} = setup();
    await flow.start();
    await vi.advanceTimersByTimeAsync(2000);
    flow.pause();
    await vi.advanceTimersByTimeAsync(10000);
    expect(advance).not.toHaveBeenCalled();
    flow.resume();
    await vi.advanceTimersByTimeAsync(2000 + LESSON_TRANSITION_MS);
    expect(advance).toHaveBeenCalledTimes(1);
  });
  it('respeta una pausa solicitada mientras se guarda', async () => {
    let resolve!: () => void;
    const {flow, advance, state} = setup(vi.fn(() => new Promise<void>(done => {resolve = done;})));
    const pending = flow.start();
    flow.pause(); resolve(); await pending;
    expect(state).toHaveBeenLastCalledWith(expect.objectContaining({phase:'paused'}));
    await vi.advanceTimersByTimeAsync(5000);
    expect(advance).not.toHaveBeenCalled();
    flow.resume(); await vi.advanceTimersByTimeAsync(4000 + LESSON_TRANSITION_MS);
    expect(advance).toHaveBeenCalledTimes(1);
  });
  it('no avanza si se abandona la lección durante el guardado o la cuenta', async () => {
    const a = setup(); await a.flow.start(); a.flow.cancel();
    await vi.advanceTimersByTimeAsync(5000);
    expect(a.advance).not.toHaveBeenCalled();
    let resolve!: () => void;
    const b = setup(vi.fn(() => new Promise<void>(done => {resolve = done;})));
    const pending = b.flow.start(); b.flow.cancel(); resolve(); await pending;
    await vi.advanceTimersByTimeAsync(5000);
    expect(b.advance).not.toHaveBeenCalled();
    const c = setup(); await c.flow.start(); c.isCurrent.mockReturnValue(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(c.advance).not.toHaveBeenCalled();
  });
  it('permite reintentar un guardado fallido sin perder la lección', async () => {
    const {flow, advance, save, state} = setup(vi.fn().mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValue(undefined));
    await flow.start();
    expect(state).toHaveBeenLastCalledWith(expect.objectContaining({phase:'error'}));
    await vi.advanceTimersByTimeAsync(5000);
    expect(advance).not.toHaveBeenCalled();
    await flow.start(); await vi.advanceTimersByTimeAsync(4000 + LESSON_TRANSITION_MS);
    expect(save).toHaveBeenCalledTimes(2);
    expect(advance).toHaveBeenCalledTimes(1);
  });
  it('reintenta el acceso final sin volver a guardar una lección ya registrada', async () => {
    const {flow, advance, save, state} = setup(vi.fn().mockResolvedValue(undefined), vi.fn().mockRejectedValueOnce(new Error('Error al iniciar')).mockResolvedValue(undefined));
    await flow.start(); await vi.advanceTimersByTimeAsync(4000 + LESSON_TRANSITION_MS);
    expect(state).toHaveBeenLastCalledWith(expect.objectContaining({phase:'error'}));
    await flow.start(); await vi.advanceTimersByTimeAsync(4000 + LESSON_TRANSITION_MS);
    expect(save).toHaveBeenCalledTimes(1);
    expect(advance).toHaveBeenCalledTimes(2);
  });
  it('permite pausar la ventana de redirección o cancelar la salida sin iniciar la siguiente parte', async () => {
    const {flow, advance, state} = setup();
    await flow.start(); await vi.advanceTimersByTimeAsync(4000);
    flow.pause(); await vi.advanceTimersByTimeAsync(5000);
    expect(advance).not.toHaveBeenCalled();
    flow.resume();
    expect(state).toHaveBeenLastCalledWith(expect.objectContaining({phase:'redirecting'}));
    await vi.advanceTimersByTimeAsync(LESSON_TRANSITION_MS);
    expect(advance).toHaveBeenCalledTimes(1);
    const cancelled = setup(); await cancelled.flow.start();
    await vi.advanceTimersByTimeAsync(4000); cancelled.flow.cancel();
    await vi.advanceTimersByTimeAsync(LESSON_TRANSITION_MS);
    expect(cancelled.advance).not.toHaveBeenCalled();
  });
});
