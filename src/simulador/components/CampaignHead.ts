// Pestañas de la campaña (Archivos · Clientes · G.C - cédula) y ruta de navegación, como en Control Next.

import type { SimContext } from '../context';
import type { Portfolio } from '../types/simulator';
import { esc } from '../utils/format';
import { breadcrumbTemplate } from './Breadcrumb';
import { icon } from './icons';

export type CampaignTab = 'archivos' | 'clientes' | 'ficha';

export function campaignHeadTemplate(ctx: SimContext, portfolio: Portfolio, active: CampaignTab): string {
  const base = `/cartera/${portfolio.id}`;
  const openId = ctx.store.get().openCustomers[portfolio.id];
  const open = openId ? ctx.findView(openId) : undefined;
  const tab = (label: string, href: string, isActive: boolean, extra = ''): string =>
    `<span class="sim-tabs__item${isActive ? ' is-active' : ''}"><a class="sim-tabs__tab${isActive ? ' is-active' : ''}" href="${esc(href)}" ${isActive ? 'aria-current="page"' : ''}>${label}</a>${extra}</span>`;
  const crumbs =
    active === 'ficha'
      ? [{ label: 'Home', href: ctx.href('/carteras') }, { label: 'Campaña' }]
      : [{ label: 'Dashboard', href: ctx.href('/carteras') }, { label: active === 'clientes' ? 'Clientes' : 'Archivos' }];
  return `
    <div class="sim-page-head">
      <nav class="sim-tabs" aria-label="Secciones de la campaña" data-sim-guide="clientes.pestanas">
        ${tab('Archivos', ctx.href(`${base}/clientes/archivos`), active === 'archivos')}
        ${tab('Clientes', ctx.href(`${base}/clientes`), active === 'clientes')}
        ${
          open
            ? tab(
                `G.C - ${esc(open.document)}`,
                ctx.href(`${base}/cliente/${open.id}`),
                active === 'ficha',
                `<button type="button" class="sim-tabs__close" data-action="close-customer" aria-label="Cerrar la ficha de ${esc(open.name)}">${icon('CircleX')}</button>`,
              )
            : ''
        }
      </nav>
      ${breadcrumbTemplate(crumbs)}
    </div>`;
}

/** Cierra la pestaña de la ficha abierta (botón × de «G.C - cédula»). */
export function handleCampaignHeadClick(ctx: SimContext, portfolio: Portfolio, event: Event): boolean {
  if (!(event.target as HTMLElement).closest('[data-action="close-customer"]')) return false;
  ctx.store.setOpenCustomer(portfolio.id, null);
  ctx.navigate(`/cartera/${portfolio.id}/clientes`);
  return true;
}
