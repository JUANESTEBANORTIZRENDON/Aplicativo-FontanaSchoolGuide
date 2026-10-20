// Cifras y filas derivadas que muestra la ficha del cliente de Control Next (Datos, Histórico, Acuerdos).
// Todo sale de los datos ficticios de forma determinista: el mismo cliente siempre muestra los mismos valores.

import { actionLabel, contactLabel, effectLabel, REASONS, resultMeta } from '../data/catalogs';
import type { ContactType, CustomerView, Management, Obligation } from '../types/simulator';
import { addDays, toDateKey } from '../utils/dates';

/** Hash pequeño y estable para variar valores sin azar. */
export function stableHash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface ObligationFigures {
  clientNumber: string;
  account: string;
  /** Franja de mora («Edad Cobranza»), p. ej. «31-60». */
  collectionAge: string;
  overdue: number;
  startDate: string;
  endDate: string;
  lateInterest: number;
  totalBalance: number;
  fees: number;
}

const AGE_BANDS: [number, string][] = [
  [30, '0-30'],
  [60, '31-60'],
  [90, '61-90'],
  [180, '91-180'],
  [360, '181-360'],
];

export function collectionAge(days: number): string {
  return AGE_BANDS.find(([limit]) => days <= limit)?.[1] ?? '+360';
}

const round = (value: number): number => Math.round(value / 100) * 100;

/** Fila de la pestaña «Datos»: valor vencido, intereses de mora, saldo total y honorarios. */
export function obligationFigures(customer: CustomerView, obligation: Obligation, now: Date): ObligationFigures {
  const overdue = obligation.status === 'pagada' ? 0 : obligation.balance;
  const lateInterest = round(overdue * (0.04 + (stableHash(obligation.id) % 5) / 100));
  const fees = round(overdue * 0.2);
  const start = addDays(now, -(obligation.daysPastDue + 30 * (2 + (stableHash(obligation.id) % 10))));
  return {
    clientNumber: customer.document,
    account: `${customer.document.slice(-4)}${obligation.id.replace(/\D/g, '').padStart(6, '0')}`,
    collectionAge: collectionAge(obligation.daysPastDue),
    overdue,
    startDate: toDateKey(start),
    endDate: toDateKey(addDays(start, 30 * 24)),
    lateInterest,
    totalBalance: overdue + lateInterest + fees,
    fees,
  };
}

export interface HistoryRow {
  id: string;
  date: string;
  user: string;
  action: string;
  effect: string;
  contact: string;
  phone: string;
  note: string;
  managementSec: number;
  callSec: number;
  reason: string;
  promise: number;
  ownPractice: boolean;
}

function defaultContact(m: Management): ContactType {
  const group = resultMeta(m.result).group;
  return group === 'sin-contacto' ? 'sin-contacto' : 'directo';
}

/** Una gestión como fila del Histórico. Las gestiones semilla no traen los campos de Control Next: se derivan. */
export function historyRow(m: Management, customer: CustomerView): HistoryRow {
  const h = stableHash(m.id);
  const reasons = REASONS[m.result];
  const noContact = resultMeta(m.result).group === 'sin-contacto';
  const phone = (m.phone ?? customer.phone).replace(/\s+/g, '');
  const seeded = m.id.startsWith('seed-');
  return {
    id: m.id,
    date: m.date,
    user: m.advisor,
    action: actionLabel(m.action),
    effect: m.profile ? m.profile.toUpperCase() : effectLabel(m.result),
    contact: contactLabel(m.contact ?? defaultContact(m)),
    phone,
    note: seeded ? `${phone} // ${m.note.toUpperCase()}` : m.note,
    managementSec: m.managementSec ?? 20 + (h % 160),
    callSec: m.callSec ?? (noContact ? 0 : 15 + (h % 90)),
    reason: (m.reason ?? reasons[h % reasons.length] ?? '').toUpperCase(),
    promise: m.result === 'promesa-pago' ? (m.promiseAmount ?? 0) : 0,
    ownPractice: !seeded,
  };
}

/** Histórico ordenado de la gestión más reciente a la más antigua. */
export function historyRows(customer: CustomerView): HistoryRow[] {
  return [...customer.managements]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((m) => historyRow(m, customer));
}

/** Filtra y pagina el histórico como la tabla de Control Next («Mostrar N registros», «Buscar»). */
export function pageHistory(rows: HistoryRow[], text: string, size: number, page: number) {
  const q = text.trim().toLowerCase();
  const filtered = q
    ? rows.filter((r) => [r.user, r.action, r.effect, r.contact, r.phone, r.note, r.reason].some((v) => v.toLowerCase().includes(q)))
    : rows;
  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * size;
  return {
    items: filtered.slice(start, start + size),
    total: filtered.length,
    from: filtered.length ? start + 1 : 0,
    to: Math.min(start + size, filtered.length),
    page: current,
    totalPages,
  };
}

export interface SearchQuery {
  document: string;
  name: string;
  obligation: string;
  phone: string;
  email: string;
}

/** Panel «Buscar»: coincide por cédula, nombre, número de obligación, teléfono o correo (en todas las campañas). */
export function searchCustomers(views: CustomerView[], q: SearchQuery): CustomerView[] {
  const digits = (v: string): string => v.replace(/\D/g, '');
  const norm = (v: string): string => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const doc = digits(q.document);
  const phone = digits(q.phone);
  const name = norm(q.name);
  const obligation = norm(q.obligation);
  const email = norm(q.email);
  if (!doc && !phone && !name && !obligation && !email) return [];
  return views.filter(
    (v) =>
      (!doc || v.document === doc) &&
      (!phone || digits(v.phone).includes(phone)) &&
      (!name || norm(v.name).includes(name)) &&
      (!obligation || v.obligations.some((o) => norm(o.id).includes(obligation))) &&
      (!email || norm(v.email).includes(email)),
  );
}

/** Último acuerdo de pago del cliente (Fecha Pago y Valor Pago de la información personal). */
export function lastAgreement(customer: CustomerView): Management | null {
  return [...customer.managements].reverse().find((m) => m.result === 'promesa-pago') ?? null;
}

/** h:m:s por separado, para las tres casillas de «Tiempo de Gestión». */
export function splitDuration(totalSec: number): [number, number, number] {
  const s = Math.max(0, Math.floor(totalSec));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
}

export function hms(totalSec: number): string {
  return splitDuration(totalSec)
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}
