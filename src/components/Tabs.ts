import { esc } from '../utils/format';

export interface TabLink {
  label: string;
  href: string;
  active: boolean;
}

/** Pestañas de navegación entre subvistas (son enlaces, no paneles). */
export function tabsTemplate(tabs: TabLink[], label: string): string {
  return `
    <nav class="sim-tabs" aria-label="${esc(label)}" data-sim-guide="clientes.pestanas">
      ${tabs
        .map(
          (t) =>
            `<a class="sim-tabs__tab${t.active ? ' is-active' : ''}" href="${esc(t.href)}" ${t.active ? 'aria-current="page"' : ''}>${esc(t.label)}</a>`,
        )
        .join('')}
    </nav>`;
}
