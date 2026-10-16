import { describe, expect, it } from 'vitest';
import {
  applyCustomerFilters,
  countActiveFilters,
  createDefaultFilters,
  normalizeText,
  paginate,
} from '../domain/customer-filters';
import type { CustomerView } from '../types/simulator';

function view(partial: Partial<CustomerView> & { id: string; name: string }): CustomerView {
  return {
    portfolioId: 'horizonte',
    document: '1000000001',
    phone: '300 555 0101',
    email: 'x@ejemplo.test',
    city: 'Bogotá',
    advisor: 'asesor.practica',
    priority: 'media',
    obligations: [{ id: 'o', product: 'Crédito de consumo', balance: 100, daysPastDue: 10, status: 'pendiente' }],
    managements: [],
    lastManagement: null,
    lastProfile: 'sin-gestion',
    bestProfile: 'sin-gestion',
    status: 'sin-gestion',
    totalPromises: 0,
    promiseDates: [],
    totalBalance: 100,
    maxDaysPastDue: 10,
    obligationStatuses: ['pendiente'],
    ...partial,
  };
}

const managed = (date: string): CustomerView['lastManagement'] => ({
  id: 'g',
  customerId: 'x',
  date,
  advisor: 'asesor.practica',
  result: 'contactado',
  note: 'nota de prueba',
});

const views: CustomerView[] = [
  view({ id: '1', name: 'Ángela Gómez', document: '1000111111', city: 'Cali', totalBalance: 500, maxDaysPastDue: 90, priority: 'alta' }),
  view({
    id: '2',
    name: 'Bruno Díaz',
    document: '1000222222',
    status: 'gestionado-hoy',
    lastProfile: 'promesa-pago',
    bestProfile: 'promesa-pago',
    totalPromises: 2,
    promiseDates: ['2026-10-16', '2026-10-25'],
    lastManagement: managed(new Date(2026, 9, 16, 9).toISOString()),
    obligationStatuses: ['en-acuerdo'],
  }),
  view({
    id: '3',
    name: 'Carla Rojas',
    advisor: 'asesor.demo02',
    status: 'mas-5-dias',
    lastProfile: 'no-contesta',
    bestProfile: 'contactado',
    lastManagement: managed(new Date(2026, 9, 2, 9).toISOString()),
    totalBalance: 50,
  }),
];

describe('applyCustomerFilters', () => {
  const base = createDefaultFilters();

  it('sin filtros devuelve todos ordenados por nombre', () => {
    expect(applyCustomerFilters(views, base).map((v) => v.id)).toEqual(['1', '2', '3']);
  });

  it('busca por nombre sin tildes ni mayúsculas y por documento', () => {
    expect(applyCustomerFilters(views, { ...base, text: 'angela' }).map((v) => v.id)).toEqual(['1']);
    expect(applyCustomerFilters(views, { ...base, text: '2222' }).map((v) => v.id)).toEqual(['2']);
    expect(normalizeText('  ÁngeLA ')).toBe('angela');
  });

  it('filtra por asesor, ciudad, prioridad y estado de obligación', () => {
    expect(applyCustomerFilters(views, { ...base, advisor: 'asesor.demo02' }).map((v) => v.id)).toEqual(['3']);
    expect(applyCustomerFilters(views, { ...base, city: 'Cali' }).map((v) => v.id)).toEqual(['1']);
    expect(applyCustomerFilters(views, { ...base, priority: 'alta' }).map((v) => v.id)).toEqual(['1']);
    expect(applyCustomerFilters(views, { ...base, obligationStatus: 'en-acuerdo' }).map((v) => v.id)).toEqual(['2']);
  });

  it('filtra por mejor y último perfil (multiselección) y por semáforo', () => {
    expect(applyCustomerFilters(views, { ...base, bestProfiles: ['contactado', 'promesa-pago'] }).map((v) => v.id)).toEqual(['2', '3']);
    expect(applyCustomerFilters(views, { ...base, lastProfiles: ['no-contesta'] }).map((v) => v.id)).toEqual(['3']);
    expect(applyCustomerFilters(views, { ...base, statuses: ['sin-gestion', 'mas-5-dias'] }).map((v) => v.id)).toEqual(['1', '3']);
  });

  it('filtra por rango de fecha de promesa y de gestión (inclusivo)', () => {
    expect(applyCustomerFilters(views, { ...base, promiseFrom: '2026-10-16', promiseTo: '2026-10-16' }).map((v) => v.id)).toEqual(['2']);
    expect(applyCustomerFilters(views, { ...base, promiseFrom: '2026-11-01' })).toHaveLength(0);
    expect(applyCustomerFilters(views, { ...base, managedFrom: '2026-10-01', managedTo: '2026-10-10' }).map((v) => v.id)).toEqual(['3']);
  });

  it('ordena por saldo, mora, promesas y fecha de gestión en ambas direcciones', () => {
    expect(applyCustomerFilters(views, { ...base, sortField: 'saldo', sortDir: 'desc' }).map((v) => v.id)).toEqual(['1', '2', '3']);
    expect(applyCustomerFilters(views, { ...base, sortField: 'mora', sortDir: 'desc' })[0]?.id).toBe('1');
    expect(applyCustomerFilters(views, { ...base, sortField: 'promesas', sortDir: 'desc' })[0]?.id).toBe('2');
    expect(applyCustomerFilters(views, { ...base, sortField: 'fecha-gestion', sortDir: 'desc' }).map((v) => v.id)).toEqual(['2', '3', '1']);
  });

  it('cuenta los filtros activos', () => {
    expect(countActiveFilters(base, base)).toBe(0);
    expect(countActiveFilters({ ...base, city: 'Cali', statuses: ['sin-gestion'] }, base)).toBe(2);
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 23 }, (_, i) => i);

  it('pagina de a 10 e informa el rango', () => {
    const p = paginate(items, 3);
    expect(p.items).toEqual([20, 21, 22]);
    expect([p.from, p.to, p.total, p.totalPages]).toEqual([21, 23, 23, 3]);
  });

  it('corrige páginas fuera de rango y listas vacías', () => {
    expect(paginate(items, 99).page).toBe(3);
    expect(paginate(items, 0).page).toBe(1);
    expect(paginate([], 1)).toMatchObject({ from: 0, to: 0, total: 0, totalPages: 1 });
  });
});
