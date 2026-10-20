// Plantillas de solo lectura de la ficha del cliente: información personal, datos, adicionales, acuerdos e histórico.

import { obligationStatusLabel, PRIORITIES } from '../../data/catalogs';
import { hms, historyRows, lastAgreement, obligationFigures, pageHistory } from '../../domain/control-next';
import type { CustomerView } from '../../types/simulator';
import { toDateKey, toDateTimeLocal } from '../../utils/dates';
import { esc, formatCOP, formatDate, formatDateTime } from '../../utils/format';
import { icon } from '../icons';
import { profileChip } from '../StatusBadge';

export const HISTORY_SIZES = [5, 10, 25];

export function money(value: number): string {
  return value ? formatCOP(value).replace(/\s/g, ' ') : '$ 0';
}

const cell = (label: string, value: string, guide = ''): string =>
  `<div class="sim-kv"${guide ? ` data-sim-guide="${guide}"` : ''}><span class="sim-kv__k">${label}</span><span class="sim-kv__v">${value}</span></div>`;

export function infoTemplate(v: CustomerView): string {
  const agreement = lastAgreement(v);
  const last = v.lastManagement;
  return `
    <div class="sim-kv-grid">
      ${cell('Nombre', esc(v.name.toUpperCase()))}
      ${cell('Identificacion', esc(v.document))}
      ${cell('Ciudad', esc(v.city))}
      ${cell('Fecha De Gestion', esc(last ? toDateKey(new Date(last.date)) : ''))}
      ${cell('Ultimo Perfil', last?.profile ? `<span class="sim-profile">${esc(last.profile)}</span>` : profileChip(v.lastProfile), 'ficha.perfiles')}
      ${cell('Mejor Perfil', profileChip(v.bestProfile))}
      ${cell('Asesor', esc(v.advisor))}
      ${cell('Fecha Agendado', `<input class="sim-kv__input" type="datetime-local" aria-label="Fecha agendado" data-agenda min="${toDateTimeLocal(new Date())}" />`, 'ficha.agenda')}
      ${cell('Fecha Pago', esc(agreement?.promiseDate ?? ''))}
      ${cell('Valor Pago', esc(agreement ? money(agreement.promiseAmount ?? 0) : ''))}
    </div>`;
}

export function dataTemplate(v: CustomerView, now: Date): string {
  return `
    <div class="sim-table-wrap" tabindex="0" role="region" aria-label="Obligaciones del cliente">
      <table class="sim-table sim-table--gold">
        <thead><tr>
          <th scope="col">Número de Cliente</th><th scope="col">Cuenta</th><th scope="col">Edad Cobranza</th><th scope="col">Valor Vencido</th>
          <th scope="col">Fecha Inicio</th><th scope="col">Fecha fin</th><th scope="col">Val. Int Mora</th><th scope="col">Saldo Total</th>
          <th scope="col">Honorarios</th><th scope="col">Referencias</th>
        </tr></thead>
        <tbody>
          ${v.obligations
            .map((o) => {
              const f = obligationFigures(v, o, now);
              return `<tr>
                <td>${esc(f.clientNumber)}</td><td>${esc(f.account)}</td><td>${esc(f.collectionAge)}</td><td>${esc(money(f.overdue))}</td>
                <td>${esc(f.startDate)}</td><td>${esc(f.endDate)}</td><td>${esc(money(f.lateInterest))}</td><td><strong>${esc(money(f.totalBalance))}</strong></td>
                <td>${esc(money(f.fees))}</td>
                <td><button type="button" class="sim-round-btn" data-action="references" aria-label="Ver referencias de la obligación ${esc(f.account)}">${icon('Info')}</button></td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    </div>`;
}

export function extraTemplate(v: CustomerView): string {
  const priority = PRIORITIES.find((p) => p.code === v.priority)?.label ?? v.priority;
  return `
    <div class="sim-table-wrap"><table class="sim-table sim-table--gold">
      <thead><tr><th scope="col">Producto</th><th scope="col">Obligación</th><th scope="col">Días de mora</th><th scope="col">Estado</th><th scope="col">Prioridad</th><th scope="col">Email</th></tr></thead>
      <tbody>${v.obligations
        .map((o) => `<tr><td>${esc(o.product)}</td><td>${esc(o.id.toUpperCase())}</td><td>${o.daysPastDue}</td><td>${esc(obligationStatusLabel(o.status))}</td><td>${esc(priority)}</td><td>${esc(v.email)}</td></tr>`)
        .join('')}</tbody>
    </table></div>`;
}

export function agreementsTemplate(v: CustomerView): string {
  const today = toDateKey(new Date());
  const list = v.managements.filter((m) => m.result === 'promesa-pago');
  if (!list.length) return '<p class="sim-help sim-pad">Este cliente no tiene acuerdos de pago registrados.</p>';
  return `
    <div class="sim-table-wrap"><table class="sim-table sim-table--compact">
      <thead><tr><th scope="col">Fecha del acuerdo</th><th scope="col">Perfil</th><th scope="col">Fecha de pago</th><th scope="col">Valor</th><th scope="col">Asesor</th><th scope="col">Estado</th></tr></thead>
      <tbody>${[...list]
        .reverse()
        .map((m) => `<tr><td>${esc(formatDateTime(m.date))}</td><td>${esc(m.profile ?? 'Acuerdo de pago')}</td><td>${esc(formatDate(m.promiseDate))}</td><td>${esc(money(m.promiseAmount ?? 0))}</td><td>${esc(m.advisor)}</td>
          <td>${(m.promiseDate ?? '') >= today ? '<span class="sim-pill sim-pill--ok">Vigente</span>' : '<span class="sim-pill sim-pill--late">Vencido</span>'}</td></tr>`)
        .join('')}</tbody>
    </table></div>`;
}

export function historyTemplate(v: CustomerView, text: string, size: number, page: number): string {
  const p = pageHistory(historyRows(v), text, size, page);
  const rows = p.items.length
    ? p.items
        .map(
          (r) => `<tr class="${r.ownPractice ? 'is-own' : ''}">
            <td>${esc(formatDateTime(r.date))}</td><td>${esc(r.user)}</td><td>${esc(r.action)}</td><td>${esc(r.effect)}</td><td>${esc(r.contact)}</td>
            <td>${esc(r.phone)}</td><td class="sim-cn-hist__note">${esc(r.note)}</td><td>${hms(r.managementSec)}</td><td>${hms(r.callSec)}</td>
            <td>${esc(r.reason)}</td><td>${esc(money(r.promise))}</td>
            <td><button type="button" class="sim-play" data-action="audio" aria-label="Escuchar la grabación">${icon('CirclePlay')}</button></td>
          </tr>`,
        )
        .join('')
    : `<tr><td colspan="12" class="sim-help sim-pad">${text ? 'Ningún registro coincide con la búsqueda.' : 'Este cliente todavía no tiene gestiones.'}</td></tr>`;
  return `
    <div class="sim-table-wrap" tabindex="0" role="region" aria-label="Histórico de gestiones">
      <table class="sim-table sim-table--cn sim-cn-hist">
        <thead><tr>
          <th scope="col">Fecha / Hora</th><th scope="col">Usuario</th><th scope="col">Acción</th><th scope="col">Efecto</th><th scope="col">Contacto</th>
          <th scope="col">Teléfono</th><th scope="col">Gestión</th><th scope="col">Tiempo Gestión</th><th scope="col">Tiempo Llamada</th>
          <th scope="col">Motivo N.P.</th><th scope="col">Promesa</th><th scope="col">Audio</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="sim-cn-hist__foot">
      <p>Mostrando registros del ${p.from} al ${p.to} de un total de ${p.total} registros</p>
      <div class="sim-pager">
        <button type="button" data-action="hist-prev" ${p.page <= 1 ? 'disabled' : ''}>Anterior</button>
        <span class="is-current">${p.page}</span>
        <button type="button" data-action="hist-next" ${p.page >= p.totalPages ? 'disabled' : ''}>Siguiente</button>
      </div>
    </div>`;
}
