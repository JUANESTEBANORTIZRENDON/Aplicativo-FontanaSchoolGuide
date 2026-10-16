// Perfil del asesor y selección de carteras.

import { advisorProfileTemplate } from '../components/AdvisorProfileCard';
import { mountAppShell } from '../components/AppShell';
import { hydrateIcons } from '../components/icons';
import { portfolioCardTemplate } from '../components/PortfolioCard';
import type { SimContext } from '../context';
import { PORTFOLIOS } from '../data/mock-portfolios';
import type { Cleanup } from '../utils/dom';

export function renderPortfolioSelectionPage(ctx: SimContext, container: HTMLElement): Cleanup {
  ctx.setTitle('Carteras');
  ctx.store.setActivePortfolio(null);
  const shell = mountAppShell(ctx, container, { portfolio: null, active: 'carteras', topbar: 'perfil', rail: false });

  shell.main.innerHTML = `
    <div class="sim-page sim-page--profile">
      <div class="sim-card sim-card--profile">
        ${advisorProfileTemplate(new Date())}
        <section class="sim-portfolios" aria-labelledby="sim-portfolios-title" data-sim-guide="carteras.listado">
          <h2 id="sim-portfolios-title" class="sim-portfolios__title">Carteras</h2>
          <div class="sim-portfolios__grid">
            ${PORTFOLIOS.map((p) =>
              portfolioCardTemplate(
                p,
                ctx.dataset.customers.filter((c) => c.portfolioId === p.id).length,
                ctx.href(`/cartera/${p.id}/panel`),
              ),
            ).join('')}
          </div>
        </section>
      </div>
    </div>`;
  hydrateIcons(shell.main);
  return shell.cleanup;
}
