import { describe, expect, it } from 'vitest';
import { generateCustomers } from '../data/mock-customers';
import { buildCustomerViews } from '../domain/customer-view';
import {
  collectionAge,
  hms,
  historyRows,
  obligationFigures,
  pageHistory,
  searchCustomers,
  splitDuration,
} from '../domain/control-next';

const now = new Date(2026, 9, 16, 11, 0);
const seed = generateCustomers(now);
const views = buildCustomerViews(seed.customers, seed.managements, now);
const empty = { document: '', name: '', obligation: '', phone: '', email: '' };

describe('ficha de Control Next', () => {
  it('Datos: saldo total = vencido + intereses de mora + honorarios, y es determinista', () => {
    const v = views[0]!;
    const o = v.obligations[0]!;
    const f = obligationFigures(v, o, now);
    expect(f.clientNumber).toBe(v.document);
    expect(f.totalBalance).toBe(f.overdue + f.lateInterest + f.fees);
    expect(obligationFigures(v, o, now)).toEqual(f);
    expect(f.startDate < f.endDate).toBe(true);
  });

  it('Edad Cobranza por franjas de mora', () => {
    expect(collectionAge(10)).toBe('0-30');
    expect(collectionAge(45)).toBe('31-60');
    expect(collectionAge(200)).toBe('181-360');
    expect(collectionAge(400)).toBe('+360');
  });

  it('Histórico: de la más reciente a la más antigua, con efecto en mayúsculas y teléfono en la gestión', () => {
    const v = views.find((x) => x.managements.length > 1)!;
    const rows = historyRows(v);
    expect(rows).toHaveLength(v.managements.length);
    expect(rows[0]!.date >= rows[rows.length - 1]!.date).toBe(true);
    expect(rows[0]!.effect).toBe(rows[0]!.effect.toUpperCase());
    expect(rows[0]!.note.startsWith(`${rows[0]!.phone} // `)).toBe(true);
    expect(rows.every((r) => !r.ownPractice)).toBe(true);
  });

  it('Histórico: búsqueda y paginación como la tabla original', () => {
    const v = views.find((x) => x.managements.length > 1)!;
    const rows = historyRows(v);
    const page = pageHistory(rows, '', 1, 2);
    expect(page.items).toHaveLength(1);
    expect(page.from).toBe(2);
    expect(page.totalPages).toBe(rows.length);
    expect(pageHistory(rows, 'texto que no existe', 5, 1).total).toBe(0);
  });

  it('Buscar: por cédula exacta, por nombre sin tildes y sin criterios no devuelve nada', () => {
    const v = views[3]!;
    expect(searchCustomers(views, { ...empty, document: v.document }).map((x) => x.id)).toEqual([v.id]);
    const first = v.name.split(' ')[0]!.normalize('NFD').replace(/[̀-ͯ]/g, '');
    expect(searchCustomers(views, { ...empty, name: first }).some((x) => x.id === v.id)).toBe(true);
    expect(searchCustomers(views, empty)).toEqual([]);
    expect(searchCustomers(views, { ...empty, document: '999' })).toEqual([]);
  });

  it('Tiempo de gestión en horas, minutos y segundos', () => {
    expect(splitDuration(3725)).toEqual([1, 2, 5]);
    expect(hms(70)).toBe('00:01:10');
  });
});
