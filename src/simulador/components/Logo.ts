// Logos e ilustraciones en SVG propios del clon de entrenamiento (no copian imágenes del sistema real).

import type { Portfolio } from '../types/simulator';
import { esc } from '../utils/format';

/** Isotipo de Control Next: aro rojo con una flecha de avance. */
export function brandMark(size = 120): string {
  return `
    <svg class="sim-brand-mark" width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <circle cx="60" cy="60" r="54" fill="#fff" />
      <path d="M60 14a46 46 0 1 0 44 32" fill="none" stroke="#d61f26" stroke-width="12" stroke-linecap="round" />
      <path d="M92 18l16 26-30 2z" fill="#d61f26" />
      <path d="M44 60h30M62 46l14 14-14 14" fill="none" stroke="#1f2937" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" />
    </svg>`;
}

/** Logo con el nombre en dos líneas (tarjeta de ingreso). */
export function brandLockup(): string {
  return `
    <div class="sim-brand-lockup">
      ${brandMark(132)}
      <p class="sim-brand-lockup__name"><span>Control</span><span class="sim-brand-lockup__accent">Next</span></p>
    </div>`;
}

/** Logo horizontal para la franja oscura del encabezado. */
export function schoolLogo(): string {
  return `
    <span class="sim-school-logo">
      ${brandMark(34)}
      <span class="sim-school-logo__text"><strong>Control</strong> <span>Next</span></span>
    </span>`;
}

/** Dos asesores (ilustración del perfil y del avatar del encabezado). */
export function advisorsIllustration(size = 200): string {
  return `
    <svg class="sim-advisors" width="${size}" height="${size}" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="sim-skin" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#f6d2ad" /><stop offset="1" stop-color="#d9a679" /></radialGradient>
        <linearGradient id="sim-green" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ccc65" /><stop offset="1" stop-color="#5b8f2e" /></linearGradient>
        <linearGradient id="sim-blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#90caf9" /><stop offset="1" stop-color="#3d7cc9" /></linearGradient>
      </defs>
      <ellipse cx="104" cy="186" rx="86" ry="9" fill="#000" opacity=".08" />
      <path d="M14 182c0-44 22-66 52-66s52 22 52 66z" fill="url(#sim-green)" />
      <path d="M30 70c0-30 16-46 38-46s36 16 36 44c0 22-6 40-10 48H40c-6-10-10-26-10-46z" fill="#d8b25a" />
      <ellipse cx="68" cy="76" rx="26" ry="31" fill="url(#sim-skin)" />
      <path d="M40 66c6-20 20-28 30-28s26 8 30 26c-14-2-30-8-40-18-4 10-12 16-20 20z" fill="#e2c06a" />
      <path d="M78 186c0-48 24-72 56-72s58 24 58 72z" fill="url(#sim-blue)" />
      <path d="M116 120l18 30 18-30" fill="#fff" opacity=".9" />
      <ellipse cx="134" cy="84" rx="27" ry="32" fill="url(#sim-skin)" />
      <path d="M106 80c-2-26 12-40 30-40s32 12 30 38c-6-10-16-16-30-16-12 0-22 6-30 18z" fill="#4a4a4a" />
    </svg>`;
}

/** Imagen de la campaña tipo «constelación» (fondo azul nocturno con estrellas unidas). */
function constellation(): string {
  const stars: [number, number][] = [[40, 30], [62, 44], [84, 30], [62, 70], [46, 96], [80, 96], [30, 60], [96, 58], [62, 18]];
  const lines = [[8, 1], [0, 1], [1, 2], [1, 3], [3, 4], [3, 5], [0, 6], [2, 7]];
  return `
    <svg class="sim-campaign-img" viewBox="0 0 124 100" role="img" aria-label="Imagen de la campaña">
      <defs><radialGradient id="sim-night" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#2b4fa8" /><stop offset="1" stop-color="#0b1a4a" /></radialGradient></defs>
      <rect width="124" height="100" fill="url(#sim-night)" />
      ${Array.from({ length: 26 }, (_, i) => `<circle cx="${(i * 37) % 124}" cy="${(i * 53) % 100}" r="${i % 3 === 0 ? 0.9 : 0.5}" fill="#fff" opacity=".6" />`).join('')}
      ${lines.map(([a, b]) => `<line x1="${stars[a!]![0]}" y1="${stars[a!]![1]}" x2="${stars[b!]![0]}" y2="${stars[b!]![1]}" stroke="#9ec5ff" stroke-width=".8" opacity=".85" />`).join('')}
      ${stars.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="#fff" /><circle cx="${x}" cy="${y}" r="4" fill="#9ec5ff" opacity=".25" />`).join('')}
      <circle cx="12" cy="88" r="5" fill="#d61f26" />
    </svg>`;
}

/** Contenido de la tarjeta de campaña: nombre en letra grande (como en Control Next) o imagen. */
export function portfolioLogo(p: Portfolio): string {
  if (p.logo === 'constelacion') return constellation();
  if (p.logo === 'propia') {
    const word = p.name.replace(/\s*Propia$/i, '');
    return `<span class="sim-wordmark sim-wordmark--propia"><small>PROPIA</small>${esc(word)}</span>`;
  }
  return `<span class="sim-wordmark">${esc(p.name)}</span>`;
}
