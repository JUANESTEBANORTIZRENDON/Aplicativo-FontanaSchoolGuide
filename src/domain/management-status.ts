import type { ManagementStatus } from '../types/simulator';
import { calendarDaysBetween } from '../utils/dates';

/**
 * Semáforo "Estado de gestión de cartera" a partir de la última gestión:
 * sin gestiones → sin gestión; hoy → gestionado hoy; 1 a 5 días → menos de 5 días; más → más de 5 días.
 */
export function getManagementStatus(lastManagementAt: Date | string | null | undefined, now: Date): ManagementStatus {
  if (!lastManagementAt) return 'sin-gestion';
  const last = lastManagementAt instanceof Date ? lastManagementAt : new Date(lastManagementAt);
  if (Number.isNaN(last.getTime())) return 'sin-gestion';
  const days = calendarDaysBetween(last, now);
  if (days <= 0) return 'gestionado-hoy';
  if (days <= 5) return 'menos-5-dias';
  return 'mas-5-dias';
}

export interface StatusMeta {
  code: ManagementStatus;
  label: string;
  short: string;
  /** Nombre del token CSS del color. */
  color: string;
  icon: string;
}

/** En el orden de la leyenda de la captura. */
export const STATUS_META: StatusMeta[] = [
  { code: 'sin-gestion', label: 'Sin gestión', short: 'Sin gestión', color: '--sim-info', icon: 'Circle' },
  { code: 'menos-5-dias', label: 'Menos de 5 días sin gestión', short: '≤ 5 días', color: '--sim-warning', icon: 'Clock3' },
  { code: 'mas-5-dias', label: 'Más de 5 días sin gestión', short: '> 5 días', color: '--sim-danger', icon: 'TriangleAlert' },
  { code: 'gestionado-hoy', label: 'Gestionado hoy', short: 'Hoy', color: '--sim-success', icon: 'CircleCheck' },
];

export function statusMeta(code: ManagementStatus): StatusMeta {
  return STATUS_META.find((s) => s.code === code) ?? STATUS_META[0]!;
}
