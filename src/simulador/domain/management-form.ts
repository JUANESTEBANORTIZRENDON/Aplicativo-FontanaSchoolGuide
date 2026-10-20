// Validación del formulario de registro de gestión.

import type { ResultCode } from '../types/simulator';
import { addDays, startOfDay, toDateKey } from '../utils/dates';

export const NOTE_MIN = 10;
export const NOTE_MAX = 500;
export const PROMISE_MAX_DAYS = 30;

export interface ManagementDraft {
  result: ResultCode | '';
  note: string;
  promiseDate: string;
  promiseAmount: string;
  callbackAt: string;
}

export type ManagementErrors = Partial<Record<keyof ManagementDraft, string>>;

/** Convierte "1.250.000" o "1250000" en número. */
export function parseAmount(value: string): number {
  const digits = value.replace(/[^\d]/g, '');
  return digits ? Number(digits) : Number.NaN;
}

export function validateManagement(draft: ManagementDraft, balance: number, now: Date): ManagementErrors {
  const errors: ManagementErrors = {};
  if (!draft.result) errors.result = 'Selecciona el resultado de la gestión.';

  const note = draft.note.trim();
  if (note.length < NOTE_MIN) errors.note = `La observación debe tener al menos ${NOTE_MIN} caracteres.`;
  else if (note.length > NOTE_MAX) errors.note = `La observación no puede superar ${NOTE_MAX} caracteres.`;

  if (draft.result === 'promesa-pago') {
    const today = toDateKey(now);
    const limit = toDateKey(addDays(startOfDay(now), PROMISE_MAX_DAYS));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.promiseDate)) errors.promiseDate = 'Indica la fecha del compromiso.';
    else if (draft.promiseDate < today) errors.promiseDate = 'La fecha del compromiso no puede ser anterior a hoy.';
    else if (draft.promiseDate > limit)
      errors.promiseDate = `La fecha del compromiso debe estar dentro de los próximos ${PROMISE_MAX_DAYS} días.`;

    const amount = parseAmount(draft.promiseAmount);
    if (!Number.isFinite(amount) || amount <= 0) errors.promiseAmount = 'El valor del compromiso debe ser mayor que cero.';
    else if (amount > balance) errors.promiseAmount = 'El valor del compromiso no puede superar el saldo del cliente.';
  }

  if (draft.result === 'devolucion-llamada') {
    const when = draft.callbackAt ? new Date(draft.callbackAt) : null;
    if (!when || Number.isNaN(when.getTime())) errors.callbackAt = 'Indica la fecha y hora de la nueva llamada.';
    else if (when < now) errors.callbackAt = 'La nueva llamada debe ser desde ahora en adelante.';
  }
  return errors;
}
