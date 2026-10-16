// Panel de la cartera: cuadrícula 2×2 de tarjetas pequeñas, "Productividad" ancha y, debajo,
// "Registro de llamadas" y "Detalle de gestiones". Todas las cifras se calculan con domain/metrics.

import { mountAppShell } from '../components/AppShell';
import { hydrateIcons, icon } from '../components/icons';
import { metricCardTemplate } from '../components/MetricCard';
import { miniBarChartTemplate } from '../components/MiniBarChart';
import { profileChip } from '../components/StatusBadge';
import type { SimContext } from '../context';
import { ADVISORS, PRACTICE_ADVISOR } from '../data/catalogs';
import { computeDashboardMetrics, RANGE_OPTIONS, type DashboardMetrics } from '../domain/metrics';
import type { Portfolio, RangeKey } from '../types/simulator';
import { combine, on, qs, type Cleanup } from '../utils/dom';
import { esc, formatCOP, formatDate, formatDateTime, formatDuration } from '../utils/format';

export function dashboardMetrics(ctx: SimContext, portfolio: Portfolio, range: RangeKey): DashboardMetrics {
  const state = ctx.store.get();
  return computeDashboardMetrics({
    views: ctx.getViews(portfolio.id),
    payments: ctx.dataset.payments,
    calls: ctx.allCalls(),
    advisors: ADVISORS.map((a) => a.username),
    currentAdvisor: PRACTICE_ADVISOR.username,
    connected: state.connection === 'conectado',
    range,
    now: new Date(),
  });
}

export function callListTemplate(ctx: SimContext, m: DashboardMetrics): string {
  if (!m.recentCalls.length) return '<p class="sim-help">Aún no hay llamadas registradas en esta cartera.</p>';
  return `
    <ul class="sim-call-list">
      ${m.recentCalls
        .map((c) => {
          const customer = ctx.findView(c.customerId);
          return `
          <li>
            <span class="sim-call-list__icon">${icon(c.simulatedByUser ? 'PhoneCall' : 'Phone')}</span>
            <span class="sim-call-list__main">
              <strong>${esc(customer?.name ?? c.customerId)}</strong>
              <span class="sim-table__sub">${esc(formatDateTime(c.startedAt))}${c.simulatedByUser ? ' · tu práctica' : ''}</span>
            </span>
            <span class="sim-call-list__dur">${esc(formatDuration(c.durationSec))}</span>
          </li>`;
        })
        .join('')}
    </ul>`;
}

function template(ctx: SimContext, portfolio: Portfolio, range: RangeKey): string {
  const m = dashboardMetrics(ctx, portfolio, range);
  const rangeLabel = RANGE_OPTIONS.find((r) => r.code === range)?.label.toLowerCase() ?? '';
  const base = `/cartera/${portfolio.id}`;
  return `
    <div class="sim-summary" data-sim-guide="panel.resumen">
      <div class="sim-summary__item">${icon('Users')}<span><strong>${m.connectedAdvisors} de ${m.totalAdvisors}</strong> asesores conectados hoy</span></div>
      <div class="sim-summary__item">${icon('Handshake')}<span><strong>${m.commitments}</strong> compromisos registrados</span></div>
      <div class="sim-summary__item">${icon('Banknote')}<span><strong>${esc(formatCOP(m.payments))}</strong> recaudo simulado</span></div>
      <nav class="sim-summary__links" aria-label="Accesos rápidos">
        <a class="sim-btn sim-btn--secondary sim-btn--sm" href="${esc(ctx.href(`${base}/clientes`))}">${icon('Users')} Clientes</a>
        <a class="sim-btn sim-btn--secondary sim-btn--sm" href="${esc(ctx.href(`${base}/llamadas`))}">${icon('PhoneCall')} Llamadas</a>
        <a class="sim-btn sim-btn--secondary sim-btn--sm" href="${esc(ctx.href(`${base}/compromisos`))}">${icon('Handshake')} Compromisos</a>
      </nav>
    </div>

    <div class="sim-dashboard">
      ${metricCardTemplate({
        title: 'N° Clientes',
        value: String(m.customers),
        icon: 'Users',
        tone: 'blue',
        percent: m.managedPercent,
        percentLabel: 'Clientes gestionados en el rango',
        caption: `Gestionados: <strong>${m.managedCustomers}</strong>`,
        guide: 'panel.clientes',
      })}
      ${metricCardTemplate({
        title: 'N° Obligaciones',
        value: String(m.obligations),
        icon: 'FileText',
        tone: 'violet',
        percent: m.agreementPercent,
        percentLabel: 'Obligaciones en acuerdo o pagadas',
        caption: `Capital: <strong>${esc(formatCOP(m.capital))}</strong>`,
        guide: 'panel.obligaciones',
      })}
      <article class="sim-panel-card sim-dashboard__wide sim-dashboard__prod" data-sim-guide="panel.productividad">
        <h2 class="sim-panel-card__head">Productividad <span class="sim-panel-card__hint">${m.managementsInRange} gestiones · ${esc(rangeLabel)}</span></h2>
        <div class="sim-panel-card__body">${miniBarChartTemplate(m.productivity)}</div>
      </article>
      ${metricCardTemplate({
        title: 'Proyección',
        value: formatCOP(m.projection),
        icon: 'TrendingUp',
        tone: 'amber',
        percent: m.projectionPercent,
        percentLabel: 'Proyección frente al capital',
        caption: `Total: <strong>${esc(formatCOP(m.projection))}</strong>`,
        guide: 'panel.proyeccion',
      })}
      ${metricCardTemplate({
        title: 'Pagos',
        value: formatCOP(m.payments),
        icon: 'Banknote',
        tone: 'green',
        percent: m.paymentsPercent,
        percentLabel: 'Pagos frente a la proyección',
        caption: `Total: <strong>${esc(formatCOP(m.payments))}</strong>`,
        guide: 'panel.pagos',
      })}
      <article class="sim-panel-card sim-dashboard__calls" data-sim-guide="panel.llamadas">
        <h2 class="sim-panel-card__head">Registro de llamadas</h2>
        <div class="sim-panel-card__body">${callListTemplate(ctx, m)}</div>
      </article>
      <article class="sim-panel-card sim-dashboard__wide sim-dashboard__detail" data-sim-guide="panel.detalle">
        <h2 class="sim-panel-card__head">Detalle de gestiones</h2>
        <div class="sim-panel-card__body">
          <div class="sim-table-wrap">
            <table class="sim-table sim-table--compact">
              <caption class="sim-visually-hidden">Gestiones por tipificación en el rango seleccionado</caption>
              <thead><tr><th scope="col">Tipificación</th><th scope="col">Gestiones</th><th scope="col">Participación</th><th scope="col">Última</th></tr></thead>
              <tbody>
                ${m.results
                  .map(
                    (r) => `
                  <tr>
                    <td>${profileChip(r.code)}</td>
                    <td class="sim-num">${r.count}</td>
                    <td><span class="sim-bar" style="--sim-bar-value:${r.percent}%" aria-hidden="true"></span> ${r.percent}%</td>
                    <td>${esc(formatDate(r.lastDate))}</td>
                  </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      </article>
    </div>`;
}

export function renderPortfolioDashboardPage(ctx: SimContext, container: HTMLElement, portfolio: Portfolio): Cleanup {
  ctx.setTitle('Panel', portfolio);
  const shell = mountAppShell(ctx, container, { portfolio, active: 'inicio', topbar: 'cartera', rail: true });
  shell.main.innerHTML = `
    <div class="sim-page">
      <h1 class="sim-visually-hidden">Panel de ${esc(portfolio.name)}</h1>
      <div class="sim-range" data-sim-guide="panel.rango">
        <label class="sim-label" for="sim-range">Rango de fecha:</label>
        <select class="sim-input" id="sim-range">
          ${RANGE_OPTIONS.map((r) => `<option value="${r.code}" ${r.code === ctx.store.get().prefs.dashboardRange ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}
        </select>
      </div>
      <div data-dashboard></div>
    </div>`;

  const target = qs(shell.main, '[data-dashboard]');
  const render = (): void => {
    target.innerHTML = template(ctx, portfolio, ctx.store.get().prefs.dashboardRange);
    hydrateIcons(target);
  };
  render();
  hydrateIcons(shell.main);

  return combine([
    shell.cleanup,
    on(qs<HTMLSelectElement>(shell.main, '#sim-range'), 'change', (event) => {
      ctx.store.setRange((event.target as HTMLSelectElement).value as RangeKey);
    }),
    ctx.store.subscribe((s, prev) => {
      if (s.prefs !== prev.prefs || s.managements !== prev.managements || s.calls !== prev.calls || s.connection !== prev.connection) {
        render();
      }
    }),
  ]);
}
