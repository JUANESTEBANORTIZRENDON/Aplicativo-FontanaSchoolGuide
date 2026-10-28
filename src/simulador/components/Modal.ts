// Ventana modal genérica al estilo de Control Next (título, contenido y botones a la derecha).

import { combine, dismiss, on, qs, trapFocus } from '../utils/dom';
import { esc } from '../utils/format';
import { hydrateIcons } from './icons';

export interface ModalAction {
  label: string;
  value: string;
  kind?: 'primary' | 'ghost' | 'danger' | 'secondary';
}

export interface ModalOptions {
  title: string;
  /** HTML ya escapado. */
  body: string;
  actions?: ModalAction[];
  wide?: boolean;
  /** Marca para la guía de la demostración. */
  guide?: string;
  /** Lee un valor del contenido (p. ej. un select): el resultado llega como `valor-del-botón:valor-leído`. */
  read?: (dialog: HTMLElement) => string;
}

/** Abre la ventana y resuelve con el `value` del botón pulsado (null si se cierra con Esc o clic fuera). */
export function openModal(root: HTMLElement, options: ModalOptions): Promise<string | null> {
  const previous = document.activeElement as HTMLElement | null;
  const actions = options.actions ?? [{ label: 'OK', value: 'ok', kind: 'primary' }];
  const overlay = document.createElement('div');
  overlay.className = 'sim-modal-overlay';
  overlay.innerHTML = `
    <div class="sim-modal sim-modal--cn${options.wide ? ' sim-modal--wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="sim-modal-title"
      ${options.guide ? `data-sim-guide="${esc(options.guide)}"` : ''}>
      <h2 id="sim-modal-title" class="sim-modal__title">${esc(options.title)}</h2>
      <div class="sim-modal__body">${options.body}</div>
      <div class="sim-modal__actions">
        ${actions.map((a) => `<button type="button" class="sim-btn sim-btn--${a.kind ?? 'ghost'}" data-modal-value="${esc(a.value)}">${esc(a.label)}</button>`).join('')}
      </div>
    </div>`;
  hydrateIcons(overlay);
  root.append(overlay);

  return new Promise((resolve) => {
    const dialog = qs(overlay, '.sim-modal');
    const close = (value: string | null): void => {
      cleanup();
      if (previous?.isConnected) previous.focus();
      resolve(value);
      dismiss(overlay);
    };
    const cleanup = combine([
      trapFocus(dialog),
      on(overlay, 'click', (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-modal-value]');
        if (btn) {
          const value = btn.dataset.modalValue ?? null;
          close(value && value !== 'cancel' && options.read ? `${value}:${options.read(dialog)}` : value);
        }
        else if (e.target === overlay) close(null);
      }),
      on(overlay, 'keydown', (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          close(null);
        }
      }),
    ]);
    const primary = overlay.querySelector<HTMLElement>('.sim-btn--primary') ?? overlay.querySelector<HTMLElement>('[data-modal-value]');
    primary?.focus();
  });
}
