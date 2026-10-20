// Estado del asesor (solo práctica visual): conectado → en pausa (con motivo) → desconectado.
// Durante una llamada simulada muestra "En llamada" con cronómetro.

import type { SimContext } from '../context';
import { PAUSE_REASONS, PRACTICE_ADVISOR } from '../data/catalogs';
import type { SimState } from '../state/store';
import type { ConnectionState, PauseReason } from '../types/simulator';
import { combine, on, qs, type Cleanup } from '../utils/dom';
import { esc, formatDuration } from '../utils/format';
import { hydrateIcons, icon } from './icons';

const LABELS: Record<ConnectionState, string> = {
  conectado: 'Conectado',
  'en-pausa': 'En pausa',
  desconectado: 'Desconectado',
};

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
  const next = state.connection === 'conectado' ? 'poner en pausa' : state.connection === 'en-pausa' ? 'desconectar' : 'conectar';
  return `
    <button type="button" class="sim-conn sim-conn--${state.connection}" data-action="cycle"
      aria-label="Estado: ${LABELS[state.connection]} (simulado). Pulsa para ${next}.">
      <span class="sim-conn__line">${icon('Signal')}<span class="sim-conn__ext">${esc(PRACTICE_ADVISOR.extension)}</span>${icon('Phone')}</span>
      <span class="sim-conn__state">Estado: ${LABELS[state.connection]}${pause ? ` · ${esc(pause.reason)}` : ''}</span>
    </button>
    <div class="sim-popover sim-conn__pause" data-pause-picker hidden>
      <label class="sim-label" for="sim-pause-reason">Motivo de la pausa</label>
      <select id="sim-pause-reason" class="sim-input">
        ${PAUSE_REASONS.map((r) => `<option value="${esc(r)}">${esc(r)}</option>`).join('')}
      </select>
      <div class="sim-popover__actions">
        <button type="button" class="sim-btn sim-btn--ghost sim-btn--xs" data-action="cancel-pause">Cancelar</button>
        <button type="button" class="sim-btn sim-btn--primary sim-btn--xs" data-action="start-pause">Iniciar pausa</button>
      </div>
    </div>`;
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

  const picker = (): HTMLElement | null => slot.querySelector<HTMLElement>('[data-pause-picker]');

  return combine([
    () => clearInterval(timer),
    ctx.store.subscribe((s, prev) => {
      if (s.connection !== prev.connection || s.activeCall !== prev.activeCall || s.pauses !== prev.pauses) render();
    }),
    on(slot, 'click', (event) => {
      const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
      const state = ctx.store.get();
      if (action === 'cycle') {
        if (state.connection === 'conectado') {
          const p = picker();
          if (p) {
            p.hidden = false;
            qs<HTMLSelectElement>(p, 'select').focus();
          }
        } else if (state.connection === 'en-pausa') {
          ctx.store.setConnection('desconectado');
          ctx.toast('Estado: desconectado (simulado).', 'info');
        } else {
          ctx.store.setConnection('conectado');
          ctx.toast('Estado: conectado (simulado).', 'info');
        }
      } else if (action === 'start-pause') {
        const reason = qs<HTMLSelectElement>(slot, '#sim-pause-reason').value as PauseReason;
        ctx.store.setConnection('en-pausa', reason);
        ctx.toast(`Pausa iniciada: ${reason}. Queda registrada en Pausas.`, 'info');
        qs<HTMLElement>(slot, '[data-action="cycle"]').focus();
      } else if (action === 'cancel-pause') {
        const p = picker();
        if (p) p.hidden = true;
        qs<HTMLElement>(slot, '[data-action="cycle"]').focus();
      } else if (action === 'hangup') {
        const record = ctx.store.endCall();
        if (record) ctx.toast(`Llamada finalizada (${formatDuration(record.durationSec)}). Registrada en Llamadas.`, 'success');
      }
    }),
    on(slot, 'keydown', (event) => {
      const p = picker();
      if (event.key === 'Escape' && p && !p.hidden) {
        event.stopPropagation();
        p.hidden = true;
        qs<HTMLElement>(slot, '[data-action="cycle"]').focus();
      }
    }),
  ]);
}
