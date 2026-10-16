// Logos propios en SVG. No reproducen ninguna marca real.

import type { LogoShape } from '../types/simulator';
import { esc } from '../utils/format';

/** Logo grande del Centro de Gestión Formativa: auriculares estilizados sobre un libro abierto. */
export function brandMark(size = 120): string {
  return `
    <svg class="sim-brand-mark" width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <circle cx="60" cy="60" r="56" fill="var(--sim-brand-900)" />
      <circle cx="60" cy="60" r="49" fill="none" stroke="var(--sim-brand-400)" stroke-width="3" />
      <path d="M32 62a28 28 0 0 1 56 0" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" />
      <rect x="25" y="58" width="12" height="20" rx="5" fill="var(--sim-brand-400)" />
      <rect x="83" y="58" width="12" height="20" rx="5" fill="var(--sim-brand-400)" />
      <path d="M40 80c7-4 14-4 20 1c6-5 13-5 20-1v12c-7-4-14-4-20 1c-6-5-13-5-20-1z" fill="#fff" />
      <path d="M60 81v12" stroke="var(--sim-brand-900)" stroke-width="2" />
    </svg>`;
}

/** Logo con el nombre en dos líneas (columna izquierda de la tarjeta de ingreso). */
export function brandLockup(): string {
  return `
    <div class="sim-brand-lockup">
      ${brandMark(132)}
      <p class="sim-brand-lockup__name"><span>Centro de Gestión</span><span>Formativa</span></p>
    </div>`;
}

/** Logo pequeño horizontal para fondos oscuros. */
export function schoolLogo(): string {
  return `
    <span class="sim-school-logo">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" focusable="false">
        <path d="M13 3 2 9l11 6 11-6z" fill="var(--sim-brand-400)" />
        <path d="M6 12v5c0 2 3.5 4 7 4s7-2 7-4v-5l-7 4z" fill="#fff" />
      </svg>
      <span class="sim-school-logo__text">Fontana <strong>School</strong></span>
    </span>`;
}

/** Logo geométrico de una cartera ficticia. */
export function portfolioLogo(shape: LogoShape, accent: string, name: string): string {
  const color = esc(accent);
  const shapes: Record<LogoShape, string> = {
    circulos: `<circle cx="26" cy="32" r="16" fill="${color}" /><circle cx="44" cy="32" r="16" fill="${color}" opacity=".55" />`,
    triangulos: `<path d="M8 48 26 14l18 34z" fill="${color}" /><path d="M28 48 44 20l16 28z" fill="${color}" opacity=".55" />`,
    barras: `<rect x="10" y="30" width="10" height="20" rx="2" fill="${color}" opacity=".5" /><rect x="25" y="20" width="10" height="30" rx="2" fill="${color}" opacity=".75" /><rect x="40" y="10" width="10" height="40" rx="2" fill="${color}" />`,
    rombo: `<path d="M32 6 56 32 32 58 8 32z" fill="${color}" /><path d="M32 18 46 32 32 46 18 32z" fill="#fff" opacity=".85" />`,
  };
  return `
    <svg class="sim-portfolio-logo" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Logo de ${esc(name)}">
      ${shapes[shape]}
    </svg>`;
}
