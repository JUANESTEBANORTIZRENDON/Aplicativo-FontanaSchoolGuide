// Panel lateral «Buscar» de Control Next: busca un cliente en todas las campañas por cédula, nombre, obligación,
// teléfono o correo. El resultado se muestra en la ventana «Busqueda Cliente» y al pulsar OK se abre su ficha.

import type { SimContext } from '../context';
import { findPortfolio, PORTFOLIOS } from '../data/mock-portfolios';
import { searchCustomers, type SearchQuery } from '../domain/control-next';
import type { CustomerView } from '../types/simulator';
import { combine, on, qs, trapFocus, type Cleanup } from '../utils/dom';
import { esc } from '../utils/format';
import { hydrateIcons, icon } from './icons';
import { openModal } from './Modal';

const FIELDS: { name: keyof SearchQuery | 'coDocument' | 'coPhone'; label: string; icon: string; mode?: string }[] = [
  { name: 'document', label: 'Cédula', icon: 'IdCard', mode: 'numeric' },
  { name: 'name', label: 'Nombre', icon: 'UserRound' },
  { name: 'obligation', label: 'Número de Obligación', icon: 'Wallet' },
  { name: 'phone', label: 'Teléfono', icon: 'Phone', mode: 'tel' },
  { name: 'email', label: 'Email', icon: 'AtSign', mode: 'email' },
];

const CO_FIELDS: typeof FIELDS = [
  { name: 'coDocument', label: 'Cédula codeudor', icon: 'IdCard', mode: 'numeric' },
  { name: 'coPhone', label: 'Celular codeudor', icon: 'Phone', mode: 'tel' },
];

function field(f: (typeof FIELDS)[number]): string {
  return `
    <div class="sim-search-field">
      <span class="sim-search-field__addon" aria-hidden="true">${icon(f.icon)}</span>
      <label class="sim-visually-hidden" for="sim-search-${f.name}">${esc(f.label)}</label>
      <input class="sim-input" id="sim-search-${f.name}" name="${f.name}" placeholder="${esc(f.label)}" autocomplete="off" ${f.mode ? `inputmode="${f.mode}"` : ''} />
    </div>`;
}

export interface SearchPanel {
  open(): void;
  close(): void;
  cleanup: Cleanup;
}

export function mountSearchPanel(ctx: SimContext): SearchPanel {
  const host = document.createElement('div');
  host.className = 'sim-search-host';
  host.hidden = true;
  host.innerHTML = `
    <div class="sim-search-overlay" data-search-close></div>
    <aside class="sim-search" role="dialog" aria-modal="true" aria-labelledby="sim-search-title" data-sim-guide="buscar.panel">
      <div class="sim-search__head">
        <h2 id="sim-search-title" class="sim-search__title">Buscar</h2>
        <button type="button" class="sim-icon-btn" data-search-close aria-label="Cerrar búsqueda">${icon('X')}</button>
      </div>
      <form class="sim-search__form" novalidate>
        <div class="sim-search__group" data-sim-guide="buscar.cedula">${field(FIELDS[0]!)}</div>
        ${FIELDS.slice(1).map(field).join('')}
        <p class="sim-search__label">Codeudor</p>
        ${CO_FIELDS.map(field).join('')}
        <label class="sim-search__tab"><input type="checkbox" name="newTab" /> Abrir en otra pestaña</label>
        <p class="sim-form-summary" role="alert" data-search-error></p>
        <button type="submit" class="sim-btn sim-btn--primary sim-search__submit" data-sim-guide="buscar.boton">${icon('Search')} Buscar</button>
      </form>
    </aside>`;
  hydrateIcons(host);
  ctx.root.append(host);

  const form = qs<HTMLFormElement>(host, 'form');
  const panel = qs(host, '.sim-search');
  const error = qs(host, '[data-search-error]');
  let opener: HTMLElement | null = null;

  const open = (): void => {
    opener = document.activeElement as HTMLElement | null;
    host.hidden = false;
    error.textContent = '';
    requestAnimationFrame(() => host.classList.add('is-open'));
    qs<HTMLInputElement>(form, '[name="document"]').focus();
  };
  const close = (): void => {
    host.classList.remove('is-open');
    host.hidden = true;
    if (opener?.isConnected) opener.focus();
  };

  const allViews = (): CustomerView[] => PORTFOLIOS.flatMap((p) => ctx.getViews(p.id));
  const value = (name: string): string => qs<HTMLInputElement>(form, `[name="${name}"]`).value;

  const showResult = async (found: CustomerView[], newTab: boolean): Promise<void> => {
    if (!found.length) {
      await openModal(ctx.root, {
        title: 'Busqueda Cliente',
        body: '<p>No se encontró ningún cliente con los datos ingresados. Revisa la cédula (solo números, sin puntos) e inténtalo de nuevo.</p>',
      });
      return;
    }
    const [first] = found;
    const many = found.length > 1;
    const body = many
      ? `<p>Se encontraron ${found.length} clientes. Elige a quién quieres gestionar:</p>
         <ul class="sim-modal__list">${found
           .slice(0, 8)
           .map((v) => `<li><button type="button" class="sim-btn sim-btn--ghost sim-btn--sm" data-modal-value="${esc(v.id)}">${esc(v.name.toUpperCase())} · ${esc(v.document)} · ${esc(findPortfolio(v.portfolioId)?.name ?? '')}</button></li>`)
           .join('')}</ul>`
      : `<p>El cliente pertenece a la campaña: ${esc(findPortfolio(first!.portfolioId)?.name ?? '')}.</p>
         <p>Nombre: ${esc(first!.name.toUpperCase())}.</p>
         <p>Identificación: ${esc(first!.document)}</p>`;
    const choice = await openModal(ctx.root, {
      title: 'Busqueda Cliente',
      body,
      actions: many ? [{ label: 'Cancelar', value: 'cancel' }] : [{ label: 'OK', value: first!.id, kind: 'primary' }],
      guide: 'buscar.resultado',
    });
    const chosen = found.find((v) => v.id === choice);
    if (!chosen) return;
    close();
    if (newTab) ctx.toast('En Control Next la ficha se abriría en otra pestaña del navegador; en la práctica se abre aquí.', 'info');
    ctx.navigate(`/cartera/${chosen.portfolioId}/cliente/${chosen.id}`);
  };

  const cleanup = combine([
    () => host.remove(),
    trapFocus(panel),
    on(host, 'click', (e) => {
      if ((e.target as HTMLElement).closest('[data-search-close]')) close();
    }),
    on(host, 'keydown', (e) => {
      if (e.key === 'Escape' && !ctx.root.querySelector('.sim-modal-overlay')) close();
    }),
    on(form, 'submit', (e) => {
      e.preventDefault();
      const query: SearchQuery = {
        document: value('document'),
        name: value('name'),
        obligation: value('obligation'),
        phone: value('phone'),
        email: value('email'),
      };
      const coDoc = value('coDocument').trim();
      const coPhone = value('coPhone').trim();
      if (!Object.values(query).some((v) => v.trim())) {
        error.textContent = coDoc || coPhone
          ? 'En la práctica los clientes no tienen codeudor registrado. Busca por la cédula del titular.'
          : 'Escribe al menos un dato: la cédula es la forma más rápida.';
        return;
      }
      error.textContent = '';
      void showResult(searchCustomers(allViews(), query), qs<HTMLInputElement>(form, '[name="newTab"]').checked);
    }),
  ]);

  return { open, close, cleanup };
}
