import { esc } from '../utils/format';
import { icon } from './icons';

export function emptyStateTemplate(title: string, message: string, action?: { label: string; name: string }): string {
  return `
    <div class="sim-empty">
      ${icon('Search', 'sim-empty__icon')}
      <p class="sim-empty__title">${esc(title)}</p>
      <p class="sim-empty__text">${esc(message)}</p>
      ${action ? `<button type="button" class="sim-btn sim-btn--primary" data-action="${esc(action.name)}">${esc(action.label)}</button>` : ''}
    </div>`;
}
