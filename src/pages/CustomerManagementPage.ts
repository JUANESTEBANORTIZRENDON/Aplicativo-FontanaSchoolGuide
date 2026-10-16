// Clientes: pestañas, breadcrumb, panel de filtros con semáforo, totales, tabla y detalle.

import { mountAppShell } from '../components/AppShell';
import { breadcrumbTemplate } from '../components/Breadcrumb';
import { openCustomerDetail } from '../components/CustomerDetailPanel';
import { customerTableTemplate } from '../components/CustomerTable';
import { filterPanelTemplate, readFilterForm } from '../components/FilterPanel';
import { hydrateIcons, icon } from '../components/icons';
import { mountMultiSelects } from '../components/MultiSelect';
import { tabsTemplate } from '../components/Tabs';
import type { SimContext } from '../context';
import { PRACTICE_ADVISOR } from '../data/catalogs';
import { applyCustomerFilters, createDefaultFilters, paginate } from '../domain/customer-filters';
import type { CustomerFilters, ManagementStatus, Portfolio } from '../types/simulator';
import { combine, debounce, on, qs, qsa, type Cleanup } from '../utils/dom';
import { esc } from '../utils/format';

export type ClientesTab = 'clientes' | 'archivos';

function statusCounts(ctx: SimContext, portfolioId: string, f: CustomerFilters): Partial<Record<ManagementStatus, number>> {
  // Conteos con todos los filtros aplicados excepto el propio semáforo.
  const list = applyCustomerFilters(ctx.getViews(portfolioId), { ...f, statuses: [] });
  const counts: Partial<Record<ManagementStatus, number>> = {};
  for (const v of list) counts[v.status] = (counts[v.status] ?? 0) + 1;
  return counts;
}

function headerTemplate(ctx: SimContext, portfolio: Portfolio, tab: ClientesTab): string {
  const base = `/cartera/${portfolio.id}`;
  return `
    <div class="sim-page-head">
      ${tabsTemplate(
        [
          { label: 'Archivos', href: ctx.href(`${base}/clientes/archivos`), active: tab === 'archivos' },
          { label: 'Clientes', href: ctx.href(`${base}/clientes`), active: tab === 'clientes' },
        ],
        'Secciones de clientes',
      )}
      ${breadcrumbTemplate([
        { label: 'Panel', href: ctx.href(`${base}/panel`) },
        { label: tab === 'clientes' ? 'Clientes' : 'Archivos' },
      ])}
    </div>`;
}

export function renderCustomerManagementPage(
  ctx: SimContext,
  container: HTMLElement,
  portfolio: Portfolio,
  tab: ClientesTab,
): Cleanup {
  ctx.setTitle(tab === 'clientes' ? 'Clientes' : 'Archivos', portfolio);
  const shell = mountAppShell(ctx, container, {
    portfolio,
    active: 'clientes',
    topbar: 'clientes',
    rail: true,
    onSearch: () => {
      if (tab === 'archivos') {
        ctx.navigate(`/cartera/${portfolio.id}/clientes`);
        return;
      }
      container.querySelector<HTMLInputElement>('#sim-filter-text')?.focus();
    },
  });

  if (tab === 'archivos') {
    shell.main.innerHTML = `
      <div class="sim-page">
        ${headerTemplate(ctx, portfolio, tab)}
        <section class="sim-card sim-coming-soon">
          ${icon('Folder', 'sim-coming-soon__icon')}
          <h1 class="sim-card__title">Módulo en preparación</h1>
          <p>Aquí se cargarán los archivos de asignación de la cartera. En esta fase el simulador trabaja con datos ficticios ya cargados.</p>
          <a class="sim-btn sim-btn--primary" href="${esc(ctx.href(`/cartera/${portfolio.id}/clientes`))}">${icon('Users')} Ir a Clientes</a>
        </section>
      </div>`;
    hydrateIcons(shell.main);
    return shell.cleanup;
  }

  const pid = portfolio.id;
  shell.main.innerHTML = `
    <div class="sim-page">
      ${headerTemplate(ctx, portfolio, tab)}
      <section class="sim-card sim-card--filters" data-sim-guide="clientes.filtros" aria-labelledby="sim-clientes-title">
        <h1 id="sim-clientes-title" class="sim-card__title sim-card__title--xl">${esc(portfolio.name)}</h1>
        <div data-filters></div>
      </section>
      <section class="sim-card sim-card--results" aria-label="Resultados">
        <div data-results></div>
      </section>
    </div>`;
  hydrateIcons(shell.main);

  const filtersSlot = qs(shell.main, '[data-filters]');
  const resultsSlot = qs(shell.main, '[data-results]');
  let msCleanup: Cleanup = () => undefined;
  let detailCleanup: Cleanup | null = null;

  const renderFilters = (): void => {
    msCleanup();
    const f = ctx.store.getFilters(pid);
    filtersSlot.innerHTML = filterPanelTemplate(f, statusCounts(ctx, pid, f));
    hydrateIcons(filtersSlot);
    msCleanup = mountMultiSelects(filtersSlot);
  };

  const updateLegend = (): void => {
    const f = ctx.store.getFilters(pid);
    const counts = statusCounts(ctx, pid, f);
    for (const btn of qsa(filtersSlot, '[data-status]')) {
      const code = btn.dataset.status as ManagementStatus;
      btn.setAttribute('aria-pressed', String(f.statuses.includes(code)));
      const count = btn.querySelector('.sim-legend__count');
      if (count) count.textContent = String(counts[code] ?? 0);
    }
  };

  const renderResults = (): void => {
    const focusedAction = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-results] [data-action]');
    const restore = focusedAction ? `[data-action="${focusedAction.dataset.action}"]${focusedAction.dataset.customer ? `[data-customer="${focusedAction.dataset.customer}"]` : ''}` : null;

    const f = ctx.store.getFilters(pid);
    const list = applyCustomerFilters(ctx.getViews(pid), f);
    const page = paginate(list, ctx.store.get().tablePage[pid] ?? 1);
    const obligations = list.reduce((sum, v) => sum + v.obligations.length, 0);
    resultsSlot.innerHTML = customerTableTemplate(page, obligations);
    hydrateIcons(resultsSlot);

    if (restore) {
      const target = resultsSlot.querySelector<HTMLButtonElement>(restore);
      if (target && !target.disabled) target.focus();
      else resultsSlot.querySelector<HTMLElement>('.sim-table-wrap')?.focus();
    }
  };

  const apply = (patch: Partial<CustomerFilters>): void => {
    ctx.store.setFilters(pid, { ...ctx.store.getFilters(pid), ...patch });
  };

  const resetFilters = (): void => {
    ctx.store.setFilters(pid, createDefaultFilters(PRACTICE_ADVISOR.username));
    renderFilters();
    ctx.toast('Filtros restablecidos.', 'info');
  };

  const liveSearch = debounce((text: string) => apply({ text }), 250);

  renderFilters();
  renderResults();

  return combine([
    shell.cleanup,
    () => msCleanup(),
    () => detailCleanup?.(),
    liveSearch.cancel,
    on(filtersSlot, 'submit', (event) => {
      event.preventDefault();
      const form = event.target as HTMLFormElement;
      liveSearch.cancel();
      ctx.store.setFilters(pid, readFilterForm(form, ctx.store.getFilters(pid).statuses));
      ctx.toast('Filtros aplicados.', 'info');
    }),
    on(filtersSlot, 'input', (event) => {
      const target = event.target as HTMLInputElement;
      if (target.id === 'sim-filter-text') liveSearch(target.value);
    }),
    on(filtersSlot, 'click', (event) => {
      const target = event.target as HTMLElement;
      const statusBtn = target.closest<HTMLElement>('[data-status]');
      if (statusBtn) {
        const code = statusBtn.dataset.status as ManagementStatus;
        const current = ctx.store.getFilters(pid).statuses;
        apply({ statuses: current.includes(code) ? current.filter((s) => s !== code) : [...current, code] });
        return;
      }
      if (target.closest('[data-action="reset-filters"]')) resetFilters();
    }),
    on(resultsSlot, 'click', (event) => {
      const btn = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!btn) return;
      const page = ctx.store.get().tablePage[pid] ?? 1;
      switch (btn.dataset.action) {
        case 'prev-page':
          ctx.store.setPage(pid, page - 1);
          break;
        case 'next-page':
          ctx.store.setPage(pid, page + 1);
          break;
        case 'reset-filters':
          resetFilters();
          break;
        case 'manage':
          detailCleanup?.();
          detailCleanup = openCustomerDetail(ctx, btn.dataset.customer ?? '', btn);
          break;
      }
    }),
    ctx.store.subscribe((s, prev) => {
      if (s.managements !== prev.managements || s.filters !== prev.filters || s.tablePage !== prev.tablePage) {
        renderResults();
        updateLegend();
      }
    }),
  ]);
}
