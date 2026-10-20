// Extensión y estado del asesor (CONECTADO / EN PAUSA). Durante una llamada simulada muestra «En llamada» con
// cronómetro y el botón Colgar. La pausa se hace desde el avatar → Pausa (o pulsando aquí).

import type { SimContext } from '../context';
import { PRACTICE_ADVISOR } from '../data/catalogs';
import type { SimState } from '../state/store';
import { combine, on, qs, type Cleanup } from '../utils/dom';
import { esc, formatDuration } from '../utils/format';
import { hydrateIcons, icon } from './icons';
import { requestPause } from './PauseFlow';

function callSeconds(state: SimState): number {
  return state.activeCall ? (Date.now() - new Date(state.activeCall.startedAt).getTime()) / 1000 : 0;
}

function badgeTemplate(state: SimState, ctx: SimContext): string {
  if (state.activeCall) {
    const customer = ctx.findView(state.activeCall.customerId);
    return `
      <div class="sim-conn sim-conn--call">
        <span class="sim-conn__line">${icon('PhoneCall')} <span class="sim-conn__ext">${esc(customer?.name ?? 'Cliente')}</span></span>
        <span class="sim-conn__state">En llamada · <span data-call-timer>${formatDuration(callSeconds(state))}</span></span>
        <button type="button" class="sim-btn sim-btn--danger sim-btn--xs" data-action="hangup">${icon('PhoneOff')} Colgar</button>
      </div>`;
  }
  const pause = state.pauses.find((p) => !p.endedAt);
  const paused = state.connection === 'en-pausa';
  return `
    <button type="button" class="sim-conn sim-conn--${state.connection}" data-action="pause"
      aria-label="Extensión ${esc(PRACTICE_ADVISOR.extension)}. Estado: ${paused ? 'en pausa' : 'conectado'}.${paused ? '' : ' Pulsa para hacer una pausa.'}">
      <span class="sim-conn__line">${icon('Signal')}<span class="sim-conn__ext">${esc(PRACTICE_ADVISOR.extension)}</span>${icon('Phone')}</span>
      <span class="sim-conn__state">Estado: ${paused ? `En pausa${pause ? ` · ${esc(pause.reason)}` : ''}` : 'Conectado'}</span>
    </button>`;
}

export function connectionBadgeTemplate(): string {
  return `<div class="sim-conn-slot" data-connection-slot data-sim-guide="comun.estado-conexion"></div>`;
}

export function mountConnectionBadge(ctx: SimContext, scope: HTMLElement): Cleanup {
  const slot = qs(scope, '[data-connection-slot]');
  const render = (): void => {
    slot.innerHTML = badgeTemplate(ctx.store.get(), ctx);
    hydrateIcons(slot);
  };
  render();

  const timer = setInterval(() => {
    const el = slot.querySelector('[data-call-timer]');
    if (el) el.textContent = formatDuration(callSeconds(ctx.store.get()));
  }, 1000);

  return combine([
    () => clearInterval(timer),
    ctx.store.subscribe((s, prev) => {
      if (s.connection !== prev.connection || s.activeCall !== prev.activeCall || s.pauses !== prev.pauses) render();
    }),
    on(slot, 'click', (event) => {
      const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
      if (action === 'pause') void requestPause(ctx);
      else if (action === 'hangup') {
        const record = ctx.store.endCall();
        if (record) ctx.toast(`Llamada finalizada (${formatDuration(record.durationSec)}). Ahora guarda la gestión.`, 'success');
      }
    }),
  ]);
}
