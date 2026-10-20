import { esc } from '../utils/format';
import { icon } from './icons';

export interface Crumb {
  label: string;
  href?: string;
}

export function breadcrumbTemplate(crumbs: Crumb[]): string {
  return `
    <nav class="sim-breadcrumb" aria-label="Ruta de navegación">
      <ol>
        ${crumbs
          .map((c, i) => {
            const isLast = i === crumbs.length - 1;
            const content = `${i === 0 ? icon('House') : ''}${esc(c.label)}`;
            return `<li>${c.href && !isLast ? `<a href="${esc(c.href)}">${content}</a>` : `<span ${isLast ? 'aria-current="page"' : ''}>${content}</span>`}</li>`;
          })
          .join('')}
      </ol>
    </nav>`;
}
