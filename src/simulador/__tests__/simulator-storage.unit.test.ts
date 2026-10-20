import { describe, expect, it } from 'vitest';
import { createSimulatorStorage, STORAGE_KEYS } from '../services/simulator-storage';
import { createSimulatorStore } from '../state/store';

/** localStorage en memoria para las pruebas. */
function memoryBackend(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  return {
    get length() {
      return data.size;
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

const failingBackend = {
  length: 0,
  key: () => null,
  getItem: () => {
    throw new Error('bloqueado');
  },
  setItem: () => {
    throw new Error('cuota');
  },
  removeItem: () => {
    throw new Error('bloqueado');
  },
};

describe('simulator-storage', () => {
  it('usa el prefijo versionado', () => {
    const backend = memoryBackend();
    const storage = createSimulatorStorage(undefined, backend);
    storage.write(STORAGE_KEYS.prefs, { a: 1 });
    expect([...backend.data.keys()]).toEqual(['fontana-sim-cobranza:v1:preferencias']);
    expect(storage.read(STORAGE_KEYS.prefs, null)).toEqual({ a: 1 });
  });

  it('clearAll borra solo las claves propias', () => {
    const backend = memoryBackend({ 'otra-app:token': 'x' });
    const storage = createSimulatorStorage('fontana-sim-cobranza', backend);
    storage.write(STORAGE_KEYS.managements, []);
    storage.write(STORAGE_KEYS.calls, []);
    storage.clearAll();
    expect([...backend.data.keys()]).toEqual(['otra-app:token']);
  });

  it('JSON dañado devuelve el valor por defecto', () => {
    const backend = memoryBackend({ 'fontana-sim-cobranza:v1:gestiones': '{no es json' });
    expect(createSimulatorStorage(undefined, backend).read(STORAGE_KEYS.managements, [])).toEqual([]);
  });

  it('si el almacenamiento falla, sigue funcionando en memoria', () => {
    const storage = createSimulatorStorage(undefined, failingBackend);
    expect(() => storage.write(STORAGE_KEYS.prefs, { r: 'mes' })).not.toThrow();
    expect(storage.read(STORAGE_KEYS.prefs, null)).toEqual({ r: 'mes' });
    expect(() => storage.clearAll()).not.toThrow();
    expect(createSimulatorStorage(undefined, null).read(STORAGE_KEYS.prefs, 'x')).toBe('x');
  });
});

describe('store', () => {
  it('login, gestiones persistentes, salir y restablecer', () => {
    const backend = memoryBackend();
    const store = createSimulatorStore(createSimulatorStorage(undefined, backend));
    expect(store.login('1000000000', 'mala')).toBe(false);
    expect(store.login('1000000000', 'Practica2026')).toBe(true);
    expect(store.hasValidSession()).toBe(true);

    store.addManagement({ customerId: 'cli-001', result: 'contactado', note: 'Nota suficientemente larga' });
    store.logout();
    expect(store.get().session).toBeNull();

    // Al volver a cargar se conservan las gestiones.
    const reloaded = createSimulatorStore(createSimulatorStorage(undefined, backend));
    expect(reloaded.get().managements).toHaveLength(1);

    reloaded.login('1000000000', 'Practica2026');
    reloaded.resetPractice();
    expect(reloaded.get().managements).toHaveLength(0);
    expect(reloaded.get().session).not.toBeNull();
    expect(backend.data.has('fontana-sim-cobranza:v1:sesion')).toBe(true);
    expect(backend.data.get('fontana-sim-cobranza:v1:gestiones') ?? '[]').toBe('[]');
  });

  it('una sesión vencida no se restaura', () => {
    const backend = memoryBackend({
      'fontana-sim-cobranza:v1:sesion': JSON.stringify({ document: '1', advisorUsername: 'a', startedAt: 0, expiresAt: 1 }),
    });
    expect(createSimulatorStore(createSimulatorStorage(undefined, backend)).get().session).toBeNull();
  });

  it('pausas y llamadas simuladas', () => {
    const store = createSimulatorStore(createSimulatorStorage(undefined, memoryBackend()));
    store.setConnection('en-pausa', 'Almuerzo');
    expect(store.get().pauses[0]).toMatchObject({ reason: 'Almuerzo' });
    store.setConnection('desconectado');
    expect(store.get().pauses[0]?.endedAt).toBeDefined();

    store.startCall('cli-001');
    expect(store.endCall()?.simulatedByUser).toBe(true);
    expect(store.get().calls).toHaveLength(1);
    expect(store.endCall()).toBeNull();
  });
});
