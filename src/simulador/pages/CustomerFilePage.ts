// Ficha del cliente («G.C - cédula») de Control Next: información personal, datos de la obligación,
// registro de la gestión (tipificación) e histórico. Todo es ficticio y queda en este navegador.

import { mountAppShell } from '../components/AppShell';
import { campaignHeadTemplate, handleCampaignHeadClick } from '../components/CampaignHead';
import { hydrateIcons, icon } from '../components/icons';
import { openModal } from '../components/Modal';
import { profileChip } from '../components/StatusBadge';
import type { SimContext } from '../context';
import { ACTIONS, CONTACTS, effectLabel, PRIORITIES, REASONS, RESULTS, obligationStatusLabel } from '../data/catalogs';
import { applyCustomerFilters } from '../domain/customer-filters';
import {
  hms,
  historyRows,
  lastAgreement,
  obligationFigures,
  pageHistory,
  splitDuration,
  stableHash,
} from '../domain/control-next';
import { NOTE_MAX, PROMISE_MAX_DAYS, parseAmount, validateManagement, type ManagementDraft } from '../domain/management-form';
import { statusMeta } from '../domain/management-status';
import type { ContactType, CustomerView, ManagementAction, Portfolio, ResultCode } from '../types/simulator';
import { addDays, startOfDay, toDateKey, toDateTimeLocal } from '../utils/dates';
import { combine, on, qs, type Cleanup } from '../utils/dom';
import { esc, formatCOP, formatDate, formatDateTime } from '../utils/format';

const HISTORY_SIZES = [5, 10, 25];

function money(value: number): string {
  return value ? formatCOP(value).replace(/\s/g, ' ') : '$ 0';
}

function infoTemplate(v: CustomerView): string {
  const agreement = lastAgreement(v);
  const cell = (label: string, value: string, guide = ''): string =>
    `<div class="sim-kv"${guide ? ` data-sim-guide="${guide}"` : ''}><span class="sim-kv__k">${label}</span><span class="sim-kv__v">${value}</span></div>`;
  return `
    <div class="sim-kv-grid">
      ${cell('Nombre', esc(v.name.toUpperCase()))}
      ${cell('Identificacion', esc(v.document))}
      ${cell('Ciudad', esc(v.city))}
      ${cell('Fecha De Gestion', esc(v.lastManagement ? toDateKey(new Date(v.lastManagement.date)) : ''))}
      ${cell('Ultimo Perfil', profileChip(v.lastProfile), 'ficha.perfiles')}
      ${cell('Mejor Perfil', profileChip(v.bestProfile))}
      ${cell('Asesor', esc(v.advisor))}
      ${cell('Fecha Agendado', `<input class="sim-kv__input" type="datetime-local" aria-label="Fecha agendado" data-agenda min="${toDateTimeLocal(new Date())}" />`, 'ficha.agenda')}
      ${cell('Fecha Pago', esc(agreement?.promiseDate ?? ''))}
      ${cell('Valor Pago', esc(agreement ? money(agreement.promiseAmount ?? 0) : ''))}
    </div>`;
}

function dataTemplate(v: CustomerView, now: Date): string {
  return `
    <div class="sim-table-wrap" tabindex="0" role="region" aria-label="Obligaciones del cliente">
      <table class="sim-table sim-table--gold">
        <thead><tr>
          <th scope="col">Número de Cliente</th><th scope="col">Cuenta</th><th scope="col">Edad Cobranza</th><th scope="col">Valor Vencido</th>
          <th scope="col">Fecha Inicio</th><th scope="col">Fecha fin</th><th scope="col">Val. Int Mora</th><th scope="col">Saldo Total</th>
          <th scope="col">Honorarios</th><th scope="col">Referencias</th>
        </tr></thead>
        <tbody>
          ${v.obligations
            .map((o) => {
              const f = obligationFigures(v, o, now);
              return `<tr>
                <td>${esc(f.clientNumber)}</td><td>${esc(f.account)}</td><td>${esc(f.collectionAge)}</td><td>${esc(money(f.overdue))}</td>
                <td>${esc(f.startDate)}</td><td>${esc(f.endDate)}</td><td>${esc(money(f.lateInterest))}</td><td><strong>${esc(money(f.totalBalance))}</strong></td>
                <td>${esc(money(f.fees))}</td>
                <td><button type="button" class="sim-round-btn" data-action="references" aria-label="Ver referencias de la obligación ${esc(f.account)}">${icon('Info')}</button></td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    </div>`;
}

function extraTemplate(v: CustomerView): string {
  const priority = PRIORITIES.find((p) => p.code === v.priority)?.label ?? v.priority;
  return `
    <div class="sim-table-wrap"><table class="sim-table sim-table--gold">
      <thead><tr><th scope="col">Producto</th><th scope="col">Obligación</th><th scope="col">Días de mora</th><th scope="col">Estado</th><th scope="col">Prioridad</th><th scope="col">Email</th></tr></thead>
      <tbody>${v.obligations
        .map((o) => `<tr><td>${esc(o.product)}</td><td>${esc(o.id.toUpperCase())}</td><td>${o.daysPastDue}</td><td>${esc(obligationStatusLabel(o.status))}</td><td>${esc(priority)}</td><td>${esc(v.email)}</td></tr>`)
        .join('')}</tbody>
    </table></div>`;
}

function agreementsTemplate(v: CustomerView): string {
  const today = toDateKey(new Date());
  const list = v.managements.filter((m) => m.result === 'promesa-pago');
  if (!list.length) return '<p class="sim-help sim-pad">Este cliente no tiene acuerdos de pago registrados.</p>';
  return `
    <div class="sim-table-wrap"><table class="sim-table sim-table--compact">
      <thead><tr><th scope="col">Fecha del acuerdo</th><th scope="col">Fecha de pago</th><th scope="col">Valor</th><th scope="col">Asesor</th><th scope="col">Estado</th></tr></thead>
      <tbody>${[...list]
        .reverse()
        .map((m) => `<tr><td>${esc(formatDateTime(m.date))}</td><td>${esc(formatDate(m.promiseDate))}</td><td>${esc(money(m.promiseAmount ?? 0))}</td><td>${esc(m.advisor)}</td>
          <td>${(m.promiseDate ?? '') >= today ? '<span class="sim-pill sim-pill--ok">Vigente</span>' : '<span class="sim-pill sim-pill--late">Vencido</span>'}</td></tr>`)
        .join('')}</tbody>
    </table></div>`;
}

function formTemplate(v: CustomerView): string {
  const now = new Date();
  const today = toDateKey(now);
  const maxDate = toDateKey(addDays(startOfDay(now), PROMISE_MAX_DAYS));
  const phones = [v.phone.replace(/\s/g, ''), `60${String(stableHash(v.id) % 10_000_000).padStart(8, '1')}`.slice(0, 10)];
  return `
    <form class="sim-cn-form" novalidate aria-label="Nueva gestión">
      <p class="sim-cn-form__title">${icon('SquarePen')} Nueva Gestión</p>
      <div class="sim-cn-form__time-row">
        <div data-sim-guide="ficha.tiempo">
          <p class="sim-label">Tiempo de Gestión</p>
          <div class="sim-cn-time" aria-live="off">
            <input class="sim-input" readonly data-time="h" aria-label="Horas" value="0" /><span>:</span>
            <input class="sim-input" readonly data-time="m" aria-label="Minutos" value="0" /><span>:</span>
            <input class="sim-input" readonly data-time="s" aria-label="Segundos" value="0" />
          </div>
        </div>
        <div class="sim-cn-tools" data-sim-guide="ficha.botones">
          <button type="button" class="sim-btn sim-btn--primary" data-action="demographics">${icon('IdCard')} Demograficos</button>
          <button type="button" class="sim-btn sim-btn--success" data-action="payments">${icon('Banknote')} Pagos</button>
          <button type="button" class="sim-btn sim-btn--sky" data-action="redial">${icon('PhoneForwarded')} <span data-redial-label>Remarcar</span></button>
        </div>
      </div>
      <p class="sim-form-summary" role="alert" aria-live="assertive" data-summary></p>
      <div data-sim-guide="ficha.nota">
        <label class="sim-visually-hidden" for="sim-cn-note">Nueva gestión de llamadas</label>
        <textarea class="sim-input sim-cn-note" id="sim-cn-note" name="note" rows="4" maxlength="${NOTE_MAX}" placeholder="Nueva Gestion de LLamadas"></textarea>
        <p class="sim-error" data-error="note"></p>
      </div>
      <div class="sim-cn-grid" data-sim-guide="ficha.tipificacion">
        <div class="sim-field">
          <label class="sim-label" for="sim-cn-action">Accion:</label>
          <select class="sim-input" id="sim-cn-action" name="action">
            <option value="">Seleccione</option>
            ${ACTIONS.map((a) => `<option value="${a.code}">${esc(a.label)}</option>`).join('')}
          </select>
          <p class="sim-error" data-error="action"></p>
        </div>
        <div class="sim-field">
          <label class="sim-label" for="sim-cn-phone">Teléfono:</label>
          <input class="sim-input" id="sim-cn-phone" name="phone" list="sim-cn-phones" inputmode="tel" autocomplete="off" />
          <datalist id="sim-cn-phones">${phones.map((p) => `<option value="${esc(p)}"></option>`).join('')}</datalist>
        </div>
        <div class="sim-field">
          <span class="sim-label">Gestión Localización</span>
          <label class="sim-cn-check"><input type="checkbox" name="location" /> <span class="sim-help">Marca si la gestión fue para ubicar al titular</span></label>
        </div>
        <div class="sim-field">
          <label class="sim-label" for="sim-cn-result">Efecto:</label>
          <select class="sim-input" id="sim-cn-result" name="result">
            <option value="">Seleccione</option>
            ${RESULTS.map((r) => `<option value="${r.code}">${esc(effectLabel(r.code))}</option>`).join('')}
          </select>
          <p class="sim-error" data-error="result"></p>
        </div>
        <div class="sim-field">
          <label class="sim-label" for="sim-cn-contact">Contacto:</label>
          <select class="sim-input" id="sim-cn-contact" name="contact">
            <option value="">Seleccione</option>
            ${CONTACTS.map((c) => `<option value="${c.code}" title="${esc(c.help)}">${esc(c.label)}</option>`).join('')}
          </select>
          <p class="sim-error" data-error="contact"></p>
        </div>
        <div class="sim-field">
          <label class="sim-label" for="sim-cn-reason">Motivo N.P.:</label>
          <select class="sim-input" id="sim-cn-reason" name="reason" disabled><option value="">Primero elige el efecto</option></select>
          <p class="sim-error" data-error="reason"></p>
        </div>
        <div class="sim-field" data-show-for="promesa-pago" hidden>
          <label class="sim-label" for="sim-cn-pdate">Fecha de pago:</label>
          <input class="sim-input" type="date" id="sim-cn-pdate" name="promiseDate" min="${today}" max="${maxDate}" />
          <p class="sim-error" data-error="promiseDate"></p>
        </div>
        <div class="sim-field" data-show-for="promesa-pago" hidden>
          <label class="sim-label" for="sim-cn-pamount">Valor del acuerdo:</label>
          <input class="sim-input" id="sim-cn-pamount" name="promiseAmount" inputmode="numeric" autocomplete="off" placeholder="Máximo ${esc(formatCOP(v.totalBalance))}" />
          <p class="sim-error" data-error="promiseAmount"></p>
        </div>
        <div class="sim-field" data-show-for="devolucion-llamada" hidden>
          <label class="sim-label" for="sim-cn-callback">Volver a llamar el:</label>
          <input class="sim-input" type="datetime-local" id="sim-cn-callback" name="callbackAt" min="${toDateTimeLocal(now)}" />
          <p class="sim-error" data-error="callbackAt"></p>
        </div>
      </div>
      <div class="sim-cn-actions" data-sim-guide="ficha.guardar">
        <button type="button" class="sim-btn sim-btn--teal" data-action="voicemail">${icon('CirclePlay')} Buzon</button>
        <button type="reset" class="sim-btn sim-btn--secondary">${icon('Ban')} Cancelar</button>
        <button type="submit" class="sim-btn sim-btn--primary">${icon('SquarePen')} Guardar</button>
      </div>
    </form>`;
}

function historyTemplate(v: CustomerView, text: string, size: number, page: number): string {
  const p = pageHistory(historyRows(v), text, size, page);
  const rows = p.items.length
    ? p.items
        .map(
          (r) => `<tr class="${r.ownPractice ? 'is-own' : ''}">
            <td>${esc(formatDateTime(r.date))}</td><td>${esc(r.user)}</td><td>${esc(r.action)}</td><td>${esc(r.effect)}</td><td>${esc(r.contact)}</td>
            <td>${esc(r.phone)}</td><td class="sim-cn-hist__note">${esc(r.note)}</td><td>${hms(r.managementSec)}</td><td>${hms(r.callSec)}</td>
            <td>${esc(r.reason)}</td><td>${esc(money(r.promise))}</td>
            <td><button type="button" class="sim-play" data-action="audio" aria-label="Escuchar la grabación">${icon('CirclePlay')}</button></td>
          </tr>`,
        )
        .join('')
    : `<tr><td colspan="12" class="sim-help sim-pad">${text ? 'Ningún registro coincide con la búsqueda.' : 'Este cliente todavía no tiene gestiones.'}</td></tr>`;
  return `
    <div class="sim-table-wrap" tabindex="0" role="region" aria-label="Histórico de gestiones">
      <table class="sim-table sim-table--cn sim-cn-hist">
        <thead><tr>
          <th scope="col">Fecha / Hora</th><th scope="col">Usuario</th><th scope="col">Acción</th><th scope="col">Efecto</th><th scope="col">Contacto</th>
          <th scope="col">Teléfono</th><th scope="col">Gestión</th><th scope="col">Tiempo Gestión</th><th scope="col">Tiempo Llamada</th>
          <th scope="col">Motivo N.P.</th><th scope="col">Promesa</th><th scope="col">Audio</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="sim-cn-hist__foot">
      <p>Mostrando registros del ${p.from} al ${p.to} de un total de ${p.total} registros</p>
      <div class="sim-pager">
        <button type="button" data-action="hist-prev" ${p.page <= 1 ? 'disabled' : ''}>Anterior</button>
        <span class="is-current">${p.page}</span>
        <button type="button" data-action="hist-next" ${p.page >= p.totalPages ? 'disabled' : ''}>Siguiente</button>
      </div>
    </div>`;
}

export function renderCustomerFilePage(ctx: SimContext, container: HTMLElement, portfolio: Portfolio, customerId: string): Cleanup {
  const initial = ctx.findView(customerId);
  if (!initial || initial.portfolioId !== portfolio.id) {
    ctx.toast('El cliente no existe en esta campaña. Búscalo con la lupa.', 'warning');
    ctx.navigate(`/cartera/${portfolio.id}/clientes`);
    return () => undefined;
  }
  ctx.store.setOpenCustomer(portfolio.id, customerId);
  ctx.setTitle(`G.C - ${initial.document}`, portfolio);
  const shell = mountAppShell(ctx, container, { portfolio, active: 'clientes', topbar: 'clientes', rail: true });
  const current = (): CustomerView => ctx.findView(customerId) ?? initial;

  // Posición dentro de la lista filtrada de la campaña (Anterior / Siguiente).
  const list = applyCustomerFilters(ctx.getViews(portfolio.id), ctx.store.getFilters(portfolio.id)).map((v) => v.id);
  const order = list.includes(customerId) ? list : [customerId];
  const index = order.indexOf(customerId);

  shell.main.innerHTML = `
    <div class="sim-page sim-file">
      ${campaignHeadTemplate(ctx, portfolio, 'ficha')}
      <div class="sim-file__sticky" data-sticky hidden aria-hidden="true">
        <span class="sim-file__pill">${esc(initial.name.toUpperCase())}<span>C.C.: ${esc(initial.document)}</span></span>
        <span class="sim-file__sticky-actions">
          <button type="button" class="sim-btn sim-btn--teal sim-btn--sm" data-proxy="voicemail" tabindex="-1">${icon('CirclePlay')} Buzon</button>
          <button type="button" class="sim-btn sim-btn--secondary sim-btn--sm" data-proxy="reset" tabindex="-1">${icon('Ban')} Cancelar</button>
          <button type="button" class="sim-btn sim-btn--primary sim-btn--sm" data-proxy="submit" tabindex="-1">${icon('SquarePen')} Guardar</button>
        </span>
      </div>
      <section class="sim-card sim-file__bar" data-sim-guide="ficha.encabezado">
        <h1 class="sim-file__campaign">${esc(portfolio.name)}</h1>
        <p class="sim-file__count" aria-label="Cliente ${index + 1} de ${order.length}">${index + 1} / ${order.length}</p>
        <div class="sim-btn-group">
          <button type="button" class="sim-btn sim-btn--dark" data-action="prev-customer" ${index <= 0 ? 'disabled' : ''}>${icon('ArrowLeft')} Anterior</button>
          <button type="button" class="sim-btn sim-btn--dark" data-action="next-customer" ${index >= order.length - 1 ? 'disabled' : ''}>Siguiente ${icon('ArrowRight')}</button>
        </div>
      </section>
      <section class="sim-card sim-file__info" data-sim-guide="ficha.info" aria-labelledby="sim-file-info">
        <div class="sim-file__info-aside">
          <h2 id="sim-file-info" class="sim-file__info-title">Información Personal</h2>
          <svg class="sim-folder" viewBox="0 0 120 100" aria-hidden="true"><path d="M6 18h38l10 10h60v62H6z" fill="#2ba3b5"/><rect x="22" y="30" width="80" height="62" rx="4" fill="#6fc6d4"/><rect x="36" y="40" width="52" height="52" fill="#e9f4f6"/><circle cx="62" cy="58" r="10" fill="#f2c8a0"/><path d="M50 56c0-12 24-12 24 0-4-4-20-4-24 0z" fill="#3b3b3b"/><path d="M44 92c2-14 34-14 36 0z" fill="#8e6fd8"/></svg>
          <p class="sim-help">Estado: ${esc(statusMeta(initial.status).label)}</p>
        </div>
        <div data-region="info">${infoTemplate(initial)}</div>
      </section>
      <section class="sim-card" data-sim-guide="ficha.datos">
        <div class="sim-subtabs" role="tablist" aria-label="Datos del cliente">
          <button type="button" role="tab" class="is-active" aria-selected="true" data-subtab="datos">Datos</button>
          <button type="button" role="tab" aria-selected="false" data-subtab="adicionales">Adicionales</button>
        </div>
        <div data-subpanel="datos">${dataTemplate(initial, new Date())}</div>
        <div data-subpanel="adicionales" hidden>${extraTemplate(initial)}</div>
      </section>
      <section class="sim-card" data-sim-guide="ficha.gestion">
        <div class="sim-cn-tabs-row">
          <div class="sim-pills" role="tablist" aria-label="Gestión y acuerdos">
            <button type="button" role="tab" class="is-active" aria-selected="true" data-gtab="gestion">Gestion</button>
            <button type="button" role="tab" aria-selected="false" data-gtab="acuerdos">Acuerdos</button>
          </div>
          <button type="button" class="sim-mic" data-action="mic" aria-label="Grabación de la llamada" data-sim-guide="ficha.mic">${icon('Mic')}</button>
        </div>
        <div data-gpanel="gestion">${formTemplate(initial)}</div>
        <div data-gpanel="acuerdos" hidden data-region="agreements">${agreementsTemplate(initial)}</div>
      </section>
      <section class="sim-card" data-sim-guide="ficha.historico" aria-labelledby="sim-hist-title">
        <div class="sim-hist-tab"><h2 id="sim-hist-title">${icon('ClipboardList')} Historico</h2></div>
        <div class="sim-cn-hist__tools">
          <label>Mostrar <select class="sim-input" data-hist-size>${HISTORY_SIZES.map((n) => `<option value="${n}">${n}</option>`).join('')}</select> registros</label>
          <label>Buscar: <input class="sim-input" type="search" data-hist-search autocomplete="off" /></label>
        </div>
        <div data-region="history"></div>
      </section>
    </div>`;
  hydrateIcons(shell.main);

  const form = qs<HTMLFormElement>(shell.main, '.sim-cn-form');
  const summary = qs(form, '[data-summary]');
  const field = <T extends HTMLElement = HTMLInputElement>(name: string): T => qs<T>(form, `[name="${name}"]`);
  const resultSelect = field<HTMLSelectElement>('result');
  const reasonSelect = field<HTMLSelectElement>('reason');
  const historyRegion = qs(shell.main, '[data-region="history"]');
  const sizeSelect = qs<HTMLSelectElement>(shell.main, '[data-hist-size]');
  const searchInput = qs<HTMLInputElement>(shell.main, '[data-hist-search]');
  let histPage = 1;

  const renderHistory = (): void => {
    historyRegion.innerHTML = historyTemplate(current(), searchInput.value, Number(sizeSelect.value), histPage);
    hydrateIcons(historyRegion);
  };
  renderHistory();

  // Tiempo de gestión: corre desde que se abre la ficha (o desde el último guardado).
  let startedAt = Date.now();
  const tick = (): void => {
    const [h, m, s] = splitDuration((Date.now() - startedAt) / 1000);
    qs<HTMLInputElement>(form, '[data-time="h"]').value = String(h);
    qs<HTMLInputElement>(form, '[data-time="m"]').value = String(m);
    qs<HTMLInputElement>(form, '[data-time="s"]').value = String(s);
  };
  const timer = setInterval(tick, 1000);

  // Llamada simulada con «Remarcar»: su duración se guarda con la siguiente gestión.
  let lastCallSec = 0;
  const syncRedial = (): void => {
    const inCall = ctx.store.get().activeCall?.customerId === customerId;
    const btn = qs<HTMLButtonElement>(form, '[data-action="redial"]');
    btn.classList.toggle('sim-btn--danger', inCall);
    qs(btn, '[data-redial-label]').textContent = inCall ? 'Colgar' : 'Remarcar';
  };

  const syncConditional = (): void => {
    const code = resultSelect.value as ResultCode | '';
    for (const el of form.querySelectorAll<HTMLElement>('[data-show-for]')) el.hidden = el.dataset.showFor !== code;
    reasonSelect.disabled = !code;
    reasonSelect.innerHTML = code
      ? `<option value="">Seleccione</option>${REASONS[code].map((r) => `<option>${esc(r)}</option>`).join('')}`
      : '<option value="">Primero elige el efecto</option>';
  };

  const setError = (name: string, message = ''): void => {
    const slot = form.querySelector<HTMLElement>(`[data-error="${name}"]`);
    if (slot) slot.textContent = message;
    const input = form.querySelector<HTMLElement>(`[name="${name}"]`);
    if (input) {
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
  };

  const resetForm = (): void => {
    form.reset();
    for (const name of ['note', 'action', 'result', 'contact', 'reason', 'promiseDate', 'promiseAmount', 'callbackAt']) setError(name);
    summary.textContent = '';
    setTimeout(syncConditional);
  };

  const save = (data: Parameters<typeof ctx.store.addManagement>[0], message: string): void => {
    const callSec = ctx.store.get().activeCall?.customerId === customerId ? (ctx.store.endCall()?.durationSec ?? 0) : lastCallSec;
    ctx.store.addManagement({ ...data, managementSec: Math.round((Date.now() - startedAt) / 1000), callSec });
    lastCallSec = 0;
    startedAt = Date.now();
    tick();
    resetForm();
    histPage = 1;
    ctx.toast(message, 'success');
  };

  const submit = (): void => {
    const draft: ManagementDraft = {
      result: resultSelect.value as ResultCode | '',
      note: field<HTMLTextAreaElement>('note').value,
      promiseDate: field('promiseDate').value,
      promiseAmount: field('promiseAmount').value,
      callbackAt: field('callbackAt').value,
    };
    const errors: Record<string, string> = { ...validateManagement(draft, current().totalBalance, new Date()) };
    if (errors.result) errors.result = 'Selecciona el efecto (resultado) de la gestión.';
    if (errors.note) errors.note = `${errors.note} Escribe qué dijo el titular, p. ej.: «TT INDICA QUE…».`;
    if (!field<HTMLSelectElement>('action').value) errors.action = 'Selecciona la acción.';
    if (!field<HTMLSelectElement>('contact').value) errors.contact = 'Selecciona el tipo de contacto.';
    if (draft.result && !reasonSelect.value) errors.reason = 'Selecciona el motivo.';
    for (const name of ['note', 'action', 'result', 'contact', 'reason', 'promiseDate', 'promiseAmount', 'callbackAt']) setError(name, errors[name]);
    const count = Object.keys(errors).length;
    summary.textContent = count ? `Revisa ${count === 1 ? 'el campo marcado' : `los ${count} campos marcados`} antes de guardar.` : '';
    if (count) {
      form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    const result = draft.result as ResultCode;
    save(
      {
        customerId,
        result,
        note: draft.note.trim(),
        action: field<HTMLSelectElement>('action').value as ManagementAction,
        contact: field<HTMLSelectElement>('contact').value as ContactType,
        reason: reasonSelect.value,
        phone: field('phone').value.trim() || current().phone,
        ...(result === 'promesa-pago' ? { promiseDate: draft.promiseDate, promiseAmount: parseAmount(draft.promiseAmount) } : {}),
        ...(result === 'devolucion-llamada' ? { callbackAt: new Date(draft.callbackAt).toISOString() } : {}),
      },
      `Gestión guardada: ${effectLabel(result)}. Quedó en el Histórico.`,
    );
  };

  const voicemail = (): void => {
    const phone = field('phone').value.trim() || current().phone.replace(/\s/g, '');
    save(
      { customerId, result: 'no-contesta', note: `${phone} // SE MARCA Y CAE A BUZÓN DE VOZ, SE DEJA MENSAJE`, action: 'hacer-llamada', contact: 'sin-contacto', reason: 'BUZÓN DE VOZ', phone },
      'Buzón registrado: NO CONTESTA · BUZÓN DE VOZ.',
    );
  };

  // Barra fija con el nombre y los botones cuando la información personal sale de la vista.
  const sticky = qs(shell.main, '[data-sticky]');
  const observer = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(([entry]) => { sticky.hidden = !!entry?.isIntersecting; }, { threshold: 0 })
    : null;
  observer?.observe(qs(shell.main, '.sim-file__info'));

  const showReferences = (): void => {
    const v = current();
    const h = stableHash(v.id);
    void openModal(ctx.root, {
      title: 'Referencias',
      body: `<table class="sim-table sim-table--compact"><thead><tr><th>Tipo</th><th>Nombre</th><th>Teléfono</th></tr></thead><tbody>
        <tr><td>Familiar</td><td>REFERENCIA FAMILIAR ${h % 90 + 10}</td><td>31${h % 10} 555 0${String(h % 900 + 100)}</td></tr>
        <tr><td>Personal</td><td>REFERENCIA PERSONAL ${(h >> 3) % 90 + 10}</td><td>30${(h >> 2) % 10} 555 0${String((h >> 4) % 900 + 100)}</td></tr>
      </tbody></table><p class="sim-help">Datos ficticios. Las referencias se usan para ubicar al titular, nunca para cobrarle a un tercero.</p>`,
      wide: true,
    });
  };

  const showDemographics = (): void => {
    const v = current();
    const h = stableHash(v.document);
    void openModal(ctx.root, {
      title: 'Demográficos',
      body: `<dl class="sim-dl">
        <div><dt>Nombre</dt><dd>${esc(v.name.toUpperCase())}</dd></div>
        <div><dt>Identificación</dt><dd>C.C. ${esc(v.document)}</dd></div>
        <div><dt>Teléfono principal</dt><dd>${esc(v.phone)}</dd></div>
        <div><dt>Email</dt><dd>${esc(v.email)}</dd></div>
        <div><dt>Ciudad</dt><dd>${esc(v.city)}</dd></div>
        <div><dt>Dirección</dt><dd>CALLE ${h % 150 + 1} # ${h % 80 + 2} - ${h % 60 + 10}</dd></div>
        <div><dt>Codeudor</dt><dd>Sin codeudor registrado</dd></div>
      </dl><p class="sim-help">Aquí actualizas los datos de contacto cuando el titular te da un número o correo nuevo.</p>`,
    });
  };

  const showPayments = (): void => {
    const pays = ctx.dataset.payments.filter((p) => p.customerId === customerId).sort((a, b) => b.date.localeCompare(a.date));
    void openModal(ctx.root, {
      title: 'Pagos',
      body: pays.length
        ? `<table class="sim-table sim-table--compact"><thead><tr><th>Fecha</th><th>Valor</th></tr></thead><tbody>${pays
            .map((p) => `<tr><td>${esc(formatDateTime(p.date))}</td><td>${esc(money(p.amount))}</td></tr>`)
            .join('')}</tbody></table>`
        : '<p>El cliente no registra pagos. Antes de negociar, revisa siempre esta ventana para no cobrar algo que ya pagó.</p>',
    });
  };

  syncConditional();
  syncRedial();
  tick();

  return combine([
    shell.cleanup,
    () => clearInterval(timer),
    () => observer?.disconnect(),
    on(shell.main, 'click', (event) => {
      if (handleCampaignHeadClick(ctx, portfolio, event)) {
        event.preventDefault();
        return;
      }
      const target = event.target as HTMLElement;
      const proxy = target.closest<HTMLElement>('[data-proxy]')?.dataset.proxy;
      if (proxy === 'submit') return submit();
      if (proxy === 'reset') return resetForm();
      if (proxy === 'voicemail') return voicemail();
      const sub = target.closest<HTMLElement>('[data-subtab]')?.dataset.subtab;
      if (sub) {
        for (const b of shell.main.querySelectorAll<HTMLElement>('[data-subtab]')) {
          b.classList.toggle('is-active', b.dataset.subtab === sub);
          b.setAttribute('aria-selected', String(b.dataset.subtab === sub));
        }
        for (const p of shell.main.querySelectorAll<HTMLElement>('[data-subpanel]')) p.hidden = p.dataset.subpanel !== sub;
        return;
      }
      const gtab = target.closest<HTMLElement>('[data-gtab]')?.dataset.gtab;
      if (gtab) {
        for (const b of shell.main.querySelectorAll<HTMLElement>('[data-gtab]')) {
          b.classList.toggle('is-active', b.dataset.gtab === gtab);
          b.setAttribute('aria-selected', String(b.dataset.gtab === gtab));
        }
        for (const p of shell.main.querySelectorAll<HTMLElement>('[data-gpanel]')) p.hidden = p.dataset.gpanel !== gtab;
        return;
      }
      switch (target.closest<HTMLElement>('[data-action]')?.dataset.action) {
        case 'prev-customer':
          if (index > 0) ctx.navigate(`/cartera/${portfolio.id}/cliente/${order[index - 1]}`);
          break;
        case 'next-customer':
          if (index < order.length - 1) ctx.navigate(`/cartera/${portfolio.id}/cliente/${order[index + 1]}`);
          break;
        case 'references':
          showReferences();
          break;
        case 'demographics':
          showDemographics();
          break;
        case 'payments':
          showPayments();
          break;
        case 'redial':
          if (ctx.store.get().activeCall?.customerId === customerId) {
            const record = ctx.store.endCall();
            lastCallSec = record?.durationSec ?? 0;
            ctx.toast(`Llamada finalizada (${hms(lastCallSec)}). Ahora tipifica y guarda la gestión.`, 'info');
          } else if (ctx.store.get().activeCall) {
            ctx.toast('Ya hay otra llamada en curso. Cuélgala primero.', 'warning');
          } else {
            ctx.store.startCall(customerId);
            if (!field('phone').value) field('phone').value = current().phone.replace(/\s/g, '');
            ctx.toast('Marcando al titular… (llamada simulada, no se marca ningún número real).', 'info');
          }
          break;
        case 'voicemail':
          voicemail();
          break;
        case 'mic':
          ctx.toast('En Control Next las llamadas se graban. En la práctica no se graba audio.', 'info');
          break;
        case 'audio':
          ctx.toast('Aquí escucharías la grabación de esa llamada (no disponible en la práctica).', 'info');
          break;
        case 'hist-prev':
          histPage -= 1;
          renderHistory();
          break;
        case 'hist-next':
          histPage += 1;
          renderHistory();
          break;
      }
    }),
    on(form, 'submit', (event) => {
      event.preventDefault();
      submit();
    }),
    on(form, 'reset', () => setTimeout(resetForm)),
    on(resultSelect, 'change', () => {
      syncConditional();
      // Sugerencia: una promesa casi siempre es contacto directo.
      const contact = field<HTMLSelectElement>('contact');
      if (!contact.value && resultSelect.value === 'promesa-pago') contact.value = 'directo';
    }),
    on(field('phone'), 'change', () => {
      const note = field<HTMLTextAreaElement>('note');
      const phone = field('phone').value.trim();
      if (phone && !note.value.trim()) note.value = `${phone} // `;
    }),
    on(sizeSelect, 'change', () => {
      histPage = 1;
      renderHistory();
    }),
    on(searchInput, 'input', () => {
      histPage = 1;
      renderHistory();
    }),
    ctx.store.subscribe((s, prev) => {
      if (s.managements !== prev.managements) {
        const v = current();
        const info = qs(shell.main, '[data-region="info"]');
        info.innerHTML = infoTemplate(v);
        hydrateIcons(info);
        qs(shell.main, '[data-region="agreements"]').innerHTML = agreementsTemplate(v);
        renderHistory();
      }
      if (s.activeCall !== prev.activeCall) syncRedial();
    }),
  ]);
}
