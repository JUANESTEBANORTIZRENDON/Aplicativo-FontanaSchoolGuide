// Ayuda: recorrido del flujo, credenciales y restablecer práctica.

import { mountAppShell } from '../components/AppShell';
import { breadcrumbTemplate } from '../components/Breadcrumb';
import { hydrateIcons, icon } from '../components/icons';
import { STATUS_META } from '../domain/management-status';
import type { SimContext } from '../context';
import { DEMO_CREDENTIALS, RESULTS } from '../data/catalogs';
import type { Portfolio } from '../types/simulator';
import { combine, on, qs, type Cleanup } from '../utils/dom';
import { esc } from '../utils/format';

export function renderHelpPage(ctx: SimContext, container: HTMLElement, portfolio: Portfolio): Cleanup {
  ctx.setTitle('Ayuda', portfolio);
  const shell = mountAppShell(ctx, container, { portfolio, active: 'ayuda', topbar: 'cartera', rail: true });
  const base = `/cartera/${portfolio.id}`;

  shell.main.innerHTML = `
    <div class="sim-page">
      <div class="sim-page-head sim-page-head--end">
        ${breadcrumbTemplate([{ label: 'Panel', href: ctx.href(`${base}/panel`) }, { label: 'Ayuda' }])}
      </div>
      <section class="sim-card sim-help-page">
        <h1 class="sim-card__title sim-card__title--xl">${icon('CircleQuestionMark')} Cómo practicar</h1>
        <ol class="sim-steps">
          <li><strong>Ingresa</strong> con las credenciales de práctica y elige una cartera.</li>
          <li>Revisa el <a href="${esc(ctx.href(`${base}/panel`))}">panel</a>: cambia el rango de fecha y observa cómo cambian las cifras.</li>
          <li>Abre <a href="${esc(ctx.href(`${base}/clientes`))}">Clientes</a>, filtra con el semáforo y prioriza a quien lleva más días sin gestión.</li>
          <li>Pulsa <strong>Gestionar</strong>, haz una llamada simulada y registra el resultado con una observación clara.</li>
          <li>Si el cliente se compromete, registra la <strong>promesa de pago</strong> con fecha (máximo 30 días) y valor.</li>
          <li>Vuelve al panel y verifica que las métricas reflejan tu gestión.</li>
        </ol>

        <h2 class="sim-card__subtitle">Semáforo de gestión</h2>
        <ul class="sim-help-list">
          ${STATUS_META.map((s) => `<li><span class="sim-status sim-status--${s.code}"><span class="sim-status__dot" aria-hidden="true"></span>${esc(s.label)}</span></li>`).join('')}
        </ul>

        <h2 class="sim-card__subtitle">Tipificaciones (de mejor a peor)</h2>
        <p class="sim-help">El <strong>mejor perfil</strong> es la tipificación de mayor jerarquía del historial; el <strong>último perfil</strong> es la más reciente.</p>
        <ol class="sim-help-list">${RESULTS.map((r) => `<li>${esc(r.label)}</li>`).join('')}<li>Sin gestión</li></ol>

        <h2 class="sim-card__subtitle">Credenciales de práctica</h2>
        <dl class="sim-demo__list">
          <div><dt>Documento</dt><dd><code>${esc(DEMO_CREDENTIALS.document)}</code></dd></div>
          <div><dt>Contraseña</dt><dd><code>${esc(DEMO_CREDENTIALS.password)}</code></dd></div>
        </dl>

        <h2 class="sim-card__subtitle">Restablecer práctica</h2>
        <p>Borra tus gestiones, llamadas y pausas de práctica y vuelve a los datos iniciales. Tu sesión se mantiene.</p>
        <button type="button" class="sim-btn sim-btn--danger" data-action="reset-practice">${icon('RotateCcw')} Restablecer práctica</button>
      </section>
    </div>`;
  hydrateIcons(shell.main);

  return combine([
    shell.cleanup,
    on(qs(shell.main, '[data-action="reset-practice"]'), 'click', () => void ctx.requestReset()),
  ]);
}
