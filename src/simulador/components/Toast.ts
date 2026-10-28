import type { ToastKind } from '../context';
import { esc } from '../utils/format';
import { dismiss } from '../utils/dom';
import { hydrateIcons, icon } from './icons';

const MAX_TOASTS = 3;

const KIND_ICON: Record<ToastKind, string> = {
  success: 'CircleCheck',
  info: 'Info',
  warning: 'TriangleAlert',
  error: 'TriangleAlert',
};

/** Contenedor de avisos breves anunciados por lectores de pantalla. */
export function createToaster(root: HTMLElement) {
  const region = document.createElement('div');
  region.className = 'sim-toasts';
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  root.append(region);
  const timers = new Set<ReturnType<typeof setTimeout>>();

  return {
    show(message: string, kind: ToastKind = 'success'): void {
      const item = document.createElement('div');
      item.className = `sim-toast sim-toast--${kind}`;
      item.innerHTML = `${icon(KIND_ICON[kind])}<span>${esc(message)}</span>`;
      hydrateIcons(item);
      region.append(item);
      // Con varios avisos seguidos (p. ej. por clics repetidos) solo se conservan los últimos.
      [...region.children].filter((child) => !child.classList.contains('is-leaving')).slice(0, -MAX_TOASTS).forEach((child) => dismiss(child as HTMLElement));
      const timer = setTimeout(() => {
        dismiss(item);
        timers.delete(timer);
      }, 4500);
      timers.add(timer);
    },
    destroy(): void {
      for (const t of timers) clearTimeout(t);
      region.remove();
    },
  };
}
