import { describe, expect, it } from 'vitest';
import { createDataset } from '../data/mock-metrics';
import { buildCustomerViews } from '../domain/customer-view';
import { validateManagement, parseAmount, type ManagementDraft } from '../domain/management-form';
import { computeDashboardMetrics, getRange } from '../domain/metrics';
import type { Management } from '../types/simulator';
import { toDateKey } from '../utils/dates';

const now = new Date(2026, 9, 16, 11, 0); // viernes

describe('getRange', () => {
  it('semana desde el lunes, mes actual y mes anterior completos', () => {
    expect(toDateKey(getRange('semana', now).from)).toBe('2026-10-12');
    expect(toDateKey(getRange('mes', now).from)).toBe('2026-10-01');
    const prev = getRange('mes-anterior', now);
    expect([toDateKey(prev.from), toDateKey(prev.to)]).toEqual(['2026-09-01', '2026-09-30']);
    expect(toDateKey(getRange('hoy', now).from)).toBe('2026-10-16');
  });
});

describe('computeDashboardMetrics', () => {
  const dataset = createDataset(now);
  const metrics = (extra: Management[] = []) =>
    computeDashboardMetrics({
      views: buildCustomerViews(
        dataset.customers.filter((c) => c.portfolioId === 'aurora'),
        [...dataset.managements, ...extra],
        now,
      ),
      payments: dataset.payments,
      calls: dataset.calls,
      advisors: ['asesor.practica', 'asesor.demo02'],
      currentAdvisor: 'asesor.practica',
      connected: true,
      range: 'hoy',
      now,
    });

  it('las cifras salen de los datos y son coherentes', () => {
    const m = metrics();
    expect(m.customers).toBe(12);
    expect(m.managedCustomers).toBeGreaterThan(0);
    expect(m.managedPercent).toBeLessThanOrEqual(100);
    expect(m.capital).toBeGreaterThan(0);
    expect(m.results.reduce((s, r) => s + r.count, 0)).toBe(m.managementsInRange);
    expect(m.productivity.reduce((s, d) => s + d.promesa + d.contacto + d.sinContacto, 0)).toBe(m.managementsInRange);
  });

  it('registrar una promesa hoy actualiza compromisos, proyección y productividad', () => {
    const before = metrics();
    const customer = dataset.customers.find((c) => c.portfolioId === 'aurora')!;
    const promise: Management = {
      id: 'nueva',
      customerId: customer.id,
      date: now.toISOString(),
      advisor: 'asesor.practica',
      result: 'promesa-pago',
      note: 'Promesa registrada en la prueba',
      promiseDate: toDateKey(now),
      promiseAmount: 150_000,
    };
    const after = metrics([promise]);
    expect(after.commitments).toBe(before.commitments + 1);
    expect(after.projection).toBe(before.projection + 150_000);
    expect(after.managementsInRange).toBe(before.managementsInRange + 1);
  });
});

describe('validateManagement', () => {
  const ok: ManagementDraft = { result: 'contactado', note: 'Cliente atiende y pide información.', promiseDate: '', promiseAmount: '', callbackAt: '' };

  it('exige resultado y observación de 10 a 500 caracteres', () => {
    expect(validateManagement({ ...ok, result: '' }, 1000, now).result).toBeDefined();
    expect(validateManagement({ ...ok, note: 'corta' }, 1000, now).note).toBeDefined();
    expect(validateManagement({ ...ok, note: 'x'.repeat(501) }, 1000, now).note).toBeDefined();
    expect(validateManagement(ok, 1000, now)).toEqual({});
  });

  it('promesa: fecha de hoy a 30 días y valor entre 1 y el saldo', () => {
    const promise = { ...ok, result: 'promesa-pago' as const, promiseDate: '2026-10-16', promiseAmount: '500.000' };
    expect(validateManagement(promise, 1_000_000, now)).toEqual({});
    expect(validateManagement({ ...promise, promiseDate: '2026-10-15' }, 1_000_000, now).promiseDate).toBeDefined();
    expect(validateManagement({ ...promise, promiseDate: '2026-11-15' }, 1_000_000, now)).toEqual({});
    expect(validateManagement({ ...promise, promiseDate: '2026-11-16' }, 1_000_000, now).promiseDate).toBeDefined();
    expect(validateManagement({ ...promise, promiseAmount: '0' }, 1_000_000, now).promiseAmount).toBeDefined();
    expect(validateManagement({ ...promise, promiseAmount: '1.000.001' }, 1_000_000, now).promiseAmount).toBeDefined();
    expect(parseAmount('$ 1.250.000')).toBe(1_250_000);
  });

  it('devolución de llamada: fecha y hora desde ahora', () => {
    const callback = { ...ok, result: 'devolucion-llamada' as const };
    expect(validateManagement({ ...callback, callbackAt: '' }, 1, now).callbackAt).toBeDefined();
    expect(validateManagement({ ...callback, callbackAt: '2026-10-16T09:00' }, 1, now).callbackAt).toBeDefined();
    expect(validateManagement({ ...callback, callbackAt: '2026-10-16T15:00' }, 1, now)).toEqual({});
  });
});
