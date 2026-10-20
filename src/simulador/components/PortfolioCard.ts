import type { Portfolio } from '../types/simulator';
import { esc, pluralize } from '../utils/format';
import { portfolioLogo } from './Logo';

/** Tarjeta de campaña como en Control Next: toda la tarjeta es el enlace y solo muestra el logo de la campaña. */
export function portfolioCardTemplate(p: Portfolio, customers: number, href: string): string {
  return `
    <a class="sim-portfolio-card sim-portfolio-card--${esc(p.logo)}" href="${esc(href)}" data-portfolio="${esc(p.id)}"
       title="${esc(`${p.name} · ${pluralize(customers, 'cliente', 'clientes')}`)}">
      <span class="sim-portfolio-card__logo">${portfolioLogo(p)}</span>
      <span class="sim-visually-hidden">Ingresar a la campaña ${esc(p.name)} (${pluralize(customers, 'cliente', 'clientes')})</span>
    </a>`;
}
