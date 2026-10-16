// Barra lateral: riel de íconos que se expande superpuesto al contenido. En móvil es un cajón.

import type { SimContext } from '../context';
import { PRACTICE_ADVISOR } from '../data/catalogs';
import type { Portfolio } from '../types/simulator';
import { combine, focusableIn, on, qs, qsa, type Cleanup } from '../utils/dom';
import { esc } from '../utils/format';
import { icon } from './icons';

export type NavKey =
  | 'inicio'
  | 'carteras'
  | 'clientes'
  | 'llamadas'
  | 'compromisos'
  | 'productividad'
  | 'pausas'
  | 'reportes'
  | 'ayuda';

interface NavItem {
  key: NavKey;
  label: string;
  icon: string;
  path: (id: string) => string;
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'inicio', label: 'Inicio', icon: 'House', path: (id) => `/cartera/${id}/panel` },
  { key: 'carteras', label: 'Carteras', icon: 'Briefcase', path: () => '/carteras' },
  { key: 'clientes', label: 'Clientes', icon: 'Users', path: (id) => `/cartera/${id}/clientes` },
  { key: 'llamadas', label: 'Llamadas', icon: 'PhoneCall', path: (id) => `/cartera/${id}/llamadas` },
  { key: 'compromisos', label: 'Compromisos', icon: 'Handshake', path: (id) => `/cartera/${id}/compromisos` },
  { key: 'productividad', label: 'Productividad', icon: 'ChartColumn', path: (id) => `/cartera/${id}/productividad` },
  { key: 'pausas', label: 'Pausas', icon: 'CirclePause', path: (id) => `/cartera/${id}/pausas` },
  { key: 'reportes', label: 'Reportes', icon: 'FileChartColumn', path: (id) => `/cartera/${id}/reportes` },
  { key: 'ayuda', label: 'Ayuda', icon: 'CircleQuestionMark', path: (id) => `/cartera/${id}/ayuda` },
];

export function sidebarTemplate(ctx: SimContext, portfolio: Portfolio | null, active: NavKey | null, rail: boolean): string {
  const items = portfolio ? NAV_ITEMS : NAV_ITEMS.filter((i) => i.key === 'carteras');
  const fullName = `${PRACTICE_ADVISOR.firstName} ${PRACTICE_ADVISOR.lastNames}`;
  return `
    <aside class="sim-sidebar${rail ? '' : ' sim-sidebar--no-rail'}" data-open="false" data-sim-guide="comun.barra-lateral">
      <div class="sim-sidebar__rail-top">
        <button type="button" class="sim-sidebar__toggle" data-sidebar-toggle aria-expanded="false" aria-controls="sim-sidebar-panel" aria-label="Abrir menú">
          ${icon('Menu')}
        </button>
      </div>
      <div class="sim-sidebar__panel" id="sim-sidebar-panel">
        <div class="sim-sidebar__header">
          <span class="sim-sidebar__portfolio">${esc(portfolio?.name ?? 'Selecciona una cartera')}</span>
          <button type="button" class="sim-sidebar__close" data-sidebar-close aria-label="Cerrar menú">${icon('Menu')}</button>
        </div>
        <div class="sim-sidebar__user">
          <span class="sim-avatar sim-avatar--lg" aria-hidden="true">${icon('UserRound')}</span>
          <span class="sim-sidebar__user-name">${esc(fullName)}</span>
        </div>
        <nav aria-label="Menú del simulador">
          <ul class="sim-sidebar__list">
            ${items
              .map((item) => {
                const isActive = item.key === active;
                return `
                <li>
                  <a class="sim-sidebar__link${isActive ? ' is-active' : ''}" href="${esc(ctx.href(item.path(portfolio?.id ?? '')))}"
                     title="${esc(item.label)}" ${isActive ? 'aria-current="page"' : ''}>
                    ${icon(item.icon)}<span class="sim-sidebar__label">${esc(item.label)}</span>
                  </a>
                </li>`;
              })
              .join('')}
          </ul>
          <button type="button" class="sim-sidebar__link sim-sidebar__logout" data-action="logout" title="Salir del simulador">
            ${icon('LogOut')}<span class="sim-sidebar__label">Salir del simulador</span>
          </button>
        </nav>
      </div>
    </aside>
    <div class="sim-sidebar-backdrop" data-sidebar-backdrop hidden></div>`;
}

/** Abre y cierra la barra lateral. Cualquier `[data-sidebar-toggle]` dentro de `scope` la controla. */
export function mountSidebar(ctx: SimContext, scope: HTMLElement): Cleanup {
  const sidebar = qs(scope, '.sim-sidebar');
  const backdrop = qs(scope, '[data-sidebar-backdrop]');
  const panel = qs(sidebar, '.sim-sidebar__panel');
  let opener: HTMLElement | null = null;

  const isOpen = (): boolean => sidebar.dataset.open === 'true';
  const setOpen = (open: boolean, trigger?: HTMLElement): void => {
    sidebar.dataset.open = String(open);
    backdrop.hidden = !open;
    for (const btn of qsa(scope, '[data-sidebar-toggle]')) {
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    }
    if (open) {
      opener = trigger ?? null;
      (focusableIn(panel)[0] ?? panel).focus();
    } else {
      opener?.focus();
      opener = null;
    }
  };

  const cleanups: Cleanup[] = [
    on(scope, 'click', (event) => {
      const target = event.target as HTMLElement;
      const toggle = target.closest<HTMLElement>('[data-sidebar-toggle]');
      if (toggle) {
        setOpen(!isOpen(), toggle);
        return;
      }
      if (target.closest('[data-sidebar-close]') || target.closest('[data-sidebar-backdrop]')) {
        setOpen(false);
        return;
      }
      // Solo el botón de la barra; el menú del avatar tiene su propio "Salir".
      if (target.closest('.sim-sidebar [data-action="logout"]')) {
        ctx.logout();
        return;
      }
      if (target.closest('.sim-sidebar__link') && isOpen()) {
        sidebar.dataset.open = 'false';
        backdrop.hidden = true;
      }
    }),
    on(document, 'keydown', (event) => {
      if (event.key === 'Escape' && isOpen()) setOpen(false);
    }),
  ];
  return combine(cleanups);
}
