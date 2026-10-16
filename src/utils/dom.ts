// Ayudas mínimas para el DOM.

export type Cleanup = () => void;

export function qs<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`No se encontró ${selector}`);
  return el;
}

export function qsa<T extends Element = HTMLElement>(root: ParentNode, selector: string): T[] {
  return [...root.querySelectorAll<T>(selector)];
}

type EventMap = HTMLElementEventMap & DocumentEventMap & WindowEventMap;

export function on<K extends keyof EventMap>(
  target: HTMLElement | Document | Window,
  type: K,
  handler: (event: EventMap[K]) => void,
  options?: AddEventListenerOptions,
): Cleanup {
  target.addEventListener(type, handler as EventListener, options);
  return () => target.removeEventListener(type, handler as EventListener, options);
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusableIn(container: HTMLElement): HTMLElement[] {
  return qsa<HTMLElement>(container, FOCUSABLE).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

/** Mantiene el foco del teclado dentro de `container` mientras esté abierto. */
export function trapFocus(container: HTMLElement): Cleanup {
  return on(container, 'keydown', (event) => {
    if (event.key !== 'Tab') return;
    const items = focusableIn(container);
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

/** Ejecuta varias funciones de limpieza en orden inverso. */
export function combine(cleanups: Cleanup[]): Cleanup {
  return () => {
    for (const fn of cleanups.splice(0).reverse()) fn();
  };
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): ((...args: A) => void) & { cancel(): void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const wrapped = (...args: A): void => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  wrapped.cancel = (): void => clearTimeout(timer);
  return wrapped;
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
