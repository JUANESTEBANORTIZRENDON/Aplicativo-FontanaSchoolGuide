// Store único y tipado del simulador, con suscripción simple y persistencia por porciones.

import { DEMO_CREDENTIALS, PRACTICE_ADVISOR, SESSION_HOURS } from '../data/catalogs';
import { createDefaultFilters } from '../domain/customer-filters';
import { STORAGE_KEYS, type SimulatorStorage } from '../services/simulator-storage';
import type {
  ActiveCall,
  CallRecord,
  ConnectionState,
  CustomerFilters,
  Management,
  PauseReason,
  PauseRecord,
  RangeKey,
  Session,
} from '../types/simulator';

/** Resultado de un ejercicio de la prueba de tipificación. */
export interface PracticeResult {
  score: number;
  approved: boolean;
  attempts: number;
  /** Puntos que faltaron en el último intento (para el resumen de la lista de clientes). */
  missing: string[];
}

export interface PracticeState {
  active: boolean;
  results: Record<string, PracticeResult>;
}

const EMPTY_PRACTICE: PracticeState = { active: false, results: {} };

export interface Prefs {
  dashboardRange: RangeKey;
}

export interface SimState {
  session: Session | null;
  activePortfolioId: string | null;
  /** Gestiones registradas por el usuario (las semilla viven en el dataset). */
  managements: Management[];
  calls: CallRecord[];
  pauses: PauseRecord[];
  connection: ConnectionState;
  activeCall: ActiveCall | null;
  filters: Record<string, CustomerFilters>;
  tablePage: Record<string, number>;
  /** Ficha abierta por campaña (pestaña «G.C - cédula»). No se persiste. */
  openCustomers: Record<string, string>;
  prefs: Prefs;
  practice: PracticeState;
}

type Listener = (state: SimState, previous: SimState) => void;

const DEFAULT_PREFS: Prefs = { dashboardRange: 'mes' };

let idCounter = 0;
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

function isSessionValid(session: Session | null, now = Date.now()): session is Session {
  return !!session && typeof session.expiresAt === 'number' && session.expiresAt > now;
}

function initialState(storage: SimulatorStorage): SimState {
  const session = storage.read<Session | null>(STORAGE_KEYS.session, null);
  const pauses = storage.read<PauseRecord[]>(STORAGE_KEYS.pauses, []);
  const openPause = pauses.find((p) => !p.endedAt);
  return {
    session: isSessionValid(session) ? session : null,
    activePortfolioId: storage.read<string | null>(STORAGE_KEYS.activePortfolio, null),
    managements: storage.read<Management[]>(STORAGE_KEYS.managements, []),
    calls: storage.read<CallRecord[]>(STORAGE_KEYS.calls, []),
    pauses,
    connection: openPause ? 'en-pausa' : 'conectado',
    activeCall: null,
    filters: {},
    tablePage: {},
    openCustomers: {},
    prefs: { ...DEFAULT_PREFS, ...storage.read<Partial<Prefs>>(STORAGE_KEYS.prefs, {}) },
    practice: storage.read<PracticeState>(STORAGE_KEYS.practice, EMPTY_PRACTICE),
  };
}

export function createSimulatorStore(storage: SimulatorStorage) {
  let state = initialState(storage);
  const listeners = new Set<Listener>();

  const persist = (next: SimState, prev: SimState): void => {
    if (next.session !== prev.session) {
      if (next.session) storage.write(STORAGE_KEYS.session, next.session);
      else storage.remove(STORAGE_KEYS.session);
    }
    if (next.activePortfolioId !== prev.activePortfolioId) {
      if (next.activePortfolioId) storage.write(STORAGE_KEYS.activePortfolio, next.activePortfolioId);
      else storage.remove(STORAGE_KEYS.activePortfolio);
    }
    if (next.managements !== prev.managements) storage.write(STORAGE_KEYS.managements, next.managements);
    if (next.calls !== prev.calls) storage.write(STORAGE_KEYS.calls, next.calls);
    if (next.pauses !== prev.pauses) storage.write(STORAGE_KEYS.pauses, next.pauses);
    if (next.prefs !== prev.prefs) storage.write(STORAGE_KEYS.prefs, next.prefs);
    if (next.practice !== prev.practice) storage.write(STORAGE_KEYS.practice, next.practice);
  };

  const set = (patch: Partial<SimState> | ((s: SimState) => Partial<SimState>)): void => {
    const prev = state;
    const partial = typeof patch === 'function' ? patch(state) : patch;
    state = { ...state, ...partial };
    persist(state, prev);
    for (const listener of [...listeners]) listener(state, prev);
  };

  const closeOpenPause = (pauses: PauseRecord[]): PauseRecord[] =>
    pauses.map((p) => (p.endedAt ? p : { ...p, endedAt: new Date().toISOString() }));

  return {
    get: (): SimState => state,
    set,
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    hasValidSession(): boolean {
      if (isSessionValid(state.session)) return true;
      if (state.session) set({ session: null });
      return false;
    },

    login(document: string, password: string): boolean {
      if (document.trim() !== DEMO_CREDENTIALS.document || password !== DEMO_CREDENTIALS.password) return false;
      const now = Date.now();
      set({
        session: {
          document: DEMO_CREDENTIALS.document,
          advisorUsername: PRACTICE_ADVISOR.username,
          startedAt: now,
          expiresAt: now + SESSION_HOURS * 3_600_000,
        },
        connection: 'conectado',
      });
      return true;
    },

    /** Borra la sesión y la cartera activa, pero conserva las gestiones. */
    logout(): void {
      set((s) => ({
        session: null,
        activePortfolioId: null,
        activeCall: null,
        connection: 'conectado',
        pauses: s.pauses.some((p) => !p.endedAt) ? closeOpenPause(s.pauses) : s.pauses,
      }));
    },

    setActivePortfolio(id: string | null): void {
      if (state.activePortfolioId !== id) set({ activePortfolioId: id });
    },

    addManagement(data: Omit<Management, 'id' | 'date' | 'advisor'>): Management {
      const management: Management = {
        ...data,
        id: newId('ges'),
        date: new Date().toISOString(),
        advisor: state.session?.advisorUsername ?? PRACTICE_ADVISOR.username,
      };
      set((s) => ({ managements: [...s.managements, management] }));
      return management;
    },

    clearOfficialManagements(customerId: string): void {
      if (state.managements.some(item => item.customerId === customerId)) {
        set(s => ({ managements: s.managements.filter(item => item.customerId !== customerId) }));
      }
    },

    startCall(customerId: string): void {
      if (state.activeCall) return;
      set({ activeCall: { customerId, startedAt: new Date().toISOString() } });
    },

    endCall(): CallRecord | null {
      const call = state.activeCall;
      if (!call) return null;
      const record: CallRecord = {
        id: newId('lla'),
        customerId: call.customerId,
        startedAt: call.startedAt,
        durationSec: Math.max(1, Math.round((Date.now() - new Date(call.startedAt).getTime()) / 1000)),
        simulatedByUser: true,
      };
      set((s) => ({ activeCall: null, calls: [...s.calls, record] }));
      return record;
    },

    setConnection(connection: ConnectionState, reason?: PauseReason): void {
      set((s) => {
        let pauses = s.pauses.some((p) => !p.endedAt) ? closeOpenPause(s.pauses) : s.pauses;
        if (connection === 'en-pausa') {
          pauses = [...pauses, { id: newId('pau'), reason: reason ?? 'BREAK AM', startedAt: new Date().toISOString() }];
        }
        return { connection, pauses };
      });
    },

    setFilters(portfolioId: string, filters: CustomerFilters): void {
      set((s) => ({ filters: { ...s.filters, [portfolioId]: filters }, tablePage: { ...s.tablePage, [portfolioId]: 1 } }));
    },

    getFilters(portfolioId: string): CustomerFilters {
      return state.filters[portfolioId] ?? createDefaultFilters(PRACTICE_ADVISOR.username);
    },

    setPage(portfolioId: string, page: number): void {
      set((s) => ({ tablePage: { ...s.tablePage, [portfolioId]: page } }));
    },

    setOpenCustomer(portfolioId: string, customerId: string | null): void {
      set((s) => {
        const openCustomers = { ...s.openCustomers };
        if (customerId) openCustomers[portfolioId] = customerId;
        else delete openCustomers[portfolioId];
        return { openCustomers };
      });
    },

    /** Empieza (o retoma) la prueba de tipificación. */
    startPractice(restart = false): void {
      set((s) => ({ practice: { active: true, results: restart ? {} : s.practice.results } }));
    },

    endPractice(): void {
      set((s) => ({ practice: { ...s.practice, active: false } }));
    },

    /** Guarda el mejor puntaje del ejercicio y cuenta el intento. */
    recordPractice(exerciseId: string, score: number, approved: boolean, missing: string[] = []): PracticeResult {
      const prev = state.practice.results[exerciseId];
      const nowApproved = approved || !!prev?.approved;
      const result: PracticeResult = {
        score: Math.max(score, prev?.score ?? 0),
        approved: nowApproved,
        attempts: (prev?.attempts ?? 0) + 1,
        // Si ya quedó aprobado no falta nada; si no, dejamos lo que faltó en este intento.
        missing: nowApproved ? [] : missing,
      };
      set((s) => ({ practice: { ...s.practice, results: { ...s.practice.results, [exerciseId]: result } } }));
      return result;
    },

    setRange(range: RangeKey): void {
      set((s) => ({ prefs: { ...s.prefs, dashboardRange: range } }));
    },

    /** "Restablecer práctica": vuelve a los datos iniciales manteniendo la sesión. */
    resetPractice(): void {
      const session = state.session;
      storage.clearAll();
      set({
        activePortfolioId: null,
        managements: [],
        calls: [],
        pauses: [],
        connection: 'conectado',
        activeCall: null,
        filters: {},
        tablePage: {},
        openCustomers: {},
        prefs: { ...DEFAULT_PREFS },
        practice: EMPTY_PRACTICE,
      });
      // clearAll también borró la sesión; se vuelve a guardar para no sacar al usuario.
      if (session) storage.write(STORAGE_KEYS.session, session);
    },
  };
}

export type SimStore = ReturnType<typeof createSimulatorStore>;
