import { createSpeaker, type SpeakerState } from './speaker';
import { PRINCIPLES } from './principles';
import { createTutor } from './tutor';

// Pestaña «Principios de trabajo»: cinco opciones. Al elegir una, el tutor la explica con voz y mueve la boca con ella.
// El texto completo de lo que dice el tutor siempre está visible (HTML normal); el personaje acompaña, no reemplaza.
export type PrinciplesOptions = {
  // Se avisa cada vez que cambia cuántos principios se han revisado (al mostrarse o elegirse cada uno).
  onProgress?: (state: { reviewed: number; total: number }) => void;
};
export type PrinciplesPanel = {
  show(): void;   // la pestaña se muestra
  hide(): void;   // la pestaña se oculta: la voz se detiene
  destroy(): void;
};

const escape = (value: string): string => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const clock = (ms: number): string => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

const STATUS: Record<SpeakerState, string> = {
  idle: 'Pulsa «Escuchar» o elige otro principio para que el tutor te lo explique.',
  loading: 'Preparando la explicación…',
  playing: 'El tutor te está explicando este principio.',
  paused: 'En pausa. Pulsa «Continuar» para seguir escuchando.',
  error: 'No pudimos reproducir el audio. Puedes leer la explicación en el texto.',
};

export function mountPrinciples(host: HTMLElement, options: PrinciplesOptions = {}): PrinciplesPanel {
  host.innerHTML = `
    <div class="steps principle-options" role="group" aria-label="Los cinco principios de trabajo">${PRINCIPLES.map((principle, index) => `
      <button type="button" class="step${index === 0 ? ' is-active' : ''}" data-principle="${principle.id}" aria-pressed="${index === 0}"><span>${String(principle.order).padStart(2, '0')}</span>${escape(principle.title)}</button>`).join('')}
    </div>
    <article class="step-detail principle-detail">
      <div class="principle-stage">
        <div class="principle-tutor" id="principle-tutor"></div>
        <div class="principle-copy">
          <span class="detail-count" id="principle-count"></span>
          <h4 id="principle-title" tabindex="-1"></h4>
          <p class="principle-summary" id="principle-summary"></p>
        </div>
      </div>
      <div class="detail-note principle-narration"><strong>Esto es lo que explica el tutor</strong><p id="principle-narration"></p></div>
      <div class="principle-audio" role="group" aria-label="Reproductor de la explicación">
        <button type="button" class="primary" id="principle-play" aria-label="Escuchar la explicación">▶ Escuchar</button>
        <div class="principle-progress" role="progressbar" aria-label="Avance del audio" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div>
        <span class="principle-time" id="principle-time">0:00</span>
        <button type="button" class="principle-replay" id="principle-replay">Repetir</button>
      </div>
      <p class="principle-status" id="principle-status" role="status" aria-live="polite"></p>
    </article>`;
  const q = <T extends HTMLElement>(selector: string): T => host.querySelector<T>(selector)!;
  const buttons = [...host.querySelectorAll<HTMLButtonElement>('[data-principle]')];
  const playButton = q<HTMLButtonElement>('#principle-play');
  const tutorHost = q<HTMLElement>('#principle-tutor');
  const progressBar = q<HTMLElement>('.principle-progress');
  const tutor = createTutor(tutorHost);
  let index = 0;
  let visible = false;
  const reviewed = new Set<string>();

  const speaker = createSpeaker(tutor, {
    state(state) {
      const playing = state === 'playing' || state === 'loading';
      tutorHost.classList.toggle('is-talking', state === 'playing');
      playButton.textContent = playing ? '⏸ Pausar' : state === 'paused' ? '▶ Continuar' : '▶ Escuchar';
      playButton.setAttribute('aria-label', playing ? 'Pausar la explicación' : state === 'paused' ? 'Continuar la explicación' : 'Escuchar la explicación');
      q('#principle-status').textContent = STATUS[state];
    },
    progress(position, duration) {
      const percent = duration ? Math.min(100, Math.round(position / duration * 100)) : 0;
      progressBar.setAttribute('aria-valuenow', String(percent));
      progressBar.querySelector<HTMLElement>('span')!.style.width = `${percent}%`;
      q('#principle-time').textContent = `${clock(position)} / ${clock(duration)}`;
    },
  });

  function select(next: number, autoplay: boolean): void {
    index = next;
    const principle = PRINCIPLES[index]!;
    buttons.forEach((button, position) => { button.classList.toggle('is-active', position === index); button.setAttribute('aria-pressed', String(position === index)); });
    q('#principle-count').textContent = `PRINCIPIO ${String(principle.order).padStart(2, '0')} / ${String(PRINCIPLES.length).padStart(2, '0')}`;
    q('#principle-title').textContent = principle.title;
    q('#principle-summary').textContent = principle.summary;
    q('#principle-narration').textContent = principle.narration;
    speaker.select(principle);
    // Un principio cuenta como revisado cuando se muestra (su texto queda a la vista) o se elige.
    if (!reviewed.has(principle.id)) { reviewed.add(principle.id); options.onProgress?.({ reviewed: reviewed.size, total: PRINCIPLES.length }); }
    // Elegir una opción es un gesto del usuario: el navegador permite iniciar la voz.
    if (autoplay) void speaker.toggle();
  }
  buttons.forEach((button, position) => button.addEventListener('click', () => {
    if (position === index) void speaker.toggle(); else select(position, true);
  }));
  playButton.addEventListener('click', () => { void speaker.toggle(); });
  q('#principle-replay').addEventListener('click', () => { void speaker.restart(); });
  select(0, false);

  return {
    show() { visible = true; },
    hide() { if (visible) { visible = false; speaker.stop(); } },
    destroy() { speaker.destroy(); tutor.destroy(); host.innerHTML = ''; },
  };
}
