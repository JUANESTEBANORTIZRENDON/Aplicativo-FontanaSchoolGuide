import { profileRank } from '../data/catalogs';
import type { Customer, CustomerView, Management, ObligationStatus, ProfileCode } from '../types/simulator';
import { toDateKey } from '../utils/dates';
import { getManagementStatus } from './management-status';

/** Agrupa las gestiones por cliente, de la más reciente a la más antigua. */
export function groupManagements(managements: Management[]): Map<string, Management[]> {
  const map = new Map<string, Management[]>();
  for (const m of managements) {
    const list = map.get(m.customerId);
    if (list) list.push(m);
    else map.set(m.customerId, [m]);
  }
  for (const list of map.values()) list.sort((a, b) => b.date.localeCompare(a.date));
  return map;
}

/** Mejor perfil: la tipificación de mayor jerarquía del historial. */
export function bestProfileOf(managements: Management[]): ProfileCode {
  let best: ProfileCode = 'sin-gestion';
  for (const m of managements) if (profileRank(m.result) < profileRank(best)) best = m.result;
  return best;
}

/** Combina un cliente con su historial y calcula los campos derivados. */
export function buildCustomerView(customer: Customer, history: Management[], now: Date): CustomerView {
  const managements = [...history].sort((a, b) => b.date.localeCompare(a.date));
  const lastManagement = managements[0] ?? null;
  const promises = managements.filter((m) => m.result === 'promesa-pago' && m.promiseDate);
  const todayKey = toDateKey(now);
  const hasActivePromise = promises.some((m) => (m.promiseDate ?? '') >= todayKey);

  // Una obligación pendiente con promesa vigente pasa a "En acuerdo".
  const obligations = customer.obligations.map((o) =>
    o.status === 'pendiente' && hasActivePromise ? { ...o, status: 'en-acuerdo' as ObligationStatus } : o,
  );
  const open = obligations.filter((o) => o.status !== 'pagada');

  return {
    ...customer,
    obligations,
    managements,
    lastManagement,
    lastProfile: lastManagement?.result ?? 'sin-gestion',
    bestProfile: bestProfileOf(managements),
    status: getManagementStatus(lastManagement?.date, now),
    totalPromises: promises.length,
    promiseDates: promises.map((m) => m.promiseDate ?? ''),
    totalBalance: open.reduce((sum, o) => sum + o.balance, 0),
    maxDaysPastDue: open.length ? Math.max(...open.map((o) => o.daysPastDue)) : 0,
    obligationStatuses: [...new Set(obligations.map((o) => o.status))],
  };
}

export function buildCustomerViews(customers: Customer[], managements: Management[], now: Date): CustomerView[] {
  const grouped = groupManagements(managements);
  return customers.map((c) => buildCustomerView(c, grouped.get(c.id) ?? [], now));
}
