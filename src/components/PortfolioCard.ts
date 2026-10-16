import type { Portfolio } from '../types/simulator';
import { esc, pluralize } from '../utils/format';
import { icon } from './icons';
import { portfolioLogo } from './Logo';

export function portfolioCardTemplate(p: Portfolio, customers: number, href: string): string {
  return `
    <article class="sim-portfolio-card" style="--sim-accent:${esc(p.accent)}">
      <div class="sim-portfolio-card__logo">${portfolioLogo(p.logo, p.accent, p.name)}</div>
      <h3 class="sim-portfolio-card__name">${esc(p.name)}</h3>
      <p class="sim-portfolio-card__text">${esc(p.description)}</p>
      <p class="sim-portfolio-card__meta">
        <span class="sim-tag">${esc(p.practiceStatus)}</span>
        <span>${icon('Users')} ${pluralize(customers, 'cliente', 'clientes')}</span>
      </p>
      <a class="sim-btn sim-btn--primary sim-portfolio-card__cta" href="${esc(href)}">
        Ingresar <span class="sim-visually-hidden">a ${esc(p.name)}</span>${icon('ChevronRight')}
      </a>
    </article>`;
}
