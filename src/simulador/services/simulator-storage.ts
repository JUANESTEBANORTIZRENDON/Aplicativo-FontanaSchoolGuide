// Única puerta de acceso a localStorage. Todas las claves llevan el prefijo versionado y, si el
// almacenamiento no está disponible (modo privado, cuota, bloqueos), el simulador sigue en memoria.

export const DEFAULT_STORAGE_PREFIX = 'fontana-sim-cobranza';
export const STORAGE_VERSION = 'v1';

export const STORAGE_KEYS = {
  session: 'sesion',
  activePortfolio: 'cartera-activa',
  managements: 'gestiones',
  calls: 'llamadas',
  pauses: 'pausas',
  prefs: 'preferencias',
  practice: 'prueba-tipificacion',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

type Backend = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

export interface SimulatorStorage {
  readonly prefix: string;
  read<T>(key: StorageKey, fallback: T): T;
  write(key: StorageKey, value: unknown): void;
  remove(key: StorageKey): void;
  /** Borra solo las claves con el prefijo del simulador. */
  clearAll(): void;
}

function defaultBackend(): Backend | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function createSimulatorStorage(
  basePrefix: string = DEFAULT_STORAGE_PREFIX,
  backend: Backend | null = defaultBackend(),
): SimulatorStorage {
  const prefix = `${basePrefix}:${STORAGE_VERSION}:`;
  const memory = new Map<string, string>();
  const full = (key: string): string => prefix + key;

  return {
    prefix,
    read<T>(key: StorageKey, fallback: T): T {
      let raw: string | null | undefined;
      try {
        raw = backend?.getItem(full(key));
      } catch {
        raw = undefined;
      }
      raw ??= memory.get(full(key)) ?? null;
      if (raw === null) return fallback;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },
    write(key: StorageKey, value: unknown): void {
      const raw = JSON.stringify(value);
      memory.set(full(key), raw);
      try {
        backend?.setItem(full(key), raw);
      } catch {
        // Sin almacenamiento persistente: el valor queda en memoria.
      }
    },
    remove(key: StorageKey): void {
      memory.delete(full(key));
      try {
        backend?.removeItem(full(key));
      } catch {
        // Ignorado a propósito.
      }
    },
    clearAll(): void {
      for (const key of [...memory.keys()]) if (key.startsWith(prefix)) memory.delete(key);
      try {
        if (!backend) return;
        const owned: string[] = [];
        for (let i = 0; i < backend.length; i += 1) {
          const key = backend.key(i);
          if (key?.startsWith(prefix)) owned.push(key);
        }
        for (const key of owned) backend.removeItem(key);
      } catch {
        // Ignorado a propósito.
      }
    },
  };
}
