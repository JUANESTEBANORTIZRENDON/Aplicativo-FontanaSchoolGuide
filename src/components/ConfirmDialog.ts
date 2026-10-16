import type { ConfirmOptions } from '../context';
import { combine, on, qs, trapFocus } from '../utils/dom';
import { esc } from '../utils/format';

/** Diálogo modal de confirmación. Devuelve el foco al elemento que estaba activo. */
export function openConfirm(root: HTMLElement, options: ConfirmOptions): Promise<boolean> {
  const previous = document.activeElement as HTMLElement | null;
  const overlay = document.createElement('div');
  overlay.className = 'sim-modal-overlay';
  overlay.innerHTML = `
    <div class="sim-modal" role="alertdialog" aria-modal="true" aria-labelledby="sim-confirm-title" aria-describedby="sim-confirm-text">
      <h2 id="sim-confirm-title" class="sim-modal__title">${esc(options.title)}</h2>
      <p id="sim-confirm-text" class="sim-modal__text">${esc(options.message)}</p>
      <div class="sim-modal__actions">
        <button type="button" class="sim-btn sim-btn--ghost" data-action="cancel">Cancelar</button>
        <button type="button" class="sim-btn ${options.danger ? 'sim-btn--danger' : 'sim-btn--primary'}" data-action="ok">${esc(options.confirmLabel)}</button>
      </div>
    </div>`;
  root.append(overlay);

  return new Promise((resolve) => {
    const dialog = qs(overlay, '.sim-modal');
    const close = (value: boolean): void => {
      cleanup();
      overlay.remove();
      previous?.focus();
      resolve(value);
    };
    const cleanup = combine([
      trapFocus(dialog),
      on(qs(overlay, '[data-action="cancel"]'), 'click', () => close(false)),
      on(qs(overlay, '[data-action="ok"]'), 'click', () => close(true)),
      on(overlay, 'keydown', (e) => {
        if (e.key === 'Escape') close(false);
      }),
      on(overlay, 'click', (e) => {
        if (e.target === overlay) close(false);
      }),
    ]);
    qs(overlay, '[data-action="cancel"]').focus();
  });
}
