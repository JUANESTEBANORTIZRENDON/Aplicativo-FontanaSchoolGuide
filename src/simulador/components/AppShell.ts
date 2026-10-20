// Estructura común de las vistas internas: barra lateral, encabezado, panel «Buscar» y contenido.

import type { SimContext } from '../context';
import type { Portfolio } from '../types/simulator';
import { combine, qs, type Cleanup } from '../utils/dom';
import { mountSidebar, sidebarTemplate, type NavKey } from './AppSidebar';
import { hydrateIcons } from './icons';
import { mountSearchPanel } from './SearchPanel';
import { mountTopNavbar, topNavbarTemplate, type TopbarVariant } from './TopNavbar';

export interface ShellOptions {
  portfolio: Portfolio | null;
  active: NavKey | null;
  topbar: TopbarVariant;
  /** Riel de íconos visible en escritorio (en la selección de carteras no hay riel). */
  rail: boolean;
}

export interface Shell {
  main: HTMLElement;
  cleanup: Cleanup;
}

export function mountAppShell(ctx: SimContext, container: HTMLElement, opts: ShellOptions): Shell {
  container.innerHTML = `
    <div class="sim-shell${opts.rail ? ' sim-shell--rail' : ''}">
      <a class="sim-skip-link" href="#sim-main">Saltar al contenido</a>
      ${sidebarTemplate(ctx, opts.portfolio, opts.active, opts.rail)}
      <div class="sim-shell__body">
        ${topNavbarTemplate(ctx, opts.topbar, opts.portfolio)}
        <main class="sim-main" id="sim-main" tabindex="-1"></main>
      </div>
    </div>`;
  hydrateIcons(container);
  const main = qs(container, '#sim-main');
  const skip = qs(container, '.sim-skip-link');
  skip.addEventListener('click', (e) => {
    e.preventDefault();
    main.focus();
  });
  // La lupa del encabezado abre el panel «Buscar» (solo dentro de una campaña).
  const search = opts.portfolio ? mountSearchPanel(ctx) : null;
  const cleanup = combine([
    mountSidebar(ctx, container),
    mountTopNavbar(ctx, container, opts.portfolio, { onSearch: () => search?.open() }),
    () => search?.cleanup(),
  ]);
  return { main, cleanup };
}
