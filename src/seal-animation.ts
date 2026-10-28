import './seal-animation.css';
import { escapar } from './http';

// Animación de sello compartida por todos los módulos: al completarlo, un sello con el logo de Fontana cae sobre
// la hoja del módulo. Se cierra con «Continuar», con Escape o sola (si se indica `autoCloseMs`).
export type SealOptions = {
  moduleName: string;
  moduleNumber?: number;
  // Texto de la cinta del sello: los módulos con examen se «aprueban»; los formativos se «completan».
  label?: 'APROBADO' | 'COMPLETADO';
  nextName?: string | null;
  continueLabel?: string;
  autoCloseMs?: number;
};

const LOGO = '/imagenes/fontana-logo.webp';

// Evita que el logo aparezca de golpe en medio de la animación.
function preloadLogo(): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image();
    const timer = window.setTimeout(resolve, 400); // el logo suele estar en caché; no se retrasa el sello por él
    image.onload = image.onerror = () => { window.clearTimeout(timer); resolve(); };
    image.src = LOGO;
  });
}

// El mismo sello puede permanecer en los resultados sin repetir la animación.
export function stampSvg(label: string, prefix = 'seal'): string {
  const id = prefix.replace(/[^a-zA-Z0-9_-]/g, '') || 'seal';
  return `<svg viewBox="0 0 240 240" role="presentation" focusable="false">
    <defs>
      <radialGradient id="${id}-wine" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#a02447"/><stop offset=".6" stop-color="#74112e"/><stop offset="1" stop-color="#3f0a1b"/></radialGradient>
      <linearGradient id="${id}-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3d58a"/><stop offset=".5" stop-color="#c79a2c"/><stop offset="1" stop-color="#8a6416"/></linearGradient>
      <path id="${id}-ring" d="M120,120 m-88,0 a88,88 0 1,1 176,0 a88,88 0 1,1 -176,0"/>
    </defs>
    <circle cx="120" cy="120" r="114" fill="url(#${id}-wine)" stroke="url(#${id}-gold)" stroke-width="7"/>
    <circle cx="120" cy="120" r="104" fill="none" stroke="#e5c570" stroke-width="1.5" stroke-dasharray="3 5" opacity=".8"/>
    <text font-size="14" font-weight="800" fill="#f3d58a" font-family="Segoe UI, Arial, sans-serif"><textPath href="#${id}-ring" textLength="548" lengthAdjust="spacing">FONTANA SCHOOL ✦ SELLO DE MÓDULO ✦ AULA DE FORMACIÓN ✦ </textPath></text>
    <circle cx="120" cy="120" r="70" fill="#fff8e6" stroke="url(#${id}-gold)" stroke-width="4"/>
    <image href="${LOGO}" x="82" y="64" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>
    <rect x="70" y="148" width="100" height="26" rx="13" fill="url(#${id}-wine)" stroke="url(#${id}-gold)" stroke-width="2"/>
    <text x="120" y="166" text-anchor="middle" font-size="13" font-weight="900" letter-spacing="2" fill="#f7e3a8" font-family="Segoe UI, Arial, sans-serif">${escapar(label)}</text>
  </svg>`;
}

export async function playSeal(options: SealOptions): Promise<void> {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  await preloadLogo();
  const opener = document.activeElement as HTMLElement | null;
  const layer = document.createElement('div');
  layer.className = `fontana-seal-stage${reduced ? ' is-static' : ''}`;
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-modal', 'true');
  layer.setAttribute('aria-labelledby', 'fontana-seal-title');
  layer.innerHTML = `
    <div class="fontana-seal-paper">
      <p class="fontana-seal-eyebrow">${options.moduleNumber ? `MÓDULO ${String(options.moduleNumber).padStart(2, '0')} · ` : ''}COMPLETADO</p>
      <h2 id="fontana-seal-title">${escapar(options.moduleName)}</h2>
      <div class="fontana-seal-stamp" aria-hidden="true"><span class="fontana-seal-ripple"></span>${stampSvg(options.label ?? 'APROBADO')}<span class="fontana-seal-glint"></span></div>
      <p class="fontana-seal-caption" role="status">¡Sello obtenido!${options.nextName ? ` Sigue con <strong>${escapar(options.nextName)}</strong>.` : ''}</p>
      <button type="button" class="fontana-seal-continue">${escapar(options.continueLabel ?? 'Continuar')}</button>
    </div>`;
  document.body.append(layer);
  const button = layer.querySelector<HTMLButtonElement>('.fontana-seal-continue')!;

  return new Promise<void>((resolve) => {
    let closed = false;
    const close = (): void => {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey, true);
      layer.classList.add('is-leaving');
      window.setTimeout(() => { layer.remove(); opener?.focus?.({ preventScroll: true }); resolve(); }, reduced ? 0 : 260);
    };
    // Escape cierra; Tab queda dentro del cuadro (el único control es «Continuar»).
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      else if (event.key === 'Tab') { event.preventDefault(); button.focus(); }
    }
    document.addEventListener('keydown', onKey, true);
    button.addEventListener('click', close);
    window.setTimeout(() => button.focus({ preventScroll: true }), reduced ? 0 : 1300);
    if (options.autoCloseMs) window.setTimeout(close, options.autoCloseMs);
  });
}
