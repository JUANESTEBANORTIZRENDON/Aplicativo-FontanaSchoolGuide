import './tutor.css';
import { BLINK, FRAME_GEOMETRY, IDLE_BLINK_INTERVAL_MS, IDLE_FRAME, frameUrl, type FrameId } from './manifest';

// Tutor pixel art: un componente reutilizable que muestra cuadros PNG por estado. No usa CSS para deformar la imagen
// (solo respira y entra con pequeños desplazamientos). Quien lo usa decide qué cuadro mostrar (por ejemplo, el
// hablante sincroniza la boca con la voz); en reposo parpadea de vez en cuando.
export type Tutor = {
  // Descarga y decodifica cuadros antes de usarlos (caché compartida: cada PNG se descarga una sola vez).
  preload(ids: readonly FrameId[]): Promise<void>;
  // Muestra un cuadro concreto y detiene el reposo.
  hold(id: FrameId): void;
  // Vuelve al reposo (sonrisa con parpadeo ocasional).
  rest(): void;
  destroy(): void;
};

const loaded = new Map<FrameId, Promise<void>>();
function loadFrame(id: FrameId): Promise<void> {
  let pending = loaded.get(id);
  if (!pending) {
    const image = new Image();
    image.decoding = 'async';
    image.src = frameUrl(id);
    pending = image.decode().catch(() => undefined);
    loaded.set(id, pending);
  }
  return pending;
}
const ensure = (ids: readonly FrameId[]): Promise<void> => Promise.all(ids.map(loadFrame)).then(() => undefined);

export function createTutor(host: HTMLElement): Tutor {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  host.classList.add('tutor');
  host.style.setProperty('--tutor-ratio', `${FRAME_GEOMETRY.width} / ${FRAME_GEOMETRY.height}`);
  host.setAttribute('aria-hidden', 'true'); // acompaña al contenido; toda la información está en texto normal
  host.innerHTML = '<div class="tutor-figure"></div>';
  const figure = host.querySelector<HTMLElement>('.tutor-figure')!;
  const images = new Map<FrameId, HTMLImageElement>();
  let current: FrameId | null = null;
  let timer: number | undefined;
  let run = 0;
  let destroyed = false;
  let wake: (() => void) | null = null;

  // Un <img> por cuadro, apilados: cambiar de cuadro es alternar visibilidad (sin recargas ni parpadeo).
  function show(id: FrameId): void {
    if (destroyed || id === current) return;
    let image = images.get(id);
    if (!image) {
      image = document.createElement('img');
      image.className = 'tutor-frame';
      image.alt = '';
      image.draggable = false;
      image.decoding = 'async';
      image.src = frameUrl(id);
      figure.append(image);
      images.set(id, image);
    }
    if (current) images.get(current)!.classList.remove('is-visible');
    image.classList.add('is-visible');
    current = id;
  }
  function cancel(): number {
    window.clearTimeout(timer);
    wake?.(); wake = null;
    return ++run;
  }
  const wait = (ms: number, token: number): Promise<boolean> => new Promise((resolve) => {
    timer = window.setTimeout(() => resolve(token === run && !destroyed), ms);
    wake = () => resolve(false);
  });

  // Reposo con parpadeo ocasional: un único temporizador activo (no se acumulan bucles).
  async function idle(token: number): Promise<void> {
    show(IDLE_FRAME);
    if (reduced) return;
    while (token === run && !destroyed) {
      const [min, max] = IDLE_BLINK_INTERVAL_MS;
      if (!(await wait(min + Math.random() * (max - min), token))) return;
      if (document.hidden) continue;
      for (const step of BLINK) { show(step.frame); if (!(await wait(step.ms, token))) return; }
      show(IDLE_FRAME);
    }
  }
  const startIdle = (): void => { void idle(cancel()); };

  const ready = ensure([IDLE_FRAME, ...BLINK.map((step) => step.frame)]).then(() => {
    if (destroyed) return;
    host.classList.add('is-ready');
    startIdle();
  });

  return {
    async preload(ids) { await ready; await ensure(ids); },
    hold(id) { if (!destroyed) { cancel(); show(id); } },
    rest() { if (!destroyed) startIdle(); },
    destroy() {
      destroyed = true; cancel();
      host.innerHTML = '';
      host.classList.remove('tutor', 'is-ready');
    },
  };
}
