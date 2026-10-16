import { describe, expect, it } from 'vitest';
import { getManagementStatus } from '../domain/management-status';

const now = new Date(2026, 9, 16, 10, 30);
const daysAgo = (n: number, hour = 9): Date => new Date(2026, 9, 16 - n, hour, 0);

describe('getManagementStatus', () => {
  it('sin gestiones → sin gestión', () => {
    expect(getManagementStatus(null, now)).toBe('sin-gestion');
    expect(getManagementStatus(undefined, now)).toBe('sin-gestion');
    expect(getManagementStatus('fecha-invalida', now)).toBe('sin-gestion');
  });

  it('gestión de hoy → gestionado hoy (aunque sea a primera hora)', () => {
    expect(getManagementStatus(new Date(2026, 9, 16, 0, 1), now)).toBe('gestionado-hoy');
    expect(getManagementStatus(daysAgo(0).toISOString(), now)).toBe('gestionado-hoy');
  });

  it('entre 1 y 5 días de calendario → menos de 5 días', () => {
    expect(getManagementStatus(new Date(2026, 9, 15, 23, 59), now)).toBe('menos-5-dias');
    expect(getManagementStatus(daysAgo(5), now)).toBe('menos-5-dias');
  });

  it('más de 5 días → más de 5 días', () => {
    expect(getManagementStatus(daysAgo(6), now)).toBe('mas-5-dias');
    expect(getManagementStatus(daysAgo(40), now)).toBe('mas-5-dias');
  });

  it('cruza el cambio de mes por días de calendario', () => {
    const firstOfMonth = new Date(2026, 10, 1, 8, 0);
    expect(getManagementStatus(new Date(2026, 9, 31, 18, 0), firstOfMonth)).toBe('menos-5-dias');
  });
});
