// Guía interactiva de Control Next: resalta cada zona con un foco y explica para qué sirve.
// Se abre sola la primera vez que se entra a cada vista, con el botón «Guía» o desde Fontana School
// (postMessage { type: 'tipifica:guia' } o { type: 'tipifica:demo' }).

import type { SimContext } from '../context';
import { GUIDE_STEPS, type GuideStep, type GuideView } from '../data/guide-steps';
import { PORTFOLIOS } from '../data/mock-portfolios';
import { parseHash } from '../router';
import { combine, on, prefersReducedMotion, qs, type Cleanup } from '../utils/dom';
import { esc } from '../utils/format';
import { startPractice } from './customer-file/PracticePanel';
import { hydrateIcons, icon } from './icons';

const SEEN_KEY = 'control-next:guia-vista:';

function currentView(): GuideView | null {
  const route = parseHash(location.hash);
  if (route.name === 'login') return 'login';
  if (route.name === 'carteras') return 'carteras';
  if (route.name === 'clientes' && route.tab === 'clientes') return 'clientes';
  if (route.name === 'cliente') return 'ficha';
  return null;
}

function seen(view: GuideView): boolean {
  try {
    return localStorage.getItem(SEEN_KEY + view) === '1';
  } catch {
    return false;
  }
}

function markSeen(view: GuideView): void {
  try {
    localStorage.setItem(SEEN_KEY + view, '1');
  } catch {
    /* sin almacenamiento: la guía volverá a abrirse sola, no es grave */
  }
}

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, prefersReducedMotion() ? Math.min(ms, 120) : ms));

function visibleTarget(id: string | undefined): HTMLElement | null {
  if (!id) return null;
  const all = [...document.querySelectorAll<HTMLElement>(`[data-sim-guide="${id}"]`)];
  return all.find((el) => el.getClientRects().length > 0) ?? null;
}

export function mountGuide(ctx: SimContext): Cleanup {
  const layer = document.createElement('div');
  layer.className = 'sim-guide';
  layer.innerHTML = `
    <div class="sim-guide__spot" hidden></div>
    <section class="sim-guide__card" role="dialog" aria-modal="false" aria-labelledby="sim-guide-title" hidden>
      <div class="sim-guide__head">
        <span class="sim-guide__badge">${icon('Sparkles')} Guía Control Next</span>
        <button type="button" class="sim-guide__close" data-guide="close" aria-label="Cerrar la guía">${icon('X')}</button>
      </div>
      <h2 id="sim-guide-title" class="sim-guide__title"></h2>
      <p class="sim-guide__text"></p>
      <div class="sim-guide__extra"></div>
      <div class="sim-guide__foot">
        <span class="sim-guide__count"></span>
        <span class="sim-guide__nav">
          <button type="button" class="sim-btn sim-btn--ghost sim-btn--sm" data-guide="prev">Anterior</button>
          <button type="button" class="sim-btn sim-btn--primary sim-btn--sm" data-guide="next">Siguiente</button>
        </span>
      </div>
    </section>
    <button type="button" class="sim-guide__fab" data-guide="open">${icon('CircleQuestionMark')} Guía</button>`;
  hydrateIcons(layer);
  ctx.root.append(layer);

  const spot = qs(layer, '.sim-guide__spot');
  const card = qs(layer, '.sim-guide__card');
  const title = qs(layer, '.sim-guide__title');
  const text = qs(layer, '.sim-guide__text');
  const extra = qs(layer, '.sim-guide__extra');
  const count = qs(layer, '.sim-guide__count');
  const prevBtn = qs<HTMLButtonElement>(layer, '[data-guide="prev"]');
  const nextBtn = qs<HTMLButtonElement>(layer, '[data-guide="next"]');

  let view: GuideView | null = null;
  let steps: GuideStep[] = [];
  let index = -1;
  let target: HTMLElement | null = null;
  let frame = 0;
  let autoTimer: ReturnType<typeof setTimeout> | undefined;
  let demoRunning = false;
  let demoCancelled = false;
  /** Espera dentro de la demostración; si el asesor pulsó «Saltar» la corta. */
  const pause = async (ms: number): Promise<void> => {
    await wait(ms);
    if (demoCancelled) throw new Error('demo-cancelada');
  };

  /** Coloca el foco y la tarjeta junto a `target` (o en el centro). */
  const place = (): void => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const cw = Math.min(380, vw - 24);
      card.style.width = `${cw}px`;
      const ch = card.offsetHeight;
      if (!target || !target.isConnected) {
        spot.hidden = true;
        card.style.left = `${(vw - cw) / 2}px`;
        card.style.top = `${Math.max(12, (vh - ch) / 2)}px`;
        layer.classList.add('is-centered');
        return;
      }
      layer.classList.remove('is-centered');
      const r = target.getBoundingClientRect();
      const pad = 6;
      spot.hidden = false;
      Object.assign(spot.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
      const below = r.bottom + 14;
      const above = r.top - ch - 14;
      const right = r.right + 14;
      let top: number;
      let left: number;
      if (below + ch <= vh) {
        top = below;
        left = r.left;
      } else if (above >= 8) {
        top = above;
        left = r.left;
      } else if (right + cw <= vw) {
        top = Math.min(Math.max(8, r.top), vh - ch - 8);
        left = right;
      } else {
        top = vh - ch - 8;
        left = (vw - cw) / 2;
      }
      card.style.left = `${Math.min(Math.max(8, left), vw - cw - 8)}px`;
      card.style.top = `${Math.max(8, top)}px`;
    });
  };

  const render = (): void => {
    const step = steps[index];
    if (!step) return;
    target = visibleTarget(step.target);
    title.textContent = step.title;
    text.textContent = step.text;
    extra.innerHTML = step.action
      ? `<button type="button" class="sim-btn sim-btn--success sim-guide__action" data-guide="action">${icon(step.action.run === 'demo-pausa' ? 'CirclePause' : step.action.run === 'prueba' ? 'Headphones' : 'Search')} ${esc(step.action.label)}</button>`
      : '';
    hydrateIcons(extra);
    count.textContent = `${index + 1} de ${steps.length}`;
    prevBtn.disabled = index === 0;
    nextBtn.textContent = index === steps.length - 1 ? 'Terminar' : 'Siguiente';
    card.hidden = false;
    layer.classList.add('is-active');
    if (target) target.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    place();
    setTimeout(place, 380);
    nextBtn.focus({ preventScroll: true });
  };

  const stop = (): void => {
    if (view) markSeen(view);
    index = -1;
    steps = [];
    target = null;
    spot.hidden = true;
    card.hidden = true;
    layer.classList.remove('is-active', 'is-centered');
  };

  const start = (force: boolean): void => {
    clearTimeout(autoTimer);
    view = currentView();
    if (!view) {
      if (force) ctx.toast('Entra a una campaña o a la ficha de un cliente para ver la guía de esa pantalla.', 'info');
      return;
    }
    if (!force && seen(view)) return;
    steps = GUIDE_STEPS[view];
    index = 0;
    render();
  };

  const go = (delta: number): void => {
    const next = index + delta;
    if (next < 0) return;
    if (next >= steps.length) return stop();
    index = next;
    render();
  };

  /** Burbuja sin botones para la demostración (señala y explica mientras se escribe la cédula). */
  const bubble = (targetId: string | null, heading: string, message: string): void => {
    view = null;
    steps = [{ title: heading, text: message }];
    index = 0;
    target = targetId ? visibleTarget(targetId) : null;
    title.textContent = heading;
    text.textContent = message;
    extra.innerHTML = '';
    count.textContent = 'Demostración';
    prevBtn.disabled = true;
    nextBtn.textContent = 'Saltar';
    card.hidden = false;
    layer.classList.add('is-active', 'is-demo');
    place();
  };

  /** Demostración: abre «Buscar», escribe una cédula, pulsa Buscar y espera el OK del asesor. */
  const runDemo = async (): Promise<void> => {
    if (demoRunning) return;
    demoRunning = true;
    demoCancelled = false;
    stop();
    try {
      const route = parseHash(location.hash);
      const portfolioId = 'id' in route ? route.id : (PORTFOLIOS[0]?.id ?? '');
      if (!ctx.store.hasValidSession()) {
        ctx.toast('Primero inicia sesión en el simulador.', 'warning');
        return;
      }
      if (route.name !== 'clientes') {
        ctx.navigate(`/cartera/${portfolioId}/clientes`);
        await pause(500);
      }
      const views = ctx.getViews(portfolioId);
      // Un cliente con saldo y con histórico, para que la ficha muestre todo y se pueda negociar.
      const sample = views.find((v) => v.managements.length >= 2 && v.totalBalance > 0) ?? views.find((v) => v.totalBalance > 0) ?? views[0];
      if (!sample) return;
      const lens = document.querySelector<HTMLElement>('[data-action="focus-search"]');
      bubble('comun.buscar', '1. La lupa', 'Pulsa la lupa del encabezado para abrir el panel «Buscar».');
      await pause(1600);
      lens?.click();
      await pause(450);
      const input = document.querySelector<HTMLInputElement>('#sim-search-document');
      if (!input) return;
      bubble('buscar.cedula', '2. Escribe la cédula', 'En el campo «Cédula» escribe el número del titular, solo dígitos, sin puntos ni espacios.');
      await pause(900);
      input.value = '';
      for (const digit of sample.document) {
        input.value += digit;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await pause(140);
      }
      bubble('buscar.boton', '3. Pulsa «Buscar»', 'También puedes buscar por nombre, número de obligación, teléfono, email o por el codeudor.');
      await pause(1700);
      input.form?.requestSubmit();
      await pause(350);
      bubble('buscar.resultado', '4. Confirma el cliente', 'Control Next te dice a qué campaña pertenece, el nombre y la identificación. Si es la persona correcta, pulsa «OK» para abrir su ficha.');
      // Se espera a que el asesor pulse OK (la ventana se cierra) y se abra la ficha.
      const started = Date.now();
      while (Date.now() - started < 120_000) {
        await pause(250);
        if (!document.querySelector('[data-sim-guide="buscar.resultado"]')) break;
        place();
      }
      stop();
      await pause(700);
      if (currentView() === 'ficha') start(true);
    } catch {
      stop();
    } finally {
      layer.classList.remove('is-demo');
      demoRunning = false;
    }
  };

  /** Espera hasta que `done()` sea verdadero (el asesor hace el paso), recolocando la burbuja. */
  const until = async (done: () => boolean, ms = 180_000): Promise<void> => {
    const started = Date.now();
    while (Date.now() - started < ms) {
      await pause(250);
      if (done()) return;
      place();
    }
  };

  /** Demostración de la pausa: avatar → Pausa → tipo de pausa → Enviar → Continuar. */
  const runPauseDemo = async (): Promise<void> => {
    if (demoRunning) return;
    if (!ctx.store.hasValidSession()) {
      ctx.toast('Primero inicia sesión en el simulador.', 'warning');
      return;
    }
    demoRunning = true;
    demoCancelled = false;
    stop();
    try {
      if (ctx.store.get().connection === 'en-pausa') {
        bubble('pausa.continuar', 'Ya estás en pausa', 'Pulsa «Continuar» para volver a quedar CONECTADO y luego repite la demostración.');
        await until(() => ctx.store.get().connection !== 'en-pausa');
        return;
      }
      if (ctx.store.get().activeCall) {
        bubble('comun.estado-conexion', '1. Primero termina la llamada', 'No se puede pausar con una llamada en curso. Pulsa «Colgar», guarda la gestión y después haz la pausa.');
        await until(() => !ctx.store.get().activeCall);
      }
      const menu = (): HTMLElement | null => document.querySelector<HTMLElement>('#sim-avatar-menu');
      bubble('comun.avatar', 'Pulsa tu avatar', 'Arriba a la derecha, en tu foto, está el menú del asesor: Mi Perfil, Pausa y Logout.');
      await pause(1700);
      if (menu()?.hidden) document.querySelector<HTMLElement>('[data-popover-toggle="sim-avatar-menu"]')?.click();
      await pause(500);
      bubble('comun.pausa', 'Pulsa «Pausa»', 'Úsala siempre que te levantes del puesto: almuerzo, break, baño, capacitación o retroalimentación.');
      await pause(1900);
      document.querySelector<HTMLElement>('[data-sim-guide="comun.pausa"]')?.click();
      await pause(500);
      const select = document.querySelector<HTMLSelectElement>('#sim-pause-select');
      if (!select) return;
      bubble('pausa.tipo', 'Elige el tipo de pausa', 'En «Seleccione un pausa» escoge la que corresponde: BREAK AM, ALMUERZO, BREAK PM, BAÑO, CAPACITACIÓN…');
      await pause(1500);
      select.value = 'ALMUERZO';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await pause(1000);
      bubble('pausa.ventana', 'Pulsa «Enviar»', 'Con «Enviar» inicia la pausa y queda registrada con su hora. «Cancelar» cierra la ventana sin pausar. Pulsa «Enviar» para continuar.');
      await until(() => !document.querySelector('[data-sim-guide="pausa.ventana"]'));
      await pause(400);
      if (ctx.store.get().connection !== 'en-pausa') {
        stop();
        ctx.toast('No se inició la pausa. Puedes repetir la demostración cuando quieras.', 'info');
        return;
      }
      bubble('pausa.continuar', 'Al volver, pulsa «Continuar»', 'Mientras estás en pausa no te entran llamadas y el tiempo corre. Cuando regreses a tu puesto pulsa «Continuar» para quedar CONECTADO.');
      await until(() => ctx.store.get().connection !== 'en-pausa');
      stop();
      ctx.toast('¡Bien! Así se hace una pausa: terminar la llamada → avatar → Pausa → tipo → Enviar → Continuar.', 'success');
    } catch {
      stop();
    } finally {
      layer.classList.remove('is-demo');
      demoRunning = false;
    }
  };

  const onRoute = (): void => {
    if (demoRunning) return;
    stop();
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => start(false), 900);
  };

  onRoute();

  return combine([
    () => {
      clearTimeout(autoTimer);
      cancelAnimationFrame(frame);
      layer.remove();
    },
    on(window, 'hashchange', onRoute),
    on(window, 'resize', place),
    on(window, 'scroll', () => {
      if (index >= 0) place();
    }, { passive: true }),
    on(layer, 'click', (event) => {
      const action = (event.target as HTMLElement).closest<HTMLElement>('[data-guide]')?.dataset.guide;
      if (action === 'open') start(true);
      else if (action === 'close') stop();
      else if (action === 'prev') go(-1);
      else if (action === 'next') {
        if (layer.classList.contains('is-demo')) {
          demoCancelled = true;
          stop();
        }
        else go(1);
      } else if (action === 'action') {
        const run = steps[index]?.action?.run;
        if (run === 'demo-pausa') void runPauseDemo();
        else if (run === 'prueba') {
          stop();
          if (ctx.store.hasValidSession()) startPractice(ctx);
          else ctx.toast('Primero inicia sesión en el simulador.', 'warning');
        } else void runDemo();
      }
    }),
    on(document, 'keydown', (event) => {
      if (index < 0) return;
      if (event.key === 'Escape' && !document.querySelector('.sim-modal-overlay')) stop();
      else if (event.key === 'ArrowRight' && !layer.classList.contains('is-demo') && !(event.target as HTMLElement).closest('input, textarea, select')) go(1);
      else if (event.key === 'ArrowLeft' && !layer.classList.contains('is-demo') && !(event.target as HTMLElement).closest('input, textarea, select')) go(-1);
    }),
    on(window, 'message', (event) => {
      if (event.origin !== location.origin) return;
      const type = (event.data as { type?: string } | null)?.type;
      if (type === 'tipifica:guia') start(true);
      else if (type === 'tipifica:demo') void runDemo();
      else if (type === 'tipifica:pausa') void runPauseDemo();
      else if (type === 'tipifica:prueba') {
        stop();
        if (ctx.store.hasValidSession()) startPractice(ctx);
        else ctx.toast('Primero inicia sesión en el simulador (credenciales de práctica) y vuelve a pulsar «Iniciar prueba».', 'warning');
      }
    }),
  ]);
}
