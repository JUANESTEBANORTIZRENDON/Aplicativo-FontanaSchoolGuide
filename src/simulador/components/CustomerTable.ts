// Totales, tabla de clientes (las 7 columnas de Control Next) y paginación. En móvil cada fila es una tarjeta (CSS).

import type { Page } from '../domain/customer-filters';
import { statusMeta } from '../domain/management-status';
import type { CustomerView } from '../types/simulator';
import { esc, formatDate } from '../utils/format';
import { emptyStateTemplate } from './EmptyState';
import { icon } from './icons';
import { profileChip } from './StatusBadge';

function row(v: CustomerView): string {
  const status = statusMeta(v.status);
  return `
    <tr class="sim-row--${v.status}" data-row-customer="${esc(v.id)}">
      <td data-label="Identificacion">
        <button type="button" class="sim-ident" data-action="manage" data-customer="${esc(v.id)}"
          aria-label="Abrir la ficha de ${esc(v.name)} (${esc(status.label)})" title="${esc(status.label)}">
          <span class="sim-status__dot sim-status__dot--${v.status}" aria-hidden="true"></span>${esc(v.document)}
        </button>
      </td>
      <td data-label="Nombre" class="sim-table__name">${esc(v.name.toUpperCase())}</td>
      <td data-label="Mejor Perfil">${profileChip(v.bestProfile)}</td>
      <td data-label="Ultimo Perfil">${profileChip(v.lastProfile)}</td>
      <td data-label="Asesor">${esc(v.advisor)}</td>
      <td data-label="Fecha Gestion">${esc(formatDate(v.lastManagement?.date))}</td>
      <td data-label="Total Promesas" class="sim-num">${v.totalPromises}</td>
    </tr>`;
}

export function customerTableTemplate(page: Page<CustomerView>, totalObligations: number): string {
  const totals = `
    <div class="sim-totals" data-sim-guide="clientes.totales" aria-live="polite">
      <span class="sim-totals__item">Total de clientes: <span class="sim-totals__box">${page.total}</span></span>
      <span class="sim-totals__item">Total de Obligaciones: <span class="sim-totals__box">${totalObligations}</span></span>
    </div>`;

  if (page.total === 0) {
    return `${totals}${emptyStateTemplate(
      'No hay clientes con esos filtros',
      'Prueba con otro rango de fechas, otro asesor o quita algún estado del semáforo.',
      { label: 'Restablecer filtros', name: 'reset-filters' },
    )}`;
  }

  return `
    ${totals}
    <div class="sim-table-wrap" data-sim-guide="clientes.tabla" tabindex="0" role="region" aria-label="Tabla de clientes">
      <table class="sim-table sim-table--cn">
        <caption class="sim-visually-hidden">Clientes de la campaña, página ${page.page} de ${page.totalPages}</caption>
        <thead>
          <tr>
            <th scope="col">Identificacion</th>
            <th scope="col">Nombre</th>
            <th scope="col">Mejor Perfil</th>
            <th scope="col">Ultimo Perfil</th>
            <th scope="col">Asesor</th>
            <th scope="col">Fecha Gestion</th>
            <th scope="col">Total Promesas</th>
          </tr>
        </thead>
        <tbody>${page.items.map(row).join('')}</tbody>
      </table>
    </div>
    <nav class="sim-pagination" aria-label="Paginación de clientes">
      <p>Mostrando registros del ${page.from} al ${page.to} de un total de ${page.total} registros</p>
      <div>
        <button type="button" class="sim-btn sim-btn--ghost sim-btn--sm" data-action="prev-page" ${page.page <= 1 ? 'disabled' : ''}>
          ${icon('ChevronLeft')} Anterior
        </button>
        <span class="sim-pagination__page">${page.page} / ${page.totalPages}</span>
        <button type="button" class="sim-btn sim-btn--ghost sim-btn--sm" data-action="next-page" ${page.page >= page.totalPages ? 'disabled' : ''}>
          Siguiente ${icon('ChevronRight')}
        </button>
      </div>
    </nav>`;
}
