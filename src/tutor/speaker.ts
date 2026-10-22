import { baseAt, framesOf, talkFrame, type FrameId } from './manifest';
import type { Principle } from './principles';
import type { Tutor } from './tutor';

// El tutor «habla»: reproduce la voz y, en cada fotograma de pantalla, mira en qué punto va el audio para elegir
// el cuadro: el gesto según la coreografía y la boca abierta o cerrada según la línea de boca (volumen real de la voz).
// Así la boca se mueve cuando suena la voz y se detiene en las pausas, aunque el audio se pause o se repita.
export type SpeakerState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';
export type SpeakerEvents = {
  state(state: SpeakerState): void;
  progress(positionMs: number, durationMs: number): void;
  ended?(): void;
};
export type Speaker = {
  select(principle: Principle): void;      // prepara un principio (detiene el anterior); no reproduce
  toggle(): Promise<void>;                 // reproducir / pausar
  restart(): Promise<void>;                // desde el principio
  stop(): void;                            // detiene y deja al tutor en reposo
  destroy(): void;
};

export function createSpeaker(tutor: Tutor, events: SpeakerEvents): Speaker {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const audio = new Audio();
  audio.preload = 'none';
  let principle: Principle | null = null;
  let raf = 0;
  let lastFrame: FrameId | null = null;
  let state: SpeakerState = 'idle';
  let playback = 0;
  let destroyed = false;

  const set = (next: SpeakerState): void => { state = next; events.state(next); };
  function frameAt(positionMs: number): FrameId {
    const p = principle!;
    const open = p.audio.mouth[Math.floor(positionMs / p.audio.stepMs)] === '1';
    return talkFrame(baseAt(p.choreography, positionMs / p.audio.durationMs), open);
  }
  // Con «reducir movimiento» el tutor se queda en una pose estable: solo suena la voz.
  function paint(positionMs: number, mouth = true): void {
    if (!principle) return;
    events.progress(positionMs, principle.audio.durationMs);
    if (reduced) return;
    const frame = mouth ? frameAt(positionMs) : talkFrame(baseAt(principle.choreography, positionMs / principle.audio.durationMs), false);
    if (frame !== lastFrame) { lastFrame = frame; tutor.hold(frame); }
  }
  function loop(): void { paint(audio.currentTime * 1000); raf = requestAnimationFrame(loop); }
  const stopLoop = (): void => { cancelAnimationFrame(raf); raf = 0; };

  audio.addEventListener('waiting', () => { if (state === 'playing') set('loading'); });
  audio.addEventListener('playing', () => { set('playing'); if (!raf) loop(); });
  audio.addEventListener('pause', () => { if (!audio.ended && state === 'playing') { stopLoop(); paint(audio.currentTime * 1000, false); set('paused'); } });
  audio.addEventListener('ended', () => { stopLoop(); lastFrame = null; tutor.rest(); events.progress(0, principle?.audio.durationMs ?? 0); set('idle'); if (!destroyed) events.ended?.(); });
  audio.addEventListener('error', () => { stopLoop(); lastFrame = null; tutor.rest(); set('error'); });

  async function play(): Promise<void> {
    if (!principle || destroyed) return;
    const request = ++playback;
    set('loading');
    try {
      // Los cuadros de este principio se descargan antes de empezar para que no haya parpadeos.
      await tutor.preload(framesOf(principle.choreography));
      if (destroyed || request !== playback) return;
      await audio.play();
    } catch (error) {
      if (destroyed || request !== playback) return;
      stopLoop(); lastFrame = null; tutor.rest();
      // Si el navegador bloquea la reproducción (no hubo un gesto del usuario) se vuelve al estado listo.
      set((error as DOMException).name === 'NotAllowedError' ? 'idle' : 'error');
    }
  }
  function halt(): void {
    playback++;
    stopLoop(); lastFrame = null;
    if (!audio.paused) audio.pause();
    audio.currentTime = 0;
    tutor.rest();
    set('idle');
    events.progress(0, principle?.audio.durationMs ?? 0);
  }

  return {
    select(next) {
      halt();
      principle = next;
      audio.src = next.audio.src;
      events.progress(0, next.audio.durationMs);
    },
    async toggle() {
      if (!principle) return;
      if (state === 'playing' || state === 'loading') { playback++; audio.pause(); stopLoop(); paint(audio.currentTime * 1000, false); set('paused'); return; }
      await play();
    },
    async restart() { if (!principle) return; audio.currentTime = 0; await play(); },
    stop: halt,
    destroy() { destroyed = true; halt(); audio.removeAttribute('src'); audio.load(); },
  };
}
