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

let illustrationCount = 0;

/** Dos asesores (ilustración del perfil y del avatar del encabezado). Cada copia usa ids de degradado propios. */
export function advisorsIllustration(size = 200): string {
  illustrationCount += 1;
  const k = `sim-adv${illustrationCount}`;
  return `
    <svg class="sim-advisors" width="${size}" height="${size}" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="${k}-skin" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#f6d2ad" /><stop offset="1" stop-color="#d9a679" /></radialGradient>
        <linearGradient id="${k}-green" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ccc65" /><stop offset="1" stop-color="#5b8f2e" /></linearGradient>
        <linearGradient id="${k}-blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#90caf9" /><stop offset="1" stop-color="#3d7cc9" /></linearGradient>
      </defs>
      <ellipse cx="104" cy="186" rx="86" ry="9" fill="#000" opacity=".08" />
      <path d="M14 182c0-44 22-66 52-66s52 22 52 66z" fill="url(#${k}-green)" />
      <path d="M30 70c0-30 16-46 38-46s36 16 36 44c0 22-6 40-10 48H40c-6-10-10-26-10-46z" fill="#d8b25a" />
      <ellipse cx="68" cy="76" rx="26" ry="31" fill="url(#${k}-skin)" />
      <path d="M40 66c6-20 20-28 30-28s26 8 30 26c-14-2-30-8-40-18-4 10-12 16-20 20z" fill="#e2c06a" />
      <path d="M78 186c0-48 24-72 56-72s58 24 58 72z" fill="url(#${k}-blue)" />
      <path d="M116 120l18 30 18-30" fill="#fff" opacity=".9" />
      <ellipse cx="134" cy="84" rx="27" ry="32" fill="url(#${k}-skin)" />
      <path d="M106 80c-2-26 12-40 30-40s32 12 30 38c-6-10-16-16-30-16-12 0-22 6-30 18z" fill="#4a4a4a" />
    </svg>`;
}

/** Imagen ficticia de la campaña «Andes»: cordillera al amanecer (no reproduce ningún logo real). */
function mountains(): string {
  return `
    <svg class="sim-campaign-img" viewBox="0 0 124 100" role="img" aria-label="Imagen de la campaña Andes">
      <defs>
        <linearGradient id="sim-dawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9a5a" /><stop offset=".55" stop-color="#ffd27a" /><stop offset="1" stop-color="#fff1c9" /></linearGradient>
      </defs>
      <rect width="124" height="100" fill="url(#sim-dawn)" />
      <circle cx="84" cy="44" r="14" fill="#fff6d8" opacity=".95" />
      <path d="M0 78 28 40l16 20 20-30 26 36 14-14 20 26v22H0z" fill="#3c5a8a" />
      <path d="M28 40l7 9-5 2-6-4zM64 30l8 12-7 3-5-6z" fill="#fff" opacity=".9" />
      <path d="M0 88 22 70l18 12 24-18 30 22 30-14v28H0z" fill="#22385e" />
      <text x="62" y="96" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="9" font-weight="900" fill="#fff" letter-spacing="2">ANDES</text>
    </svg>`;
}

/** Contenido de la tarjeta de campaña: nombre en letra grande (como en Control Next) o imagen. */
export function portfolioLogo(p: Portfolio): string {
  if (p.logo === 'imagen') return mountains();
  if (p.logo === 'propia') {
    const word = p.name.replace(/\s*Propia$/i, '');
    return `<span class="sim-wordmark sim-wordmark--propia"><small>PROPIA</small>${esc(word)}</span>`;
  }
  return `<span class="sim-wordmark">${esc(p.name)}</span>`;
}
