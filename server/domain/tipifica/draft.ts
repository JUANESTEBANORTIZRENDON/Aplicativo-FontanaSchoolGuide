// Borrador de tipificación (lo que el asesor llena en «Nueva Gestión») y su validación de formulario.
// La validación revisa que la tipificación sea coherente consigo misma; si además coincide con lo que pasó en la
// llamada lo decide el sistema experto (engine.ts).

import { NOTE_MAX, NOTE_MIN, PROMISE_MAX_DAYS, addDays, parseAmount, startOfDay, toDateKey } from './form-rules.js';
import { contactOptions, findProfile, reasonOptions, type ActionCode, type ChannelCode, type ContactCode } from './catalog.js';

export interface TypificationDraft {
  action: ActionCode | '';
  contact: ContactCode | '';
  channel: ChannelCode | '';
  profile: string;
  reason: string;
  phone: string;
  note: string;
  location: boolean;
  promiseDate: string;
  promiseAmount: string;
  callbackAt: string;
}

export type DraftField = keyof TypificationDraft;
export type DraftErrors = Partial<Record<DraftField, string>>;

export const EMPTY_DRAFT: TypificationDraft = {
  action: '', contact: '', channel: '', profile: '', reason: '', phone: '', note: '',
  location: false, promiseDate: '', promiseAmount: '', callbackAt: '',
};

export function validateDraft(d: TypificationDraft, balance: number, now: Date): DraftErrors {
  const e: DraftErrors = {};
  const note = d.note.trim();
  if (note.length < NOTE_MIN) e.note = `Escribe la gestión (mínimo ${NOTE_MIN} caracteres): «teléfono // TT INDICA QUE…».`;
  else if (note.length > NOTE_MAX) e.note = `La gestión no puede superar ${NOTE_MAX} caracteres.`;
  if (!d.action) e.action = 'Selecciona la acción.';
  if (!d.contact) e.contact = 'Selecciona el contacto.';
  else if (!contactOptions(d.action).some((c) => c.code === d.contact)) e.contact = 'Ese contacto no aplica a la acción elegida.';
  if (d.action && !d.channel) e.channel = 'Selecciona el canal.';
  const profile = findProfile(d.contact, d.profile);
  if (d.contact && !d.profile) e.profile = 'Selecciona el perfil.';
  else if (d.contact && !profile) e.profile = 'Ese perfil no corresponde al contacto elegido.';
  if (d.contact && !d.reason) e.reason = 'Selecciona el motivo no pago.';
  else if (d.contact && !reasonOptions(d.contact).includes(d.reason)) e.reason = 'Ese motivo no corresponde al contacto elegido.';
  if (!d.phone.replace(/\D/g, '')) e.phone = 'Escribe el teléfono al que llamaste o del que te llamaron.';

  if (profile?.needs === 'acuerdo') {
    const today = toDateKey(now);
    const limit = toDateKey(addDays(startOfDay(now), PROMISE_MAX_DAYS));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.promiseDate)) e.promiseDate = 'Indica la fecha del pago acordado.';
    else if (d.promiseDate < today) e.promiseDate = 'La fecha del pago no puede ser anterior a hoy.';
    else if (d.promiseDate > limit) e.promiseDate = `La fecha del pago debe estar dentro de los próximos ${PROMISE_MAX_DAYS} días.`;
    const amount = parseAmount(d.promiseAmount);
    if (!Number.isFinite(amount) || amount <= 0) e.promiseAmount = 'Indica el valor acordado.';
    else if (amount > balance) e.promiseAmount = 'El valor acordado no puede superar el saldo total.';
  }
  if (profile?.needs === 'agenda') {
    const when = d.callbackAt ? new Date(d.callbackAt) : null;
    if (!when || Number.isNaN(when.getTime())) e.callbackAt = 'Indica cuándo volver a llamar.';
    else if (when < now) e.callbackAt = 'La nueva llamada debe quedar desde ahora en adelante.';
  }
  return e;
}
