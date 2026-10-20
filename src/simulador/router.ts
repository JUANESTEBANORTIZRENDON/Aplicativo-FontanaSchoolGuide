// Router por hash con guardas de sesión y de cartera.

import type { SimContext } from './context';
import { findPortfolio } from './data/mock-portfolios';
import { renderComingSoonPage, type ModuleKey } from './pages/ComingSoonPage';
import { renderCustomerFilePage } from './pages/CustomerFilePage';
import { renderCustomerManagementPage } from './pages/CustomerManagementPage';
import { renderHelpPage } from './pages/HelpPage';
import { renderLoginPage } from './pages/LoginPage';
import { renderPortfolioDashboardPage } from './pages/PortfolioDashboardPage';
import { renderPortfolioSelectionPage } from './pages/PortfolioSelectionPage';
import { on, type Cleanup } from './utils/dom';

const MODULES: ModuleKey[] = ['llamadas', 'compromisos', 'productividad', 'pausas', 'reportes'];

export type Route =
  | { name: 'login' }
  | { name: 'carteras' }
  | { name: 'panel'; id: string }
  | { name: 'clientes'; id: string; tab: 'clientes' | 'archivos' }
  | { name: 'cliente'; id: string; customerId: string }
  | { name: 'modulo'; id: string; module: ModuleKey }
  | { name: 'ayuda'; id: string }
  | { name: 'desconocida' };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/\/+$/, '') || '/';
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  if (parts.length === 1 && parts[0] === 'login') return { name: 'login' };
  if (parts.length === 1 && parts[0] === 'carteras') return { name: 'carteras' };
  if (parts[0] === 'cartera' && parts[1]) {
    const id = parts[1];
    const [section, sub] = [parts[2], parts[3]];
    if (section === 'panel' && parts.length === 3) return { name: 'panel', id };
    if (section === 'clientes' && parts.length === 3) return { name: 'clientes', id, tab: 'clientes' };
    if (section === 'clientes' && sub === 'archivos' && parts.length === 4) return { name: 'clientes', id, tab: 'archivos' };
    if (section === 'cliente' && sub && parts.length === 4) return { name: 'cliente', id, customerId: sub };
    if (section === 'ayuda' && parts.length === 3) return { name: 'ayuda', id };
    if (section && MODULES.includes(section as ModuleKey) && parts.length === 3)
      return { name: 'modulo', id, module: section as ModuleKey };
  }
  return { name: 'desconocida' };
}

export function createRouter(ctx: SimContext, container: HTMLElement) {
  let cleanup: Cleanup | null = null;
  let first = true;

  const render = (): void => {
    const route = parseHash(location.hash);
    const hasSession = ctx.store.hasValidSession();

    if (route.name === 'login') {
      if (hasSession) return ctx.navigate('/carteras');
    } else if (!hasSession) {
      return ctx.navigate('/login');
    }
    if (route.name === 'desconocida') return ctx.navigate(hasSession ? '/carteras' : '/login');

    const portfolio = 'id' in route ? findPortfolio(route.id) : undefined;
    if ('id' in route && !portfolio) {
      ctx.toast('La cartera solicitada no existe. Elige una de la lista.', 'warning');
      return ctx.navigate('/carteras');
    }

    cleanup?.();
    cleanup = null;
    container.innerHTML = '';
    if (portfolio) ctx.store.setActivePortfolio(portfolio.id);

    switch (route.name) {
      case 'login':
        cleanup = renderLoginPage(ctx, container);
        break;
      case 'carteras':
        cleanup = renderPortfolioSelectionPage(ctx, container);
        break;
      case 'panel':
        cleanup = renderPortfolioDashboardPage(ctx, container, portfolio!);
        break;
      case 'clientes':
        cleanup = renderCustomerManagementPage(ctx, container, portfolio!, route.tab);
        break;
      case 'cliente':
        cleanup = renderCustomerFilePage(ctx, container, portfolio!, route.customerId);
        break;
      case 'modulo':
        cleanup = renderComingSoonPage(ctx, container, portfolio!, route.module);
        break;
      case 'ayuda':
        cleanup = renderHelpPage(ctx, container, portfolio!);
        break;
    }

    // Tras navegar, el foco va al contenido para que el lector de pantalla anuncie la vista nueva.
    if (!first) {
      window.scrollTo({ top: 0 });
      container.querySelector<HTMLElement>('#sim-main')?.focus({ preventScroll: true });
    }
    first = false;
  };

  return {
    start(): Cleanup {
      const stop = on(window, 'hashchange', render);
      render();
      return () => {
        stop();
        cleanup?.();
        cleanup = null;
      };
    },
    render,
  };
}
