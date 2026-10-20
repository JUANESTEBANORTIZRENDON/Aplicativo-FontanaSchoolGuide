// Métricas del panel calculadas a partir de clientes, gestiones, pagos y llamadas.

import { resultMeta, RESULTS } from '../data/catalogs';
import type {
  CallRecord,
  CustomerView,
  Management,
  Payment,
  RangeKey,
  ResultCode,
} from '../types/simulator';
import { addDays, endOfDay, fromDateKey, startOfDay } from '../utils/dates';

export const RANGE_OPTIONS: { code: RangeKey; label: string }[] = [
  { code: 'hoy', label: 'Hoy' },
  { code: 'semana', label: 'Semana actual' },
  { code: 'mes', label: 'Mes actual' },
  { code: 'mes-anterior', label: 'Mes anterior' },
];

export interface DateRange {
  from: Date;
  to: Date;
}

/** Rango de fechas inclusivo. La semana empieza el lunes. */
export function getRange(key: RangeKey, now: Date): DateRange {
  const today = startOfDay(now);
  switch (key) {
    case 'hoy':
      return { from: today, to: endOfDay(now) };
    case 'semana': {
      const offset = (today.getDay() + 6) % 7;
      return { from: addDays(today, -offset), to: endOfDay(now) };
    }
    case 'mes':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
    case 'mes-anterior':
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
  }
}

export function isInRange(value: Date | string, range: DateRange): boolean {
  const date = value instanceof Date ? value : /^\d{4}-\d{2}-\d{2}$/.test(value) ? fromDateKey(value) : new Date(value);
  return date >= range.from && date <= range.to;
}

export const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;

export interface ProductivityDay {
  day: (typeof WEEKDAYS)[number];
  promesa: number;
  contacto: number;
  sinContacto: number;
}

export interface ResultSummary {
  code: ResultCode;
  label: string;
  count: number;
  percent: number;
  lastDate: string | null;
}

export interface DashboardMetrics {
  customers: number;
  managedCustomers: number;
  managedPercent: number;
  obligations: number;
  capital: number;
  agreementPercent: number;
  projection: number;
  projectionPercent: number;
  payments: number;
  paymentsPercent: number;
  commitments: number;
  managementsInRange: number;
  connectedAdvisors: number;
  totalAdvisors: number;
  productivity: ProductivityDay[];
  results: ResultSummary[];
  recentCalls: CallRecord[];
}

export interface MetricsInput {
  views: CustomerView[];
  payments: Payment[];
  calls: CallRecord[];
  advisors: string[];
  /** Usuario que practica; cuenta como conectado si `connected` es verdadero. */
  currentAdvisor: string;
  connected: boolean;
  range: RangeKey;
  now: Date;
}

const percent = (part: number, total: number): number => (total > 0 ? Math.min(100, Math.round((part / total) * 100)) : 0);

export function computeDashboardMetrics(input: MetricsInput): DashboardMetrics {
  const { views, now } = input;
  const range = getRange(input.range, now);
  const ids = new Set(views.map((v) => v.id));
  const managements: Management[] = views.flatMap((v) => v.managements);
  const inRange = managements.filter((m) => isInRange(m.date, range));

  const managedCustomers = new Set(inRange.map((m) => m.customerId)).size;
  const obligations = views.flatMap((v) => v.obligations);
  const capital = views.reduce((sum, v) => sum + v.totalBalance, 0);
  const agreements = obligations.filter((o) => o.status === 'en-acuerdo' || o.status === 'pagada').length;

  const promisesDue = managements.filter(
    (m) => m.result === 'promesa-pago' && m.promiseDate && isInRange(m.promiseDate, range),
  );
  const projection = promisesDue.reduce((sum, m) => sum + (m.promiseAmount ?? 0), 0);
  const commitments = inRange.filter((m) => m.result === 'promesa-pago').length;

  const payments = input.payments
    .filter((p) => ids.has(p.customerId) && isInRange(p.date, range))
    .reduce((sum, p) => sum + p.amount, 0);

  const productivity: ProductivityDay[] = WEEKDAYS.map((day) => ({ day, promesa: 0, contacto: 0, sinContacto: 0 }));
  for (const m of inRange) {
    const slot = productivity[(new Date(m.date).getDay() + 6) % 7];
    if (!slot) continue;
    const group = resultMeta(m.result).group;
    if (group === 'promesa') slot.promesa += 1;
    else if (group === 'contacto') slot.contacto += 1;
    else slot.sinContacto += 1;
  }

  const results: ResultSummary[] = RESULTS.map((r) => {
    const items = inRange.filter((m) => m.result === r.code);
    return {
      code: r.code,
      label: r.label,
      count: items.length,
      percent: percent(items.length, inRange.length),
      lastDate: items.reduce<string | null>((max, m) => (!max || m.date > max ? m.date : max), null),
    };
  });

  const todayStart = startOfDay(now);
  const activeToday = new Set(
    managements.filter((m) => new Date(m.date) >= todayStart).map((m) => m.advisor),
  );
  if (input.connected) activeToday.add(input.currentAdvisor);
  else activeToday.delete(input.currentAdvisor);

  const recentCalls = input.calls
    .filter((c) => ids.has(c.customerId))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 6);

  return {
    customers: views.length,
    managedCustomers,
    managedPercent: percent(managedCustomers, views.length),
    obligations: obligations.length,
    capital,
    agreementPercent: percent(agreements, obligations.length),
    projection,
    projectionPercent: percent(projection, capital),
    payments,
    paymentsPercent: percent(payments, projection),
    commitments,
    managementsInRange: inRange.length,
    connectedAdvisors: [...activeToday].filter((a) => input.advisors.includes(a)).length,
    totalAdvisors: input.advisors.length,
    productivity,
    results,
    recentCalls,
  };
}
