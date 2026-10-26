// Serializa guardados para que una respuesta anterior nunca sobrescriba la última por latencia de red.
// Un fallo se comunica al llamador, pero no bloquea los siguientes guardados ni los reintentos.
export function createObjectionsSaveQueue(changed: () => void = () => undefined) {
  let tail: Promise<void> = Promise.resolve();
  let pending = 0;
  return {
    get pending() { return pending; },
    settled: () => tail,
    run(write: () => Promise<void>): Promise<void> {
      pending++; changed();
      const task = tail.catch(() => undefined).then(write);
      tail = task.finally(() => { pending--; changed(); });
      return tail;
    },
  };
}
