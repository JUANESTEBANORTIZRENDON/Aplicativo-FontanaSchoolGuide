import { describe, expect, it, vi } from 'vitest';
import { createObjectionsSaveQueue } from './save-queue';
describe('borradores escritos: orden de guardado', () => {
  it('mantiene el orden de escritura aunque se acumulen cambios durante una petición lenta', async () => {
    const changes: string[] = [];
    let release!: () => void;
    const delayed = new Promise<void>(resolve => { release = resolve; });
    const queue = createObjectionsSaveQueue();
    const first = queue.run(async () => { await delayed; changes.push('respuesta anterior'); });
    const second = queue.run(async () => { changes.push('última respuesta'); });
    expect(queue.pending).toBe(2);
    await Promise.resolve();
    expect(changes).toEqual([]);
    release(); await first; await second;
    expect(changes).toEqual(['respuesta anterior', 'última respuesta']);
    expect(queue.pending).toBe(0);
  });
  it('propaga el error para no mostrar guardado y permite reintentar después', async () => {
    const queue = createObjectionsSaveQueue();
    const acknowledge = vi.fn();
    await expect(queue.run(async () => { throw new Error('Sin conexión'); })).rejects.toThrow('Sin conexión');
    expect(queue.pending).toBe(0);
    await queue.run(async () => { acknowledge('guardado'); });
    expect(acknowledge).toHaveBeenCalledWith('guardado');
  });
  it('conserva estado pendiente hasta la última confirmación', async () => {
    const pendingStates: number[] = [];
    const queue = createObjectionsSaveQueue(() => { pendingStates.push(queue.pending); });
    await queue.run(async () => undefined);
    expect(pendingStates).toEqual([1, 0]);
    await queue.settled();
  });
});
