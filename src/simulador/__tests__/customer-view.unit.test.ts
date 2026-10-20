import { describe, expect, it } from 'vitest';
import { generateCustomers } from '../data/mock-customers';
import { PORTFOLIOS } from '../data/mock-portfolios';
import { bestProfileOf, buildCustomerView, buildCustomerViews } from '../domain/customer-view';
import type { Customer, Management } from '../types/simulator';
import { toDateKey } from '../utils/dates';

const now = new Date(2026, 9, 16, 11, 0);

const customer: Customer = {
  id: 'c1',
  portfolioId: 'aurora',
  document: '1000123456',
  name: 'Ana Prueba',
  phone: '300 555 0101',
  email: 'ana@ejemplo.test',
  city: 'Cali',
  advisor: 'asesor.practica',
  priority: 'media',
  obligations: [
    { id: 'o1', product: 'Crédito de consumo', balance: 1_000_000, daysPastDue: 40, status: 'pendiente' },
    { id: 'o2', product: 'Tarjeta de crédito', balance: 500_000, daysPastDue: 10, status: 'pagada' },
  ],
};

const m = (id: string, date: Date, result: Management['result'], extra: Partial<Management> = {}): Management => ({
  id,
  customerId: 'c1',
  date: date.toISOString(),
  advisor: 'asesor.practica',
  result,
  note: 'Observación de prueba',
  ...extra,
});

describe('perfiles del cliente', () => {
  it('mejor perfil = mayor jerarquía; último = más reciente', () => {
    const history = [
      m('a', new Date(2026, 9, 1), 'contactado'),
      m('b', new Date(2026, 9, 5), 'promesa-pago', { promiseDate: '2026-10-08', promiseAmount: 100_000 }),
      m('c', new Date(2026, 9, 12), 'no-contesta'),
    ];
    const view = buildCustomerView(customer, history, now);
    expect(view.bestProfile).toBe('promesa-pago');
    expect(view.lastProfile).toBe('no-contesta');
    expect(view.status).toBe('menos-5-dias');
    expect(view.totalPromises).toBe(1);
  });

  it('sin historial: sin gestión en todo', () => {
    const view = buildCustomerView(customer, [], now);
    expect(view.bestProfile).toBe('sin-gestion');
    expect(view.lastProfile).toBe('sin-gestion');
    expect(view.status).toBe('sin-gestion');
    expect(bestProfileOf([])).toBe('sin-gestion');
  });

  it('el saldo y la mora excluyen obligaciones pagadas', () => {
    const view = buildCustomerView(customer, [], now);
    expect(view.totalBalance).toBe(1_000_000);
    expect(view.maxDaysPastDue).toBe(40);
  });

  it('una promesa vigente pasa la obligación pendiente a "En acuerdo"', () => {
    const view = buildCustomerView(
      customer,
      [m('p', now, 'promesa-pago', { promiseDate: toDateKey(now), promiseAmount: 200_000 })],
      now,
    );
    expect(view.obligations[0]?.status).toBe('en-acuerdo');
    expect(view.obligationStatuses).toContain('en-acuerdo');
    expect(view.status).toBe('gestionado-hoy');
  });
});

describe('datos ficticios', () => {
  const seed = generateCustomers(now);
  const views = buildCustomerViews(seed.customers, seed.managements, now);

  it('genera al menos 33 clientes, de 8 a 12 por campaña', () => {
    expect(seed.customers.length).toBeGreaterThanOrEqual(33);
    for (const p of PORTFOLIOS) {
      const count = seed.customers.filter((c) => c.portfolioId === p.id).length;
      expect(count).toBeGreaterThanOrEqual(8);
      expect(count).toBeLessThanOrEqual(12);
    }
  });

  it('es determinístico', () => {
    expect(generateCustomers(now)).toEqual(seed);
  });

  it('cada cartera tiene clientes en los cuatro estados del semáforo y promesas que vencen hoy', () => {
    for (const p of PORTFOLIOS) {
      const statuses = new Set(views.filter((v) => v.portfolioId === p.id).map((v) => v.status));
      expect([...statuses].sort()).toEqual(['gestionado-hoy', 'mas-5-dias', 'menos-5-dias', 'sin-gestion']);
      expect(views.some((v) => v.portfolioId === p.id && v.promiseDates.includes(toDateKey(now)))).toBe(true);
    }
  });

  it('los cuatro estados también aparecen entre los clientes del asesor de práctica', () => {
    const mine = views.filter((v) => v.advisor === 'asesor.practica');
    expect(new Set(mine.map((v) => v.status)).size).toBe(4);
  });

  it('usa documentos 1000… y teléfonos con el bloque 555, sin gestiones futuras', () => {
    for (const c of seed.customers) {
      expect(c.document).toMatch(/^1000\d{6}$/);
      expect(c.phone).toMatch(/^3\d{2} 555 \d{4}$/);
    }
    for (const g of seed.managements) expect(new Date(g.date).getTime()).toBeLessThanOrEqual(now.getTime());
  });

  it('funciona aunque se cargue justo después de medianoche', () => {
    const early = new Date(2026, 9, 16, 0, 5);
    const earlyViews = buildCustomerViews(generateCustomers(early).customers, generateCustomers(early).managements, early);
    expect(new Set(earlyViews.map((v) => v.status)).size).toBe(4);
  });
});
