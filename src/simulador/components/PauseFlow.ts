// Pausas de Control Next: avatar → «Pausa» → ventana «Seleccione un pausa» → Enviar. Mientras dura la pausa se
// muestra una pantalla con el tiempo transcurrido y el botón «Continuar» para volver a quedar CONECTADO.
// Si hay una llamada en curso no se puede pausar: primero hay que terminarla.

import type { SimContext } from '../context';
import { PAUSE_REASONS } from '../data/catalogs';
import { hms } from '../domain/control-next';
import type { PauseReason } from '../types/simulator';
import { combine, on, qs, type Cleanup } from '../utils/dom';
import { esc } from '../utils/format';
import { hydrateIcons, icon } from './icons';
import { openModal } from './Modal';

/** Abre la ventana «Pausa». Resuelve true si la pausa quedó iniciada. */
export async function requestPause(ctx: SimContext): Promise<boolean> {
  const state = ctx.store.get();
  if (state.connection === 'en-pausa') {
    ctx.toast('Ya estás en pausa. Pulsa «Continuar» para volver.', 'info');
    return false;
  }
  if (state.activeCall) {
    await openModal(ctx.root, {
      title: 'Pausa',
      body: `<p><strong>Tienes una llamada en curso.</strong></p>
        <p>Antes de pausar termina la llamada (botón «Colgar»), guarda la gestión y luego vuelve a pulsar «Pausa».</p>`,
      guide: 'pausa.en-llamada',
    });
    return false;
  }
  const choice = await openModal(ctx.root, {
    title: 'Pausa',
    body: `
      <label class="sim-label" for="sim-pause-select">Seleccione un pausa</label>
      <select class="sim-input sim-pause-select" id="sim-pause-select" data-sim-guide="pausa.tipo">
        ${PAUSE_REASONS.map((r) => `<option value="${esc(r)}">${esc(r)}</option>`).join('')}
      </select>`,
    actions: [
      { label: 'Cancelar', value: 'cancel', kind: 'secondary' },
      { label: 'Enviar', value: 'send', kind: 'primary' },
    ],
    guide: 'pausa.ventana',
    read: (dialog) => dialog.querySelector<HTMLSelectElement>('#sim-pause-select')?.value ?? '',
  });
  if (!choice || choice === 'cancel') return false;
  const reason = (choice.startsWith('send:') ? choice.slice(5) : PAUSE_REASONS[0]) as PauseReason;
  ctx.store.setConnection('en-pausa', reason);
  ctx.toast(`Pausa iniciada: ${reason}. Queda registrada con la hora de inicio.`, 'info');
  return true;
}

/** Pantalla de pausa: tapa el aplicativo hasta que el asesor pulsa «Continuar». */
export function mountPauseScreen(ctx: SimContext): Cleanup {
  const host = document.createElement('div');
  host.className = 'sim-pause-screen';
  host.hidden = true;
  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-modal', 'true');
  host.setAttribute('aria-labelledby', 'sim-pause-title');
  ctx.root.append(host);
  let timer: ReturnType<typeof setInterval> | undefined;

  const render = (): void => {
    const pause = ctx.store.get().pauses.find((p) => !p.endedAt);
    const paused = ctx.store.get().connection === 'en-pausa' && !!pause;
    clearInterval(timer);
    if (!paused) {
      host.hidden = true;
      host.innerHTML = '';
      return;
    }
    host.innerHTML = `
      <div class="sim-pause-card">
        <span class="sim-pause-card__icon" aria-hidden="true">${icon('CirclePause')}</span>
        <p class="sim-pause-card__kicker">ESTADO: EN PAUSA</p>
        <h2 id="sim-pause-title" class="sim-pause-card__title">${esc(pause.reason)}</h2>
        <p class="sim-pause-card__time" data-pause-time>00:00:00</p>
        <p class="sim-pause-card__text">Mientras estés en pausa no te entran llamadas. Cuando regreses a tu puesto pulsa «Continuar» para quedar de nuevo CONECTADO.</p>
        <button type="button" class="sim-btn sim-btn--primary sim-pause-card__go" data-action="resume" data-sim-guide="pausa.continuar">${icon('CirclePlay')} Continuar</button>
      </div>`;
    hydrateIcons(host);
    host.hidden = false;
    const started = new Date(pause.startedAt).getTime();
    const tick = (): void => {
      const el = host.querySelector('[data-pause-time]');
      if (el) el.textContent = hms((Date.now() - started) / 1000);
    };
    tick();
    timer = setInterval(tick, 1000);
    qs<HTMLElement>(host, '[data-action="resume"]').focus();
  };
  render();

  return combine([
    () => {
      clearInterval(timer);
      host.remove();
    },
    on(host, 'click', (event) => {
      if (!(event.target as HTMLElement).closest('[data-action="resume"]')) return;
      const pause = ctx.store.get().pauses.find((p) => !p.endedAt);
      ctx.store.setConnection('conectado');
      ctx.toast(`Volviste de ${pause?.reason ?? 'la pausa'}. ESTADO: CONECTADO.`, 'success');
    }),
    ctx.store.subscribe((s, prev) => {
      if (s.connection !== prev.connection || s.pauses !== prev.pauses) render();
    }),
  ]);
}
