// Gráfico de barras apiladas en SVG propio (sin librerías): gestiones por día según el resultado.

import type { ProductivityDay } from '../domain/metrics';
import { esc } from '../utils/format';

const SERIES = [
  { key: 'promesa', label: 'Promesa de pago', color: 'var(--sim-chart-1)' },
  { key: 'contacto', label: 'Contacto', color: 'var(--sim-chart-2)' },
  { key: 'sinContacto', label: 'Sin contacto', color: 'var(--sim-chart-3)' },
] as const;

export function miniBarChartTemplate(days: ProductivityDay[]): string {
  const width = 560;
  const height = 230;
  const pad = { top: 16, right: 12, bottom: 28, left: 32 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const totals = days.map((d) => d.promesa + d.contacto + d.sinContacto);
  const rawMax = Math.max(1, ...totals);
  const step = rawMax <= 5 ? 1 : rawMax <= 10 ? 2 : 5;
  const max = Math.ceil(rawMax / step) * step;
  const slot = innerW / days.length;
  const barW = Math.min(44, slot * 0.56);
  const y = (v: number): number => pad.top + innerH - (v / max) * innerH;

  const grid: string[] = [];
  for (let v = 0; v <= max; v += step) {
    grid.push(
      `<line x1="${pad.left}" x2="${width - pad.right}" y1="${y(v)}" y2="${y(v)}" class="sim-chart__grid" />` +
        `<text x="${pad.left - 8}" y="${y(v) + 4}" text-anchor="end" class="sim-chart__tick">${v}</text>`,
    );
  }

  const bars = days
    .map((d, i) => {
      const x = pad.left + i * slot + (slot - barW) / 2;
      let acc = 0;
      const rects = SERIES.map((s) => {
        const value = d[s.key];
        if (!value) return '';
        const top = y(acc + value);
        const h = y(acc) - top;
        acc += value;
        return `<rect x="${x}" y="${top}" width="${barW}" height="${Math.max(0, h - 1)}" rx="2" fill="${s.color}"><title>${esc(d.day)} · ${esc(s.label)}: ${value}</title></rect>`;
      }).join('');
      return `${rects}<text x="${x + barW / 2}" y="${height - 8}" text-anchor="middle" class="sim-chart__tick">${esc(d.day)}</text>`;
    })
    .join('');

  const total = totals.reduce((a, b) => a + b, 0);
  const summary = `Gestiones por día de la semana: ${total} en total.`;

  return `
    <figure class="sim-chart">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(summary)}" preserveAspectRatio="xMidYMid meet">
        ${grid.join('')}
        ${bars}
      </svg>
      <figcaption class="sim-chart__legend">
        ${SERIES.map((s) => `<span><i style="background:${s.color}" aria-hidden="true"></i>${esc(s.label)}</span>`).join('')}
      </figcaption>
      <table class="sim-visually-hidden">
        <caption>${esc(summary)}</caption>
        <thead><tr><th scope="col">Día</th>${SERIES.map((s) => `<th scope="col">${esc(s.label)}</th>`).join('')}</tr></thead>
        <tbody>${days.map((d) => `<tr><th scope="row">${esc(d.day)}</th><td>${d.promesa}</td><td>${d.contacto}</td><td>${d.sinContacto}</td></tr>`).join('')}</tbody>
      </table>
    </figure>`;
}
