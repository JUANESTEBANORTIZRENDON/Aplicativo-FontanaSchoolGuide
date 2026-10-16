// Estructura común de las vistas internas: barra lateral, encabezado, leyenda de capacitación y contenido.

import type { SimContext } from '../context';
import type { Portfolio } from '../types/simulator';
import { combine, qs, type Cleanup } from '../utils/dom';
import { mountSidebar, sidebarTemplate, type NavKey } from './AppSidebar';
import { hydrateIcons } from './icons';
import { mountTopNavbar, topNavbarTemplate, type TopbarVariant } from './TopNavbar';
import { trainingNoticeTemplate } from './TrainingNotice';

export interface ShellOptions {
  portfolio: Portfolio | null;
  active: NavKey | null;
  topbar: TopbarVariant;
  /** Riel de íconos visible en escritorio (en la selección de carteras no hay riel). */
  rail: boolean;
  onSearch?: () => void;
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
        ${trainingNoticeTemplate('strip')}
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
  const cleanup = combine([
    mountSidebar(ctx, container),
    mountTopNavbar(ctx, container, opts.portfolio, { onSearch: opts.onSearch }),
  ]);
  return { main, cleanup };
}
