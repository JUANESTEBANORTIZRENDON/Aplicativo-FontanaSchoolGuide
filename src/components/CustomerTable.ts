// Totales, tabla de clientes y paginación. En móvil cada fila se muestra como tarjeta (CSS).

import { PRIORITIES } from '../data/catalogs';
import type { Page } from '../domain/customer-filters';
import type { CustomerView } from '../types/simulator';
import { esc, formatCOP, formatDate } from '../utils/format';
import { emptyStateTemplate } from './EmptyState';
import { icon } from './icons';
import { obligationChip, profileChip, statusBadge } from './StatusBadge';

function row(v: CustomerView): string {
  const priority = PRIORITIES.find((p) => p.code === v.priority)?.label ?? v.priority;
  return `
    <tr>
      <td data-label="Identificación">${esc(v.document)}</td>
      <td data-label="Nombre" class="sim-table__name">
        <strong>${esc(v.name)}</strong>
        <span class="sim-table__sub">${esc(v.city)} · Prioridad ${esc(priority.toLowerCase())}</span>
      </td>
      <td data-label="Mejor perfil">${profileChip(v.bestProfile)}</td>
      <td data-label="Último perfil">${profileChip(v.lastProfile)}</td>
      <td data-label="Asesor">${esc(v.advisor)}</td>
      <td data-label="Fecha gestión">${esc(formatDate(v.lastManagement?.date))}</td>
      <td data-label="Total promesas" class="sim-num">${v.totalPromises}</td>
      <td data-label="Días de mora" class="sim-num">${v.maxDaysPastDue}</td>
      <td data-label="Saldo simulado" class="sim-num">${esc(formatCOP(v.totalBalance))}</td>
      <td data-label="Estado">
        <div class="sim-table__states">${statusBadge(v.status, true)}${v.obligationStatuses.map(obligationChip).join('')}</div>
      </td>
      <td data-label="Acción" class="sim-table__action">
        <button type="button" class="sim-btn sim-btn--primary sim-btn--sm" data-action="manage" data-customer="${esc(v.id)}"
          aria-label="Gestionar a ${esc(v.name)}">${icon('PhoneCall')} Gestionar</button>
      </td>
    </tr>`;
}

export function customerTableTemplate(page: Page<CustomerView>, totalObligations: number): string {
  const totals = `
    <div class="sim-totals" data-sim-guide="clientes.totales" aria-live="polite">
      <span class="sim-totals__item">Total de clientes: <span class="sim-totals__box">${page.total}</span></span>
      <span class="sim-totals__item">Total de obligaciones: <span class="sim-totals__box">${totalObligations}</span></span>
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
      <table class="sim-table">
        <caption class="sim-visually-hidden">Clientes de la cartera, página ${page.page} de ${page.totalPages}</caption>
        <thead>
          <tr>
            <th scope="col">Identificación</th>
            <th scope="col">Nombre</th>
            <th scope="col">Mejor perfil</th>
            <th scope="col">Último perfil</th>
            <th scope="col">Asesor</th>
            <th scope="col">Fecha gestión</th>
            <th scope="col">Total promesas</th>
            <th scope="col">Días de mora</th>
            <th scope="col">Saldo simulado</th>
            <th scope="col">Estado</th>
            <th scope="col"><span class="sim-visually-hidden">Acción</span></th>
          </tr>
        </thead>
        <tbody>${page.items.map(row).join('')}</tbody>
      </table>
    </div>
    <nav class="sim-pagination" aria-label="Paginación de clientes">
      <p>Mostrando ${page.from}–${page.to} de ${page.total}</p>
      <div>
        <button type="button" class="sim-btn sim-btn--ghost sim-btn--sm" data-action="prev-page" ${page.page <= 1 ? 'disabled' : ''}>
          ${icon('ChevronLeft')} Anterior
        </button>
        <span class="sim-pagination__page">Página ${page.page} de ${page.totalPages}</span>
        <button type="button" class="sim-btn sim-btn--ghost sim-btn--sm" data-action="next-page" ${page.page >= page.totalPages ? 'disabled' : ''}>
          Siguiente ${icon('ChevronRight')}
        </button>
      </div>
    </nav>`;
}
