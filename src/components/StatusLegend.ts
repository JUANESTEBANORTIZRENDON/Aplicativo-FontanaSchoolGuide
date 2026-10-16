import { STATUS_META } from '../domain/management-status';
import type { ManagementStatus } from '../types/simulator';
import { esc } from '../utils/format';

/** Leyenda "Estado de gestión de cartera". Cada estado es un botón que activa o desactiva el filtro. */
export function statusLegendTemplate(active: ManagementStatus[], counts?: Partial<Record<ManagementStatus, number>>): string {
  return `
    <fieldset class="sim-legend" data-sim-guide="clientes.semaforo">
      <legend class="sim-label">Estado de gestión de cartera</legend>
      <ul class="sim-legend__list">
        ${STATUS_META.map((s) => {
          const pressed = active.includes(s.code);
          const count = counts?.[s.code];
          return `
          <li>
            <button type="button" class="sim-legend__item sim-status--${s.code}" data-status="${s.code}" aria-pressed="${pressed}">
              <span class="sim-status__dot" aria-hidden="true"></span>
              <span>${esc(s.label)}</span>
              ${count === undefined ? '' : `<span class="sim-legend__count">${count}</span>`}
            </button>
          </li>`;
        }).join('')}
      </ul>
    </fieldset>`;
}
