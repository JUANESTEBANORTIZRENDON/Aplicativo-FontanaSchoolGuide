// Encabezado superior: reloj, estado de conexión, herramientas (en Clientes) y menú del avatar.

import type { SimContext } from '../context';
import { PRACTICE_ADVISOR } from '../data/catalogs';
import type { Portfolio } from '../types/simulator';
import { toDateKey } from '../utils/dates';
import { combine, on, qs, qsa, type Cleanup } from '../utils/dom';
import { esc } from '../utils/format';
import { connectionBadgeTemplate, mountConnectionBadge } from './ConnectionBadge';
import { hydrateIcons, icon } from './icons';
import { liveClockTemplate, mountLiveClock } from './LiveClock';
import { schoolLogo } from './Logo';

export type TopbarVariant = 'perfil' | 'cartera' | 'clientes';

function avatarMenuTemplate(portfolio: Portfolio | null, ctx: SimContext): string {
  return `
    <div class="sim-dropdown">
      <button type="button" class="sim-avatar sim-avatar--sm sim-avatar--button" data-popover-toggle="sim-avatar-menu"
        aria-expanded="false" aria-controls="sim-avatar-menu" aria-label="Menú del asesor">
        ${icon('UserRound')}
      </button>
      <div class="sim-popover sim-popover--right" id="sim-avatar-menu" hidden>
        <p class="sim-popover__title">${esc(PRACTICE_ADVISOR.firstName)} ${esc(PRACTICE_ADVISOR.lastNames)}</p>
        <p class="sim-popover__subtitle">${esc(PRACTICE_ADVISOR.username)}</p>
        <ul class="sim-popover__list">
          ${portfolio ? `<li><a href="${esc(ctx.href(`/cartera/${portfolio.id}/ayuda`))}">${icon('CircleQuestionMark')} Ir a Ayuda</a></li>` : ''}
          <li><button type="button" data-action="reset">${icon('RotateCcw')} Restablecer práctica</button></li>
          <li><button type="button" data-action="logout">${icon('LogOut')} Salir del simulador</button></li>
        </ul>
      </div>
    </div>`;
}

function notificationsTemplate(ctx: SimContext, portfolio: Portfolio): string {
  const views = ctx.getViews(portfolio.id);
  const today = toDateKey(new Date());
  const dueToday = views.filter((v) => v.promiseDates.includes(today)).length;
  const unmanaged = views.filter((v) => v.status === 'sin-gestion').length;
  const late = views.filter((v) => v.status === 'mas-5-dias').length;
  return `
    <ul class="sim-popover__list sim-popover__list--plain">
      <li>${icon('CalendarCheck')} Tienes ${dueToday} ${dueToday === 1 ? 'promesa que vence' : 'promesas que vencen'} hoy.</li>
      <li>${icon('Circle')} ${unmanaged} ${unmanaged === 1 ? 'cliente sigue' : 'clientes siguen'} sin gestión.</li>
      <li>${icon('TriangleAlert')} ${late} ${late === 1 ? 'cliente lleva' : 'clientes llevan'} más de 5 días sin gestión.</li>
    </ul>`;
}

export function topNavbarTemplate(ctx: SimContext, variant: TopbarVariant, portfolio: Portfolio | null): string {
  if (variant === 'perfil') {
    return `
      <header class="sim-topbar sim-topbar--perfil" data-sim-guide="carteras.encabezado">
        <div class="sim-topbar__brand">${schoolLogo()}</div>
        <button type="button" class="sim-icon-btn sim-topbar__hamburger" data-sidebar-toggle aria-expanded="false" aria-controls="sim-sidebar-panel" aria-label="Abrir menú">
          ${icon('Menu')}
        </button>
        ${liveClockTemplate('plain')}
        <div class="sim-topbar__tools">${avatarMenuTemplate(null, ctx)}</div>
      </header>`;
  }

  const tools =
    variant === 'clientes' && portfolio
      ? `
        <div class="sim-topbar__icons" data-sim-guide="clientes.herramientas">
          <button type="button" class="sim-icon-btn" data-action="soon" aria-label="Lista de tareas">${icon('ListTodo')}</button>
          <div class="sim-dropdown">
            <button type="button" class="sim-icon-btn" data-popover-toggle="sim-notifications" aria-expanded="false" aria-controls="sim-notifications" aria-label="Avisos de práctica">
              ${icon('Bell')}<span class="sim-icon-btn__dot" aria-hidden="true"></span>
            </button>
            <div class="sim-popover sim-popover--right" id="sim-notifications" hidden>
              <p class="sim-popover__title">Avisos de práctica</p>
              <div data-notifications>${notificationsTemplate(ctx, portfolio)}</div>
            </div>
          </div>
          <button type="button" class="sim-icon-btn" data-action="soon" aria-label="Pagos">${icon('DollarSign')}</button>
          <button type="button" class="sim-icon-btn" data-action="focus-search" aria-label="Buscar cliente">${icon('Search')}</button>
        </div>`
      : '';

  return `
    <header class="sim-topbar">
      <button type="button" class="sim-icon-btn sim-topbar__mobile-menu" data-sidebar-toggle aria-expanded="false" aria-controls="sim-sidebar-panel" aria-label="Abrir menú">
        ${icon('Menu')}
      </button>
      ${liveClockTemplate('pill')}
      ${connectionBadgeTemplate()}
      <div class="sim-topbar__tools">
        ${tools}
        ${avatarMenuTemplate(portfolio, ctx)}
      </div>
    </header>`;
}

/** Menús desplegables simples (patrón de divulgación): un botón abre su panel; Esc o clic fuera lo cierra. */
function mountPopovers(scope: HTMLElement, onOpen?: (id: string) => void): Cleanup {
  const closeAll = (except?: string): void => {
    for (const btn of qsa(scope, '[data-popover-toggle]')) {
      const id = btn.dataset.popoverToggle ?? '';
      if (id === except) continue;
      btn.setAttribute('aria-expanded', 'false');
      const panel = scope.querySelector<HTMLElement>(`#${id}`);
      if (panel) panel.hidden = true;
    }
  };
  return combine([
    on(scope, 'click', (event) => {
      const btn = (event.target as HTMLElement).closest<HTMLElement>('[data-popover-toggle]');
      if (!btn) return;
      const id = btn.dataset.popoverToggle ?? '';
      const panel = scope.querySelector<HTMLElement>(`#${id}`);
      if (!panel) return;
      const open = !!panel.hidden;
      closeAll(id);
      panel.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      if (open) onOpen?.(id);
    }),
    on(document, 'click', (event) => {
      if (!(event.target as HTMLElement).closest('.sim-dropdown')) closeAll();
    }),
    on(document, 'keydown', (event) => {
      if (event.key !== 'Escape') return;
      const openBtn = qsa(scope, '[data-popover-toggle][aria-expanded="true"]')[0];
      if (openBtn) {
        closeAll();
        openBtn.focus();
      }
    }),
  ]);
}

export function mountTopNavbar(
  ctx: SimContext,
  scope: HTMLElement,
  portfolio: Portfolio | null,
  handlers: { onSearch?: () => void } = {},
): Cleanup {
  const header = qs(scope, '.sim-topbar');
  const cleanups: Cleanup[] = [
    mountLiveClock(header),
    mountPopovers(header, (id) => {
      if (id === 'sim-notifications' && portfolio) {
        const list = header.querySelector<HTMLElement>('[data-notifications]');
        if (list) {
          list.innerHTML = notificationsTemplate(ctx, portfolio);
          hydrateIcons(list);
        }
      }
    }),
    on(header, 'click', (event) => {
      const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
      if (action === 'soon') ctx.toast('Función en preparación.', 'info');
      else if (action === 'focus-search') handlers.onSearch?.();
      else if (action === 'reset') void ctx.requestReset();
      else if (action === 'logout') ctx.logout();
    }),
  ];
  if (header.querySelector('[data-connection-slot]')) cleanups.push(mountConnectionBadge(ctx, header));
  return combine(cleanups);
}
