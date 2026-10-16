import { obligationStatusLabel, profileLabel } from '../data/catalogs';
import { statusMeta } from '../domain/management-status';
import type { ManagementStatus, ObligationStatus, ProfileCode } from '../types/simulator';
import { esc } from '../utils/format';
import { icon } from './icons';

/** Semáforo de gestión: punto de color + ícono + texto, para no depender solo del color. */
export function statusBadge(status: ManagementStatus, compact = false): string {
  const meta = statusMeta(status);
  return `
    <span class="sim-status sim-status--${meta.code}" title="${esc(meta.label)}">
      <span class="sim-status__dot" aria-hidden="true"></span>
      ${icon(meta.icon, 'sim-status__icon')}
      <span>${esc(compact ? meta.short : meta.label)}</span>
    </span>`;
}

export function profileChip(code: ProfileCode): string {
  return `<span class="sim-profile sim-profile--${code}">${esc(profileLabel(code))}</span>`;
}

export function obligationChip(code: ObligationStatus): string {
  return `<span class="sim-oblig sim-oblig--${code}">${esc(obligationStatusLabel(code))}</span>`;
}
