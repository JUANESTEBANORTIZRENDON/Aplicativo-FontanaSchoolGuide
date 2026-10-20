import { esc } from '../utils/format';
import { icon } from './icons';

export interface MetricCardProps {
  title: string;
  value: string;
  icon: string;
  tone: 'blue' | 'green' | 'amber' | 'violet';
  percent: number;
  percentLabel: string;
  caption: string;
  guide: string;
}

/** Tarjeta pequeña del panel: ícono en círculo, valor, anillo de progreso CSS y una línea de texto. */
export function metricCardTemplate(p: MetricCardProps): string {
  const pct = Math.max(0, Math.min(100, Math.round(p.percent)));
  return `
    <article class="sim-panel-card sim-metric sim-metric--${p.tone}" data-sim-guide="${esc(p.guide)}">
      <h2 class="sim-panel-card__head">${esc(p.title)}</h2>
      <div class="sim-panel-card__body sim-metric__body">
        <span class="sim-metric__icon">${icon(p.icon)}</span>
        <p class="sim-metric__value">${esc(p.value)}</p>
        <div class="sim-ring" style="--sim-ring-value:${pct}" role="img" aria-label="${esc(p.percentLabel)}: ${pct} %">
          <span class="sim-ring__label">${pct}%</span>
        </div>
        <p class="sim-metric__caption">${p.caption}</p>
      </div>
    </article>`;
}
