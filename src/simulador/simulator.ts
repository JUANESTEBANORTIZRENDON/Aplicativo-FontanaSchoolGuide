// Punto de montaje único del clon de Control Next. Fontana School lo muestra en un iframe (/simulador/) dentro
// del módulo Tipifica; la guía y la demostración se pueden abrir desde la página con postMessage.

import './styles/variables.css';
import './styles/global.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/control-next.css';

import { openConfirm } from './components/ConfirmDialog';
import { mountGuide } from './components/GuideTour';
import { createToaster } from './components/Toast';
import type { MountOptions, SimContext } from './context';
import { BRAND_NAME } from './data/catalogs';
import { createDataset } from './data/mock-metrics';
import { buildCustomerViews } from './domain/customer-view';
import { createRouter } from './router';
import { createSimulatorStorage, DEFAULT_STORAGE_PREFIX } from './services/simulator-storage';
import { createSimulatorStore } from './state/store';
import type { CustomerView, Management } from './types/simulator';

export type { MountOptions } from './context';

/** Monta el simulador dentro de `root` y devuelve la función que lo desmonta. */
export function mountSimulator(root: HTMLElement, options: MountOptions = {}): () => void {
  const opts: Required<MountOptions> = {
    basePath: options.basePath ?? '',
    storagePrefix: options.storagePrefix ?? DEFAULT_STORAGE_PREFIX,
  };
  const previousTitle = document.title;

  const simRoot = document.createElement('div');
  simRoot.className = window.parent !== window ? 'sim-root is-embedded' : 'sim-root';
  const view = document.createElement('div');
  view.className = 'sim-view';
  simRoot.append(view);
  root.append(simRoot);

  const storage = createSimulatorStorage(opts.storagePrefix);
  const store = createSimulatorStore(storage);
  const dataset = createDataset(new Date());
  const toaster = createToaster(simRoot);

  // Las vistas de cliente se recalculan cuando cambian las gestiones o pasa un minuto (semáforo).
  let cache: { ref: Management[]; at: number; views: CustomerView[]; byId: Map<string, CustomerView> } | null = null;
  const allViews = (): { views: CustomerView[]; byId: Map<string, CustomerView> } => {
    const ref = store.get().managements;
    if (!cache || cache.ref !== ref || Date.now() - cache.at > 60_000) {
      const views = buildCustomerViews(dataset.customers, [...dataset.managements, ...ref], new Date());
      cache = { ref, at: Date.now(), views, byId: new Map(views.map((v) => [v.id, v])) };
    }
    return cache;
  };

  const ctx: SimContext = {
    root: simRoot,
    store,
    dataset,
    options: opts,
    href: (path) => `#${path}`,
    navigate(path) {
      const target = `#${path}`;
      if (location.hash === target) router.render();
      else location.hash = target;
    },
    toast: (message, kind) => toaster.show(message, kind),
    confirm: (o) => openConfirm(simRoot, o),
    setTitle(viewName, portfolio) {
      document.title = [viewName, portfolio?.name, BRAND_NAME].filter(Boolean).join(' · ');
    },
    allManagements: () => [...dataset.managements, ...store.get().managements],
    allCalls: () => [...dataset.calls, ...store.get().calls],
    getViews: (portfolioId) => allViews().views.filter((v) => v.portfolioId === portfolioId),
    findView: (customerId) => allViews().byId.get(customerId),
    async requestReset() {
      const ok = await ctx.confirm({
        title: '¿Restablecer la práctica?',
        message: 'Se borrarán tus gestiones, llamadas y pausas de práctica y volverás a los datos iniciales. Tu sesión se mantiene.',
        confirmLabel: 'Sí, restablecer',
        danger: true,
      });
      if (!ok) return;
      store.resetPractice();
      ctx.toast('Práctica restablecida. Los datos volvieron a su estado inicial.', 'success');
      ctx.navigate('/carteras');
    },
    logout() {
      store.logout();
      ctx.toast('Saliste del simulador. Tus gestiones quedan guardadas.', 'info');
      ctx.navigate('/login');
    },
  };

  const router = createRouter(ctx, view);
  const stopRouter = router.start();
  const stopGuide = mountGuide(ctx);

  // Avisa a Fontana School (si el simulador está dentro de su iframe) cada vez que se guarda una gestión.
  const stopNotify = store.subscribe((s, prev) => {
    if (s.managements.length > prev.managements.length && window.parent !== window) {
      window.parent.postMessage({ type: 'tipifica:gestion', total: s.managements.length }, location.origin);
    }
  });

  // La sesión ficticia caduca a las 8 horas.
  const sessionTimer = setInterval(() => {
    if (store.get().session && !store.hasValidSession()) {
      ctx.toast('Tu sesión de práctica caducó. Ingresa de nuevo.', 'warning');
      ctx.navigate('/login');
    }
  }, 60_000);

  return () => {
    clearInterval(sessionTimer);
    stopNotify();
    stopGuide();
    stopRouter();
    toaster.destroy();
    simRoot.remove();
    document.title = previousTitle;
  };
}
