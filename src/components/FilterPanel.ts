// Panel de filtros de Clientes: rejilla de 4 columnas como en la referencia, más la fila de búsqueda.

import {
  ADVISORS,
  CITIES,
  OBLIGATION_STATUSES,
  PRIORITIES,
  PROFILE_OPTIONS,
  SORT_FIELDS,
} from '../data/catalogs';
import type {
  CustomerFilters,
  ManagementStatus,
  ObligationStatus,
  Priority,
  ProfileCode,
  SortDir,
  SortField,
} from '../types/simulator';
import { qs } from '../utils/dom';
import { esc } from '../utils/format';
import { icon } from './icons';
import { multiSelectTemplate, readMultiSelect } from './MultiSelect';
import { statusLegendTemplate } from './StatusLegend';

const option = (value: string, label: string, selected: string): string =>
  `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(label)}</option>`;

export function filterPanelTemplate(
  f: CustomerFilters,
  counts: Partial<Record<ManagementStatus, number>>,
): string {
  const profiles = PROFILE_OPTIONS.map((p) => ({ value: p.code, label: p.label }));
  return `
    <form class="sim-filters" novalidate aria-label="Filtros de clientes">
      <div class="sim-filters__grid">
        <fieldset class="sim-field-group">
          <legend class="sim-label">Fecha de promesa</legend>
          <label class="sim-visually-hidden" for="sim-f-promise-from">Fecha de promesa desde</label>
          <input class="sim-input" type="date" id="sim-f-promise-from" name="promiseFrom" value="${esc(f.promiseFrom)}" />
          <label class="sim-visually-hidden" for="sim-f-promise-to">Fecha de promesa hasta</label>
          <input class="sim-input" type="date" id="sim-f-promise-to" name="promiseTo" value="${esc(f.promiseTo)}" />
        </fieldset>
        <fieldset class="sim-field-group">
          <legend class="sim-label">Fecha de gestión</legend>
          <label class="sim-visually-hidden" for="sim-f-managed-from">Fecha de gestión desde</label>
          <input class="sim-input" type="date" id="sim-f-managed-from" name="managedFrom" value="${esc(f.managedFrom)}" />
          <label class="sim-visually-hidden" for="sim-f-managed-to">Fecha de gestión hasta</label>
          <input class="sim-input" type="date" id="sim-f-managed-to" name="managedTo" value="${esc(f.managedTo)}" />
        </fieldset>
        <fieldset class="sim-field-group">
          <legend class="sim-label">Ordenar por</legend>
          <label class="sim-visually-hidden" for="sim-f-sort">Campo de orden</label>
          <select class="sim-input" id="sim-f-sort" name="sortField">
            ${SORT_FIELDS.map((s) => option(s.code, s.label, f.sortField)).join('')}
          </select>
          <label class="sim-visually-hidden" for="sim-f-dir">Dirección del orden</label>
          <select class="sim-input" id="sim-f-dir" name="sortDir">
            ${option('asc', 'Ascendente', f.sortDir)}${option('desc', 'Descendente', f.sortDir)}
          </select>
        </fieldset>
        <div class="sim-field">
          <label class="sim-label" for="sim-f-city">Ciudad</label>
          <select class="sim-input" id="sim-f-city" name="city">
            ${option('', 'Todas las ciudades', f.city)}${CITIES.map((c) => option(c, c, f.city)).join('')}
          </select>
        </div>

        <div class="sim-field">
          <label class="sim-label" for="sim-f-advisor">Asesor</label>
          <select class="sim-input" id="sim-f-advisor" name="advisor">
            ${option('', 'Todos los asesores', f.advisor)}${ADVISORS.map((a) => option(a.username, a.username, f.advisor)).join('')}
          </select>
        </div>
        ${multiSelectTemplate('sim-f-best', 'Mejor perfil', profiles, f.bestProfiles)}
        ${multiSelectTemplate('sim-f-last', 'Último perfil', profiles, f.lastProfiles)}
        ${statusLegendTemplate(f.statuses, counts)}

        <div class="sim-field sim-field--search">
          <label class="sim-label" for="sim-filter-text">Buscar por nombre o documento</label>
          <div class="sim-input-icon">
            ${icon('Search')}
            <input class="sim-input" type="search" id="sim-filter-text" name="text" value="${esc(f.text)}" autocomplete="off" placeholder="Ej.: Gómez o 1000…" />
          </div>
        </div>
        <div class="sim-field">
          <label class="sim-label" for="sim-f-priority">Prioridad</label>
          <select class="sim-input" id="sim-f-priority" name="priority">
            ${option('', 'Todas', f.priority)}${PRIORITIES.map((p) => option(p.code, p.label, f.priority)).join('')}
          </select>
        </div>
        <div class="sim-field">
          <label class="sim-label" for="sim-f-oblig">Estado de la obligación</label>
          <select class="sim-input" id="sim-f-oblig" name="obligationStatus">
            ${option('', 'Todos', f.obligationStatus)}${OBLIGATION_STATUSES.map((s) => option(s.code, s.label, f.obligationStatus)).join('')}
          </select>
        </div>
        <div class="sim-filters__actions">
          <button type="button" class="sim-btn sim-btn--secondary" data-action="reset-filters">${icon('Power')} Restablecer</button>
          <button type="submit" class="sim-btn sim-btn--search">${icon('Search')} Buscar</button>
        </div>
      </div>
    </form>`;
}

/** Lee el formulario. Los estados del semáforo se aplican al instante, por eso llegan aparte. */
export function readFilterForm(form: HTMLFormElement, statuses: ManagementStatus[]): CustomerFilters {
  const value = (name: string): string => qs<HTMLInputElement | HTMLSelectElement>(form, `[name="${name}"]`).value;
  return {
    promiseFrom: value('promiseFrom'),
    promiseTo: value('promiseTo'),
    managedFrom: value('managedFrom'),
    managedTo: value('managedTo'),
    sortField: value('sortField') as SortField,
    sortDir: value('sortDir') as SortDir,
    city: value('city'),
    advisor: value('advisor'),
    bestProfiles: readMultiSelect(form, 'sim-f-best') as ProfileCode[],
    lastProfiles: readMultiSelect(form, 'sim-f-last') as ProfileCode[],
    statuses,
    text: value('text'),
    priority: value('priority') as Priority | '',
    obligationStatus: value('obligationStatus') as ObligationStatus | '',
  };
}
