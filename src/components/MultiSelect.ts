// Multiselección accesible propia: botón que abre una lista de casillas.

import { combine, on, qs, qsa, type Cleanup } from '../utils/dom';
import { esc } from '../utils/format';
import { icon } from './icons';

export interface MultiOption {
  value: string;
  label: string;
}

function summary(options: MultiOption[], selected: string[]): string {
  if (selected.length === 0) return 'Nada seleccionado';
  if (selected.length === 1) return options.find((o) => o.value === selected[0])?.label ?? '1 seleccionado';
  return `${selected.length} seleccionados`;
}

export function multiSelectTemplate(id: string, label: string, options: MultiOption[], selected: string[]): string {
  return `
    <div class="sim-multiselect" data-multiselect="${esc(id)}">
      <span class="sim-label" id="${esc(id)}-label">${esc(label)}</span>
      <button type="button" class="sim-input sim-multiselect__button${selected.length ? ' has-value' : ''}" aria-expanded="false"
        aria-controls="${esc(id)}-list" aria-labelledby="${esc(id)}-label ${esc(id)}-value">
        <span class="sim-multiselect__value" id="${esc(id)}-value">${esc(summary(options, selected))}</span>
        ${icon('ChevronDown')}
      </button>
      <div class="sim-popover sim-multiselect__list" id="${esc(id)}-list" role="group" aria-labelledby="${esc(id)}-label" hidden>
        ${options
          .map(
            (o) => `
          <label class="sim-check">
            <input type="checkbox" value="${esc(o.value)}" ${selected.includes(o.value) ? 'checked' : ''} />
            <span>${esc(o.label)}</span>
          </label>`,
          )
          .join('')}
        <button type="button" class="sim-btn sim-btn--ghost sim-btn--xs" data-ms-clear>Quitar selección</button>
      </div>
    </div>`;
}

export function readMultiSelect(scope: ParentNode, id: string): string[] {
  return qsa<HTMLInputElement>(scope, `[data-multiselect="${id}"] input[type="checkbox"]:checked`).map((i) => i.value);
}

/** Activa todas las multiselecciones dentro de `scope`. */
export function mountMultiSelects(scope: HTMLElement): Cleanup {
  const cleanups: Cleanup[] = [];
  for (const root of qsa(scope, '[data-multiselect]')) {
    const button = qs<HTMLButtonElement>(root, '.sim-multiselect__button');
    const list = qs(root, '.sim-multiselect__list');
    const value = qs(root, '.sim-multiselect__value');
    const options: MultiOption[] = qsa<HTMLInputElement>(list, 'input').map((i) => ({
      value: i.value,
      label: i.nextElementSibling?.textContent ?? i.value,
    }));
    const setOpen = (open: boolean, refocus = false): void => {
      list.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
      if (open) qs<HTMLInputElement>(list, 'input').focus();
      else if (refocus) button.focus();
    };
    const refresh = (): void => {
      const selected = qsa<HTMLInputElement>(list, 'input:checked').map((i) => i.value);
      value.textContent = summary(options, selected);
      button.classList.toggle('has-value', selected.length > 0);
    };
    cleanups.push(
      on(button, 'click', () => setOpen(!!list.hidden)),
      on(list, 'change', refresh),
      on(qs(list, '[data-ms-clear]'), 'click', () => {
        for (const input of qsa<HTMLInputElement>(list, 'input')) input.checked = false;
        refresh();
        setOpen(false, true);
      }),
      on(root, 'keydown', (event) => {
        if (event.key === 'Escape' && !list.hidden) {
          event.stopPropagation();
          setOpen(false, true);
        }
      }),
      on(root, 'focusout', (event) => {
        const next = event.relatedTarget as Node | null;
        if (next && !root.contains(next)) setOpen(false);
      }),
      on(document, 'click', (event) => {
        if (!root.contains(event.target as Node)) setOpen(false);
      }),
    );
  }
  return combine(cleanups);
}
