// Panel lateral con el detalle del cliente y el registro de gestión.
// role="dialog", foco atrapado, cierre con Esc y foco devuelto al botón que lo abrió.

import type { SimContext } from '../context';
import { PRIORITIES, profileLabel, RESULTS, resultMeta } from '../data/catalogs';
import {
  NOTE_MAX,
  NOTE_MIN,
  PROMISE_MAX_DAYS,
  parseAmount,
  validateManagement,
  type ManagementDraft,
  type ManagementErrors,
} from '../domain/management-form';
import type { CustomerView, ResultCode } from '../types/simulator';
import { addDays, startOfDay, toDateKey, toDateTimeLocal } from '../utils/dates';
import { combine, on, qs, qsa, trapFocus, type Cleanup } from '../utils/dom';
import { esc, formatCOP, formatDate, formatDateTime, formatDuration } from '../utils/format';
import { hydrateIcons, icon } from './icons';
import { obligationChip, profileChip, statusBadge } from './StatusBadge';

function infoTemplate(v: CustomerView, ctx: SimContext): string {
  const call = ctx.store.get().activeCall;
  const inThisCall = call?.customerId === v.id;
  const busy = !!call && !inThisCall;
  const priority = PRIORITIES.find((p) => p.code === v.priority)?.label ?? v.priority;
  return `
    <dl class="sim-detail__facts">
      <div class="sim-detail__phone">
        <dt>Teléfono</dt>
        <dd>
          <span>${esc(v.phone)}</span>
          ${
            inThisCall
              ? `<button type="button" class="sim-btn sim-btn--danger sim-btn--sm" data-action="hangup">${icon('PhoneOff')} Colgar</button>`
              : `<button type="button" class="sim-btn sim-btn--success sim-btn--sm" data-action="call" ${busy ? 'disabled' : ''}>${icon('PhoneCall')} Llamar (simulado)</button>`
          }
          ${busy ? '<span class="sim-help">Hay otra llamada simulada en curso.</span>' : ''}
        </dd>
      </div>
      <div><dt>Correo</dt><dd>${esc(v.email)}</dd></div>
      <div><dt>Ciudad</dt><dd>${esc(v.city)}</dd></div>
      <div><dt>Asesor</dt><dd>${esc(v.advisor)}</dd></div>
      <div><dt>Prioridad</dt><dd>${esc(priority)}</dd></div>
      <div><dt>Estado de gestión</dt><dd>${statusBadge(v.status)}</dd></div>
      <div><dt>Mejor perfil</dt><dd>${profileChip(v.bestProfile)}</dd></div>
      <div><dt>Último perfil</dt><dd>${profileChip(v.lastProfile)}</dd></div>
      <div><dt>Saldo simulado</dt><dd><strong>${esc(formatCOP(v.totalBalance))}</strong></dd></div>
      <div><dt>Total promesas</dt><dd>${v.totalPromises}</dd></div>
    </dl>`;
}

function obligationsTemplate(v: CustomerView): string {
  return `
    <div class="sim-table-wrap">
      <table class="sim-table sim-table--compact">
        <caption class="sim-visually-hidden">Obligaciones de ${esc(v.name)}</caption>
        <thead><tr><th scope="col">Producto</th><th scope="col">Saldo</th><th scope="col">Mora</th><th scope="col">Estado</th></tr></thead>
        <tbody>
          ${v.obligations
            .map(
              (o) => `
            <tr>
              <td>${esc(o.product)}<span class="sim-table__sub">${esc(o.id.toUpperCase())}</span></td>
              <td class="sim-num">${esc(formatCOP(o.balance))}</td>
              <td class="sim-num">${o.daysPastDue} días</td>
              <td>${obligationChip(o.status)}</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>`;
}

function historyTemplate(v: CustomerView): string {
  if (!v.managements.length) return '<p class="sim-help">Este cliente todavía no tiene gestiones.</p>';
  return `
    <ol class="sim-history">
      ${v.managements
        .map((m) => {
          const extra =
            m.result === 'promesa-pago' && m.promiseDate
              ? `<p class="sim-history__extra">${icon('CalendarCheck')} Compromiso: ${esc(formatDate(m.promiseDate))} por ${esc(formatCOP(m.promiseAmount ?? 0))}</p>`
              : m.result === 'devolucion-llamada' && m.callbackAt
                ? `<p class="sim-history__extra">${icon('Clock3')} Volver a llamar: ${esc(formatDateTime(m.callbackAt))}</p>`
                : '';
          return `
          <li class="sim-history__item">
            <div class="sim-history__head">
              ${profileChip(m.result)}
              <time datetime="${esc(m.date)}">${esc(formatDateTime(m.date))}</time>
            </div>
            <p class="sim-history__note">${esc(m.note)}</p>
            ${extra}
            <p class="sim-history__by">${esc(m.advisor)}${m.id.startsWith('seed-') ? '' : ' · registrada en esta práctica'}</p>
          </li>`;
        })
        .join('')}
    </ol>`;
}

function formTemplate(v: CustomerView): string {
  const now = new Date();
  const today = toDateKey(now);
  const maxDate = toDateKey(addDays(startOfDay(now), PROMISE_MAX_DAYS));
  return `
    <form class="sim-mgmt-form" novalidate data-sim-guide="clientes.detalle.formulario" aria-labelledby="sim-mgmt-title">
      <h3 id="sim-mgmt-title" class="sim-detail__section-title">${icon('ClipboardList')} Registrar gestión</h3>
      <p class="sim-form-summary" role="alert" aria-live="assertive" data-summary></p>
      <div class="sim-field">
        <label class="sim-label" for="sim-m-result">Resultado <span aria-hidden="true">*</span></label>
        <select class="sim-input" id="sim-m-result" name="result" required aria-describedby="sim-m-result-error">
          <option value="">Selecciona un resultado</option>
          ${RESULTS.map((r) => `<option value="${r.code}">${esc(r.label)}</option>`).join('')}
        </select>
        <p class="sim-error" id="sim-m-result-error" data-error="result"></p>
      </div>
      <div class="sim-field" data-show-for="promesa-pago" hidden>
        <label class="sim-label" for="sim-m-pdate">Fecha de compromiso <span aria-hidden="true">*</span></label>
        <input class="sim-input" type="date" id="sim-m-pdate" name="promiseDate" min="${today}" max="${maxDate}" aria-describedby="sim-m-pdate-help sim-m-pdate-error" />
        <p class="sim-help" id="sim-m-pdate-help">Desde hoy hasta ${esc(formatDate(maxDate))}.</p>
        <p class="sim-error" id="sim-m-pdate-error" data-error="promiseDate"></p>
      </div>
      <div class="sim-field" data-show-for="promesa-pago" hidden>
        <label class="sim-label" for="sim-m-pamount">Valor del compromiso (COP) <span aria-hidden="true">*</span></label>
        <input class="sim-input" type="text" inputmode="numeric" id="sim-m-pamount" name="promiseAmount" autocomplete="off" aria-describedby="sim-m-pamount-help sim-m-pamount-error" />
        <p class="sim-help" id="sim-m-pamount-help">Máximo ${esc(formatCOP(v.totalBalance))} (saldo del cliente).</p>
        <p class="sim-error" id="sim-m-pamount-error" data-error="promiseAmount"></p>
      </div>
      <div class="sim-field" data-show-for="devolucion-llamada" hidden>
        <label class="sim-label" for="sim-m-callback">Fecha y hora de la nueva llamada <span aria-hidden="true">*</span></label>
        <input class="sim-input" type="datetime-local" id="sim-m-callback" name="callbackAt" min="${toDateTimeLocal(now)}" aria-describedby="sim-m-callback-error" />
        <p class="sim-error" id="sim-m-callback-error" data-error="callbackAt"></p>
      </div>
      <div class="sim-field">
        <label class="sim-label" for="sim-m-note">Observación <span aria-hidden="true">*</span></label>
        <textarea class="sim-input" id="sim-m-note" name="note" rows="4" maxlength="${NOTE_MAX}" aria-describedby="sim-m-note-count sim-m-note-error"></textarea>
        <p class="sim-help sim-counter" id="sim-m-note-count" data-counter>0 / ${NOTE_MAX} caracteres (mínimo ${NOTE_MIN})</p>
        <p class="sim-error" id="sim-m-note-error" data-error="note"></p>
      </div>
      <div class="sim-mgmt-form__actions">
        <button type="reset" class="sim-btn sim-btn--ghost">Limpiar</button>
        <button type="submit" class="sim-btn sim-btn--primary">${icon('Check')} Guardar gestión</button>
      </div>
    </form>`;
}

function panelTemplate(v: CustomerView, ctx: SimContext): string {
  return `
    <div class="sim-drawer-overlay" data-drawer-overlay></div>
    <section class="sim-drawer" role="dialog" aria-modal="true" aria-labelledby="sim-detail-title" data-sim-guide="clientes.detalle">
      <header class="sim-drawer__head">
        <div>
          <h2 id="sim-detail-title" class="sim-drawer__title" tabindex="-1">${esc(v.name)}</h2>
          <p class="sim-drawer__subtitle">${icon('IdCard')} Documento ${esc(v.document)}</p>
        </div>
        <button type="button" class="sim-icon-btn" data-action="close" aria-label="Cerrar detalle del cliente">${icon('X')}</button>
      </header>
      <div class="sim-drawer__body">
        <section aria-labelledby="sim-detail-data">
          <h3 id="sim-detail-data" class="sim-detail__section-title">${icon('UserRound')} Datos del cliente</h3>
          <div data-region="info">${infoTemplate(v, ctx)}</div>
        </section>
        <section aria-labelledby="sim-detail-oblig" data-sim-guide="clientes.detalle.obligaciones">
          <h3 id="sim-detail-oblig" class="sim-detail__section-title">${icon('Wallet')} Obligaciones (${v.obligations.length})</h3>
          <div data-region="obligations">${obligationsTemplate(v)}</div>
        </section>
        ${formTemplate(v)}
        <section aria-labelledby="sim-detail-history" data-sim-guide="clientes.detalle.historial">
          <h3 id="sim-detail-history" class="sim-detail__section-title">${icon('Clock')} Historial de interacciones</h3>
          <div data-region="history">${historyTemplate(v)}</div>
        </section>
      </div>
    </section>`;
}

const FIELD_ORDER: (keyof ManagementDraft)[] = ['result', 'promiseDate', 'promiseAmount', 'callbackAt', 'note'];

export function openCustomerDetail(ctx: SimContext, customerId: string, opener: HTMLElement | null): Cleanup {
  const initial = ctx.findView(customerId);
  if (!initial) return () => undefined;

  const host = document.createElement('div');
  host.className = 'sim-drawer-host';
  host.innerHTML = panelTemplate(initial, ctx);
  hydrateIcons(host);
  ctx.root.append(host);

  const drawer = qs(host, '.sim-drawer');
  const form = qs<HTMLFormElement>(host, '.sim-mgmt-form');
  const resultSelect = qs<HTMLSelectElement>(form, '[name="result"]');
  const note = qs<HTMLTextAreaElement>(form, '[name="note"]');
  const counter = qs(form, '[data-counter]');
  const summary = qs(form, '[data-summary]');

  const current = (): CustomerView => ctx.findView(customerId) ?? initial;

  const renderRegion = (name: 'info' | 'obligations' | 'history'): void => {
    const region = qs(host, `[data-region="${name}"]`);
    const v = current();
    region.innerHTML = name === 'info' ? infoTemplate(v, ctx) : name === 'obligations' ? obligationsTemplate(v) : historyTemplate(v);
    hydrateIcons(region);
  };

  const syncConditional = (): void => {
    for (const field of qsa(form, '[data-show-for]')) field.hidden = field.dataset.showFor !== resultSelect.value;
  };

  const updateCounter = (): void => {
    const len = note.value.trim().length;
    counter.textContent = `${len} / ${NOTE_MAX} caracteres (mínimo ${NOTE_MIN})`;
    counter.classList.toggle('is-short', len > 0 && len < NOTE_MIN);
  };

  const showErrors = (errors: ManagementErrors): void => {
    for (const key of FIELD_ORDER) {
      const message = errors[key] ?? '';
      const slot = form.querySelector<HTMLElement>(`[data-error="${key}"]`);
      const input = form.querySelector<HTMLElement>(`[name="${key}"]`);
      if (slot) slot.textContent = message;
      if (input) {
        if (message) input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
      }
    }
    const count = Object.keys(errors).length;
    summary.textContent = count ? `Revisa ${count === 1 ? 'el campo marcado' : `los ${count} campos marcados`}.` : '';
  };

  const close = (): void => {
    cleanup();
  };

  const cleanup = combine([
    () => {
      host.remove();
      // Si la tabla se volvió a dibujar, el botón original ya no existe: se busca su reemplazo.
      const target = opener?.isConnected
        ? opener
        : ctx.root.querySelector<HTMLElement>(`[data-action="manage"][data-customer="${customerId}"]`) ??
          ctx.root.querySelector<HTMLElement>('#sim-main');
      target?.focus();
    },
    trapFocus(drawer),
    on(host, 'keydown', (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    }),
    on(host, 'click', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-drawer-overlay]')) {
        close();
        return;
      }
      const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
      if (action === 'close') close();
      else if (action === 'call') {
        ctx.store.startCall(customerId);
        ctx.toast('Llamada simulada en curso. No se marca ningún número real.', 'info');
        qs<HTMLElement>(host, '[data-action="hangup"]').focus();
      } else if (action === 'hangup') {
        const record = ctx.store.endCall();
        if (record) ctx.toast(`Llamada finalizada (${formatDuration(record.durationSec)}). Registrada en Llamadas.`, 'success');
        host.querySelector<HTMLElement>('[data-action="call"]')?.focus();
      }
    }),
    on(resultSelect, 'change', syncConditional),
    on(note, 'input', updateCounter),
    on(form, 'reset', () => {
      setTimeout(() => {
        syncConditional();
        updateCounter();
        showErrors({});
      });
    }),
    on(form, 'submit', (event) => {
      event.preventDefault();
      const value = (name: string): string => qs<HTMLInputElement>(form, `[name="${name}"]`).value;
      const draft: ManagementDraft = {
        result: resultSelect.value as ResultCode | '',
        note: note.value,
        promiseDate: value('promiseDate'),
        promiseAmount: value('promiseAmount'),
        callbackAt: value('callbackAt'),
      };
      const errors = validateManagement(draft, current().totalBalance, new Date());
      showErrors(errors);
      const first = FIELD_ORDER.find((k) => errors[k]);
      if (first) {
        form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
        return;
      }
      const result = draft.result as ResultCode;
      ctx.store.addManagement({
        customerId,
        result,
        note: draft.note.trim(),
        ...(result === 'promesa-pago'
          ? { promiseDate: draft.promiseDate, promiseAmount: parseAmount(draft.promiseAmount) }
          : {}),
        ...(result === 'devolucion-llamada' ? { callbackAt: new Date(draft.callbackAt).toISOString() } : {}),
      });
      form.reset();
      ctx.toast(`Gestión registrada: ${resultMeta(result).label}. Último perfil: ${profileLabel(result)}.`, 'success');
      qs(host, '#sim-detail-history').scrollIntoView({ block: 'nearest' });
    }),
    ctx.store.subscribe((s, prev) => {
      if (s.managements !== prev.managements) {
        renderRegion('info');
        renderRegion('obligations');
        renderRegion('history');
      } else if (s.activeCall !== prev.activeCall) {
        renderRegion('info');
      }
    }),
  ]);

  syncConditional();
  qs(host, '#sim-detail-title').focus();
  return cleanup;
}
