import type { CustomerFilters, CustomerView } from '../types/simulator';
import { toDateKey } from '../utils/dates';

export const PAGE_SIZE = 10;

export function createDefaultFilters(advisor = ''): CustomerFilters {
  return {
    promiseFrom: '',
    promiseTo: '',
    managedFrom: '',
    managedTo: '',
    sortField: 'nombre',
    sortDir: 'asc',
    city: '',
    advisor,
    bestProfiles: [],
    lastProfiles: [],
    statuses: [],
    text: '',
    priority: '',
    obligationStatus: '',
  };
}

/** Quita tildes y pasa a minúsculas para comparar textos. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function inRange(key: string, from: string, to: string): boolean {
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
}

export function matchesFilters(view: CustomerView, f: CustomerFilters): boolean {
  if (f.text) {
    const needle = normalizeText(f.text);
    const digits = f.text.replace(/\D/g, '');
    const byName = normalizeText(view.name).includes(needle);
    const byDocument = digits.length > 0 && view.document.includes(digits);
    if (!byName && !byDocument) return false;
  }
  if (f.city && view.city !== f.city) return false;
  if (f.advisor && view.advisor !== f.advisor) return false;
  if (f.priority && view.priority !== f.priority) return false;
  if (f.obligationStatus && !view.obligationStatuses.includes(f.obligationStatus)) return false;
  if (f.bestProfiles.length && !f.bestProfiles.includes(view.bestProfile)) return false;
  if (f.lastProfiles.length && !f.lastProfiles.includes(view.lastProfile)) return false;
  if (f.statuses.length && !f.statuses.includes(view.status)) return false;

  if (f.promiseFrom || f.promiseTo) {
    if (!view.promiseDates.some((d) => d && inRange(d, f.promiseFrom, f.promiseTo))) return false;
  }
  if (f.managedFrom || f.managedTo) {
    if (!view.lastManagement) return false;
    if (!inRange(toDateKey(new Date(view.lastManagement.date)), f.managedFrom, f.managedTo)) return false;
  }
  return true;
}

function compare(a: CustomerView, b: CustomerView, field: CustomerFilters['sortField']): number {
  switch (field) {
    case 'nombre':
      return a.name.localeCompare(b.name, 'es');
    case 'mora':
      return a.maxDaysPastDue - b.maxDaysPastDue;
    case 'saldo':
      return a.totalBalance - b.totalBalance;
    case 'promesas':
      return a.totalPromises - b.totalPromises;
    case 'fecha-gestion':
      // Los clientes sin gestión quedan como los más antiguos.
      return (a.lastManagement?.date ?? '').localeCompare(b.lastManagement?.date ?? '');
  }
}

/** Filtra y ordena. Desempata por nombre para que el orden sea estable. */
export function applyCustomerFilters(views: CustomerView[], f: CustomerFilters): CustomerView[] {
  const dir = f.sortDir === 'desc' ? -1 : 1;
  return views
    .filter((v) => matchesFilters(v, f))
    .sort((a, b) => compare(a, b, f.sortField) * dir || a.name.localeCompare(b.name, 'es'));
}

export interface Page<T> {
  items: T[];
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
}

export function paginate<T>(items: T[], page: number, size = PAGE_SIZE): Page<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * size;
  const slice = items.slice(start, start + size);
  return { items: slice, page: current, totalPages, from: total ? start + 1 : 0, to: start + slice.length, total };
}

/** Cantidad de filtros que difieren de los valores por defecto (sin contar el orden). */
export function countActiveFilters(f: CustomerFilters, defaults: CustomerFilters): number {
  const keys: (keyof CustomerFilters)[] = [
    'promiseFrom', 'promiseTo', 'managedFrom', 'managedTo', 'city', 'advisor', 'text', 'priority', 'obligationStatus',
  ];
  let count = keys.filter((k) => f[k] !== defaults[k]).length;
  count += [f.bestProfiles, f.lastProfiles, f.statuses].filter((list) => list.length > 0).length;
  return count;
}
