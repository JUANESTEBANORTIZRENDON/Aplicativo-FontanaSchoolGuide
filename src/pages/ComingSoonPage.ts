// Módulos en preparación. Si ya hay datos, muestran un listado simple de solo lectura.

import { mountAppShell } from '../components/AppShell';
import type { NavKey } from '../components/AppSidebar';
import { breadcrumbTemplate } from '../components/Breadcrumb';
import { hydrateIcons, icon } from '../components/icons';
import { miniBarChartTemplate } from '../components/MiniBarChart';
import type { SimContext } from '../context';
import type { Portfolio } from '../types/simulator';
import { toDateKey } from '../utils/dates';
import { combine, type Cleanup } from '../utils/dom';
import { esc, formatCOP, formatDate, formatDateTime, formatDuration } from '../utils/format';
import { dashboardMetrics } from './PortfolioDashboardPage';

export type ModuleKey = 'llamadas' | 'compromisos' | 'productividad' | 'pausas' | 'reportes';

const MODULES: Record<ModuleKey, { title: string; icon: string; text: string }> = {
  llamadas: {
    title: 'Llamadas',
    icon: 'PhoneCall',
    text: 'El marcador y la grabación de llamadas llegarán en una fase posterior. Por ahora ves el registro de llamadas simuladas.',
  },
  compromisos: {
    title: 'Compromisos',
    icon: 'Handshake',
    text: 'El seguimiento de compromisos llegará en una fase posterior. Por ahora ves las promesas de pago registradas.',
  },
  productividad: {
    title: 'Productividad',
    icon: 'ChartColumn',
    text: 'Los informes detallados de productividad llegarán en una fase posterior. Este es el resumen del mes actual.',
  },
  pausas: {
    title: 'Pausas',
    icon: 'CirclePause',
    text: 'La administración de pausas llegará en una fase posterior. Aquí ves las pausas que registraste desde el estado de conexión.',
  },
  reportes: {
    title: 'Reportes',
    icon: 'FileChartColumn',
    text: 'La generación de reportes llegará en una fase posterior.',
  },
};

function table(caption: string, headers: string[], rows: string[][]): string {
  return `
    <div class="sim-table-wrap">
      <table class="sim-table sim-table--compact">
        <caption class="sim-visually-hidden">${esc(caption)}</caption>
        <thead><tr>${headers.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>`;
}

function dataTemplate(ctx: SimContext, portfolio: Portfolio, module: ModuleKey): string {
  const views = ctx.getViews(portfolio.id);
  switch (module) {
    case 'llamadas': {
      const ids = new Set(views.map((v) => v.id));
      const calls = ctx
        .allCalls()
        .filter((c) => ids.has(c.customerId))
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .slice(0, 25);
      if (!calls.length) return '';
      return table(
        'Llamadas registradas',
        ['Cliente', 'Inicio', 'Duración', 'Origen'],
        calls.map((c) => [
          esc(ctx.findView(c.customerId)?.name ?? c.customerId),
          esc(formatDateTime(c.startedAt)),
          esc(formatDuration(c.durationSec)),
          c.simulatedByUser ? 'Tu práctica' : 'Datos de ejemplo',
        ]),
      );
    }
    case 'compromisos': {
      const today = toDateKey(new Date());
      const promises = views
        .flatMap((v) => v.managements.filter((m) => m.result === 'promesa-pago').map((m) => ({ v, m })))
        .sort((a, b) => (b.m.promiseDate ?? '').localeCompare(a.m.promiseDate ?? ''));
      if (!promises.length) return '';
      return table(
        'Promesas de pago registradas',
        ['Cliente', 'Fecha de compromiso', 'Valor', 'Registrada', 'Estado'],
        promises.map(({ v, m }) => [
          esc(v.name),
          esc(formatDate(m.promiseDate)),
          esc(formatCOP(m.promiseAmount ?? 0)),
          esc(formatDate(m.date)),
          (m.promiseDate ?? '') === today ? '<strong>Vence hoy</strong>' : (m.promiseDate ?? '') > today ? 'Vigente' : 'Vencida',
        ]),
      );
    }
    case 'productividad':
      return miniBarChartTemplate(dashboardMetrics(ctx, portfolio, 'mes').productivity);
    case 'pausas': {
      const pauses = [...ctx.store.get().pauses].reverse();
      if (!pauses.length) return '';
      return table(
        'Pausas registradas',
        ['Motivo', 'Inicio', 'Fin', 'Duración'],
        pauses.map((p) => [
          esc(p.reason),
          esc(formatDateTime(p.startedAt)),
          p.endedAt ? esc(formatDateTime(p.endedAt)) : '<strong>En curso</strong>',
          esc(formatDuration(((p.endedAt ? new Date(p.endedAt) : new Date()).getTime() - new Date(p.startedAt).getTime()) / 1000)),
        ]),
      );
    }
    case 'reportes':
      return '';
  }
}

export function renderComingSoonPage(ctx: SimContext, container: HTMLElement, portfolio: Portfolio, module: ModuleKey): Cleanup {
  const meta = MODULES[module];
  ctx.setTitle(meta.title, portfolio);
  const shell = mountAppShell(ctx, container, { portfolio, active: module as NavKey, topbar: 'cartera', rail: true });

  const render = (): void => {
    const data = dataTemplate(ctx, portfolio, module);
    shell.main.innerHTML = `
      <div class="sim-page">
        <div class="sim-page-head sim-page-head--end">
          ${breadcrumbTemplate([{ label: 'Panel', href: ctx.href(`/cartera/${portfolio.id}/panel`) }, { label: meta.title }])}
        </div>
        <section class="sim-card sim-coming-soon">
          ${icon(meta.icon, 'sim-coming-soon__icon')}
          <h1 class="sim-card__title">${esc(meta.title)} · Módulo en preparación</h1>
          <p>${esc(meta.text)}</p>
          <a class="sim-btn sim-btn--primary" href="${esc(ctx.href(`/cartera/${portfolio.id}/panel`))}">${icon('House')} Volver al inicio de la cartera</a>
        </section>
        ${data ? `<section class="sim-card" aria-label="Datos de solo lectura"><h2 class="sim-card__title">Solo lectura</h2>${data}</section>` : ''}
      </div>`;
    hydrateIcons(shell.main);
  };
  render();

  return combine([
    shell.cleanup,
    ctx.store.subscribe((s, prev) => {
      if (s.calls !== prev.calls || s.pauses !== prev.pauses || s.managements !== prev.managements) render();
    }),
  ]);
}
