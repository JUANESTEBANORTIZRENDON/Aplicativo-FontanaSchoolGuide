export type AdvanceState = { phase: 'idle' | 'saving' | 'counting' | 'paused' | 'redirecting' | 'advancing' | 'error'; seconds: number; error?: unknown };

export const LESSON_TRANSITION_MS = 2400;

// Solo controla la transición de la guía; la evaluación y sus notas siguen en el simulador.
export function createLessonAdvance(options: {
  isCurrent: () => boolean;
  save: () => Promise<unknown>;
  advance: () => void | Promise<void>;
  state: (state: AdvanceState) => void;
}) {
  let state: AdvanceState = { phase: 'idle', seconds: 4 };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  let paused = false;
  let saved = false;
  let cancelled = false;
  const emit = (phase: AdvanceState['phase'], error?: unknown) => {
    state = { phase, seconds: state.seconds, error };
    if (options.isCurrent()) options.state(state);
  };
  const current = (token: number) => !cancelled && token === generation && options.isCurrent();
  function redirect(token: number) {
    if (!current(token)) return;
    if (paused) { emit('paused'); return; }
    emit('redirecting');
    timer = setTimeout(async () => {
      if (!current(token)) return;
      emit('advancing');
      try { await options.advance(); }
      catch (error) { if (current(token)) emit('error', error); }
    }, LESSON_TRANSITION_MS);
  }
  function count(token: number) {
    if (!current(token)) return;
    if (paused) { emit('paused'); return; }
    emit('counting');
    timer = setTimeout(() => {
      if (!current(token)) return;
      state.seconds--;
      if (state.seconds > 0) { count(token); return; }
      redirect(token);
    }, 1000);
  }
  async function start() {
    if (cancelled || !options.isCurrent() || !['idle', 'error'].includes(state.phase)) return;
    const token = ++generation;
    state.seconds = 4;
    emit('saving');
    try {
      if (!saved) { await options.save(); saved = true; }
      if (current(token)) count(token);
    } catch (error) { if (current(token)) emit('error', error); }
  }
  return {
    start,
    pause() {
      paused = true;
      if (state.phase === 'counting' || state.phase === 'redirecting') { clearTimeout(timer); emit('paused'); }
    },
    resume() {
      paused = false;
      if (state.phase === 'paused') { if (state.seconds === 0) redirect(generation); else count(generation); }
    },
    cancel() { cancelled = true; generation++; clearTimeout(timer); },
  };
}
