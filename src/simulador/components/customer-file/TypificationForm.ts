// Formulario «Nueva Gestión» de Control Next. Los campos aparecen como en el aplicativo:
//   sin acción → Acción · Teléfono · Gestión Localización
//   con acción → Acción · Contacto · Canal · Teléfono · Gestión Localización
//   con contacto → Acción · Contacto · Canal · Perfil · Motivo No Pago · Teléfono · Gestión Localización
// y el perfil pide los datos del acuerdo (fecha y valor) o la fecha para volver a llamar.
// Solo dibuja y lee el formulario: guardar y evaluar lo deciden quienes lo usan.

import {
  ACTION_OPTIONS,
  CHANNEL_OPTIONS,
  contactOptions,
  findProfile,
  profileOptions,
  reasonOptions,
  type ActionCode,
  type ChannelCode,
  type ContactCode,
} from '../../domain/typification/catalog';
import { EMPTY_DRAFT, type DraftErrors, type DraftField, type TypificationDraft } from '../../domain/typification/draft';
import { NOTE_MAX, PROMISE_MAX_DAYS } from '../../domain/management-form';
import { addDays, startOfDay, toDateKey, toDateTimeLocal } from '../../utils/dates';
import { combine, on, qs, type Cleanup } from '../../utils/dom';
import { esc, formatCOP } from '../../utils/format';
import { hydrateIcons, icon } from '../icons';

const FIELDS: DraftField[] = ['note', 'action', 'contact', 'channel', 'profile', 'reason', 'phone', 'promiseDate', 'promiseAmount', 'callbackAt'];

const select = (name: string, label: string, options: { value: string; label: string }[], placeholder = 'Seleccione'): string => `
  <div class="sim-field" data-cell="${name}">
    <label class="sim-label" for="sim-tf-${name}">${label}</label>
    <select class="sim-input" id="sim-tf-${name}" name="${name}">
      <option value="">${placeholder}</option>
      ${options.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}
    </select>
    <p class="sim-error" data-error="${name}"></p>
  </div>`;

function template(balance: number, phones: string[]): string {
  const now = new Date();
  return `
    <form class="sim-cn-form" novalidate aria-label="Nueva gestión">
      <p class="sim-cn-form__title">${icon('SquarePen')} Nueva Gestión</p>
      <div class="sim-cn-form__time-row">
        <div data-sim-guide="ficha.tiempo">
          <p class="sim-label">Tiempo de Gestión</p>
          <div class="sim-cn-time">
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
        <label class="sim-visually-hidden" for="sim-tf-note">Nueva gestión de llamadas</label>
        <textarea class="sim-input sim-cn-note" id="sim-tf-note" name="note" rows="4" maxlength="${NOTE_MAX}" placeholder="Tipifica todo lo que escuchas en la llamada"></textarea>
        <p class="sim-error" data-error="note"></p>
      </div>
      <div class="sim-cn-grid" data-sim-guide="ficha.tipificacion">
        ${select('action', 'Accion:', ACTION_OPTIONS.map((a) => ({ value: a.code, label: a.label })))}
        ${select('contact', 'Contacto:', [])}
        ${select('channel', 'Canal:', CHANNEL_OPTIONS.map((c) => ({ value: c.code, label: c.label })), 'Seleccion')}
        ${select('profile', 'Perfil:', [])}
        ${select('reason', 'Motivo No Pago:', [])}
        <div class="sim-field" data-cell="phone">
          <label class="sim-label" for="sim-tf-phone">Teléfono:</label>
          <input class="sim-input" id="sim-tf-phone" name="phone" list="sim-tf-phones" inputmode="tel" autocomplete="off" />
          <datalist id="sim-tf-phones">${phones.map((p) => `<option value="${esc(p)}"></option>`).join('')}</datalist>
          <p class="sim-error" data-error="phone"></p>
        </div>
        <div class="sim-field" data-cell="location">
          <span class="sim-label">Gestión Localización</span>
          <label class="sim-cn-check"><input type="checkbox" name="location" /> <span class="sim-help">Marca si la gestión fue para ubicar al titular</span></label>
        </div>
        <div class="sim-field" data-need="acuerdo" hidden>
          <label class="sim-label" for="sim-tf-pdate">Fecha de pago:</label>
          <input class="sim-input" type="date" id="sim-tf-pdate" name="promiseDate" min="${toDateKey(now)}" max="${toDateKey(addDays(startOfDay(now), PROMISE_MAX_DAYS))}" />
          <p class="sim-error" data-error="promiseDate"></p>
        </div>
        <div class="sim-field" data-need="acuerdo" hidden>
          <label class="sim-label" for="sim-tf-pamount">Valor del acuerdo:</label>
          <input class="sim-input" id="sim-tf-pamount" name="promiseAmount" inputmode="numeric" autocomplete="off" placeholder="Máximo ${esc(formatCOP(balance))}" />
          <p class="sim-error" data-error="promiseAmount"></p>
        </div>
        <div class="sim-field" data-need="agenda" hidden>
          <label class="sim-label" for="sim-tf-callback">Volver a llamar el:</label>
          <input class="sim-input" type="datetime-local" id="sim-tf-callback" name="callbackAt" min="${toDateTimeLocal(now)}" />
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

export interface TypificationForm {
  element: HTMLFormElement;
  read(): TypificationDraft;
  /** Muestra los errores junto a cada campo; devuelve cuántos hay. */
  showErrors(errors: DraftErrors): number;
  reset(): void;
  setTimer(h: number, m: number, s: number): void;
  setInCall(inCall: boolean): void;
  /** Coloca el teléfono si está vacío (al marcar). */
  suggestPhone(phone: string): void;
  /** Muestra una tipificación ya guardada (p. ej. la entregada en la prueba oficial). */
  fill(draft: Partial<TypificationDraft>): void;
  /** Bloquea el formulario: un ejercicio oficial entregado no se vuelve a enviar. */
  setLocked(locked: boolean): void;
  cleanup: Cleanup;
}

export function mountTypificationForm(host: HTMLElement, opts: { balance: number; phones: string[]; onSubmit(): void }): TypificationForm {
  host.innerHTML = template(opts.balance, opts.phones);
  hydrateIcons(host);
  const form = qs<HTMLFormElement>(host, 'form');
  const el = <T extends HTMLElement = HTMLInputElement>(name: string): T => qs<T>(form, `[name="${name}"]`);
  const cell = (name: string): HTMLElement => qs(form, `[data-cell="${name}"]`);
  const summary = qs(form, '[data-summary]');

  const fill = (name: string, options: { value: string; label: string }[], placeholder = 'Seleccione'): void => {
    const s = el<HTMLSelectElement>(name);
    const keep = s.value;
    s.innerHTML = `<option value="">${placeholder}</option>${options.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}`;
    s.value = options.some((o) => o.value === keep) ? keep : '';
  };

  /** Muestra u oculta campos según lo elegido (la lógica dependiente del aplicativo). */
  const sync = (): void => {
    const action = el<HTMLSelectElement>('action').value as ActionCode | '';
    fill('contact', contactOptions(action).map((c) => ({ value: c.code, label: c.label })));
    const contact = el<HTMLSelectElement>('contact').value as ContactCode | '';
    fill('profile', profileOptions(contact).map((p) => ({ value: p.label, label: p.label })));
    fill('reason', reasonOptions(contact).map((r) => ({ value: r, label: r })));
    cell('contact').hidden = !action;
    cell('channel').hidden = !action;
    cell('profile').hidden = !contact;
    cell('reason').hidden = !contact;
    form.classList.toggle('has-contact', !!contact);
    const need = findProfile(contact, el<HTMLSelectElement>('profile').value)?.needs ?? 'ninguno';
    for (const f of form.querySelectorAll<HTMLElement>('[data-need]')) f.hidden = f.dataset.need !== need;
  };

  const showErrors = (errors: DraftErrors): number => {
    for (const name of FIELDS) {
      const slot = form.querySelector<HTMLElement>(`[data-error="${name}"]`);
      if (slot) slot.textContent = errors[name] ?? '';
      const input = form.querySelector<HTMLElement>(`[name="${name}"]`);
      if (errors[name]) input?.setAttribute('aria-invalid', 'true');
      else input?.removeAttribute('aria-invalid');
    }
    const count = Object.keys(errors).length;
    summary.textContent = count ? `Revisa ${count === 1 ? 'el campo marcado' : `los ${count} campos marcados`} antes de guardar.` : '';
    if (count) form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    return count;
  };

  const reset = (): void => {
    form.reset();
    showErrors({});
    sync();
  };

  sync();

  return {
    element: form,
    read: () => ({
      ...EMPTY_DRAFT,
      action: el<HTMLSelectElement>('action').value as ActionCode | '',
      contact: el<HTMLSelectElement>('contact').value as ContactCode | '',
      channel: el<HTMLSelectElement>('channel').value as ChannelCode | '',
      profile: el<HTMLSelectElement>('profile').value,
      reason: el<HTMLSelectElement>('reason').value,
      phone: el('phone').value.trim(),
      note: el<HTMLTextAreaElement>('note').value,
      location: el('location').checked,
      promiseDate: el('promiseDate').value,
      promiseAmount: el('promiseAmount').value,
      callbackAt: el('callbackAt').value,
    }),
    showErrors,
    reset,
    setTimer(h, m, s) {
      qs<HTMLInputElement>(form, '[data-time="h"]').value = String(h);
      qs<HTMLInputElement>(form, '[data-time="m"]').value = String(m);
      qs<HTMLInputElement>(form, '[data-time="s"]').value = String(s);
    },
    setInCall(inCall) {
      const btn = qs<HTMLButtonElement>(form, '[data-action="redial"]');
      btn.classList.toggle('sim-btn--danger', inCall);
      qs(btn, '[data-redial-label]').textContent = inCall ? 'Colgar' : 'Remarcar';
    },
    suggestPhone(phone) {
      if (!el('phone').value) el('phone').value = phone;
    },
    fill(draft) {
      // En orden: cada lista depende de la anterior (acción → contacto → canal → perfil → motivo).
      for (const name of ['action', 'contact', 'channel', 'profile', 'reason', 'phone', 'note', 'promiseDate', 'promiseAmount', 'callbackAt'] as const) {
        const value = draft[name];
        const field = form.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[name="${name}"]`);
        if (field && typeof value === 'string') field.value = value;
        sync();
      }
    },
    setLocked(locked) {
      for (const control of form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement>('input, select, textarea, button')) control.disabled = locked;
      form.classList.toggle('is-locked', locked);
    },
    cleanup: combine([
      on(form, 'change', (e) => {
        if ((e.target as HTMLElement).matches('select')) sync();
      }),
      on(form, 'submit', (e) => {
        e.preventDefault();
        opts.onSubmit();
      }),
      on(form, 'reset', () => setTimeout(() => { showErrors({}); sync(); })),
      on(el('phone'), 'change', () => {
        const note = el<HTMLTextAreaElement>('note');
        const phone = el('phone').value.trim();
        if (phone && !note.value.trim()) note.value = `${phone} // `;
      }),
    ]),
  };
}
